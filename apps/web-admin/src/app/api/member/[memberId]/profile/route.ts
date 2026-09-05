import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyMember } from '@/lib/auth/verifyMember';
import { checkRateLimit } from '@/lib/rateLimit';
import { computeLevelProgress } from '@nexera/ai-assist';
import { validateUUIDs } from '@/lib/validation/uuid';

const profilePatchSchema = z
  .object({
    display_name: z.string().trim().min(1).max(50).optional(),
    primary_goal: z
      .enum(['muscle-gain', 'strength', 'weight-loss', 'endurance', 'general-fitness'])
      .optional(),
    experience_level: z
      .enum(['beginner', 'intermediate', 'advanced', 'athlete'])
      .optional(),
    injuries_or_limitations: z.string().trim().max(2000).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'At least one field required' });

interface AchievementDef {
  code: string;
  title: string;
  description: string;
  category: string;
  icon_name: string;
  points: number;
}

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ memberId: string }>;
}

/** GET /api/member/[memberId]/profile — Aggregated profile data */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { memberId } = await params;

    const uuidError = validateUUIDs({ memberId });
    if (uuidError) return uuidError;

    const authResult = await verifyMember(memberId);
    if (authResult instanceof NextResponse) return authResult;
    const { admin } = authResult;

    // Fetch member core data
    const { data: member } = await admin
      .from('members')
      .select(
        'id, display_name, first_name, avatar_url, smartgym_score, current_streak, best_streak, primary_goal, experience_level, joined_gym_at, gym_id'
      )
      .eq('id', memberId)
      .single();

    if (!member) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    // Parallel queries
    const [sessionsRes, achievementsRes] = await Promise.all([
      // Lifetime workout stats
      admin
        .from('workout_sessions')
        .select('id, total_volume_lbs, sets_count, created_at, completed_at, session_date, machine_id')
        .eq('member_id', memberId)
        .not('completed_at', 'is', null)
        .order('session_date', { ascending: false }),

      // Earned achievements with definitions
      admin
        .from('member_achievements')
        .select('id, achievement_code, earned_at, achievement_definitions(code, title, description, category, icon_name, points)')
        .eq('member_id', memberId)
        .order('earned_at', { ascending: false }),
    ]);

    const sessions = sessionsRes.data ?? [];
    const achievements = achievementsRes.data ?? [];

    // Compute lifetime stats
    let totalVolume = 0;
    let totalSets = 0;
    let totalDurationMin = 0;
    for (const s of sessions) {
      totalVolume += Number(s.total_volume_lbs) || 0;
      totalSets += s.sets_count || 0;
      if (s.completed_at && s.created_at) {
        const dur = (new Date(s.completed_at).getTime() - new Date(s.created_at).getTime()) / 60_000;
        if (dur > 0 && dur < 300) totalDurationMin += dur;
      }
    }

    // Avg workouts per week
    let avgPerWeek = 0;
    if (sessions.length > 0 && member.joined_gym_at) {
      const memberSince = new Date(member.joined_gym_at);
      const weeksActive = Math.max(1, (Date.now() - memberSince.getTime()) / (7 * 86_400_000));
      avgPerWeek = Math.round((sessions.length / weeksActive) * 10) / 10;
    }

    // Favorite machines: count sessions per machine_id, pick top 3
    const machineCounts = new Map<string, number>();
    for (const s of sessions) {
      if (s.machine_id) {
        machineCounts.set(s.machine_id, (machineCounts.get(s.machine_id) || 0) + 1);
      }
    }
    const topMachineIds = [...machineCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([id]) => id);

    let favoriteMachines: { id: string; name: string; sessions: number }[] = [];
    if (topMachineIds.length > 0) {
      const { data: machines } = await admin
        .from('machines')
        .select('id, name')
        .in('id', topMachineIds);

      if (machines) {
        favoriteMachines = topMachineIds.map((id) => {
          const m = machines.find((x: { id: string; name: string }) => x.id === id);
          return { id, name: m?.name ?? 'Unknown', sessions: machineCounts.get(id) ?? 0 };
        });
      }
    }

    // Level progress
    const level = computeLevelProgress(member.smartgym_score);

    return NextResponse.json({
      member: {
        id: member.id,
        display_name: member.display_name,
        first_name: member.first_name,
        avatar_url: member.avatar_url,
        primary_goal: member.primary_goal,
        experience_level: member.experience_level,
        joined_gym_at: member.joined_gym_at,
      },
      level,
      stats: {
        total_workouts: sessions.length,
        total_volume_lbs: Math.round(totalVolume),
        total_sets: totalSets,
        total_duration_min: Math.round(totalDurationMin),
        avg_workouts_per_week: avgPerWeek,
      },
      streak: {
        current: member.current_streak,
        best: member.best_streak,
      },
      achievements: achievements.map((a) => {
        const def = a.achievement_definitions as unknown as AchievementDef | null;
        return {
          code: def?.code ?? a.achievement_code,
          earned_at: a.earned_at,
          title: def?.title ?? null,
          description: def?.description ?? null,
          category: def?.category ?? null,
          icon_name: def?.icon_name ?? null,
          points: def?.points ?? 0,
        };
      }),
      favorite_machines: favoriteMachines,
    });
  } catch (err) {
    console.error('[member/profile] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/** PATCH /api/member/[memberId]/profile — Update profile fields */
export async function PATCH(
  req: NextRequest,
  { params }: RouteParams
) {
  try {
    const { memberId } = await params;

    const uuidError = validateUUIDs({ memberId });
    if (uuidError) return uuidError;

    const auth = await verifyMember(memberId);
    if (auth instanceof NextResponse) return auth;
    const { admin, member_id } = auth;

    // Rate limit AFTER auth, keyed on the verified member (M-9).
    const rl = checkRateLimit(`profile-update:${member_id}`, 10, 60_000);
    if (rl) return rl;

    const parsed = profilePatchSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }
    const updates: Record<string, unknown> = { ...parsed.data };

    const { error } = await admin
      .from('members')
      .update(updates)
      .eq('id', memberId);

    if (error) return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

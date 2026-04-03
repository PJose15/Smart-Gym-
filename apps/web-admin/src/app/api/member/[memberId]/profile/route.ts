import { NextRequest, NextResponse } from 'next/server';
import { verifyMember } from '@/lib/auth/verifyMember';
import { computeLevelProgress } from '@nexera/ai-assist';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ memberId: string }>;
}

/** GET /api/member/[memberId]/profile — Aggregated profile data */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { memberId } = await params;

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
      achievements: achievements.map((a) => ({
        code: a.achievement_code,
        earned_at: a.earned_at,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...(a.achievement_definitions as any),
      })),
      favorite_machines: favoriteMachines,
    });
  } catch (err) {
    console.error('[member/profile] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

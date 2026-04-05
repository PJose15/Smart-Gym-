import { NextRequest, NextResponse } from 'next/server';
import { verifyStaff } from '@/lib/auth/verifyStaff';
import { validateUUIDs } from '@/lib/validation/uuid';

export async function GET(
  _req: NextRequest,
  { params }: { params: { memberId: string } }
) {
  try {
    const result = await verifyStaff();
    if (result instanceof NextResponse) return result;

    const { admin, gym_id } = result;
    const { memberId } = params;
    const uuidError = validateUUIDs({ memberId });
    if (uuidError) return uuidError;

    // Get member
    const { data: member } = await admin
      .from('members')
      .select('id, user_id, display_name, avatar_url, last_session_date, current_streak, smartgym_score, joined_gym_at')
      .eq('id', memberId)
      .eq('gym_id', gym_id)
      .maybeSingle();

    if (!member) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    // Parallel queries
    const [profileRes, sessionsRes, volumeRes, trainingProfileRes, bodyMetricsRes, topMachinesRes, programRes] = await Promise.all([
      // User email
      admin.from('users').select('email').eq('id', member.user_id).single(),

      // Completed sessions count
      admin
        .from('workout_sessions')
        .select('id')
        .eq('member_id', memberId)
        .eq('gym_id', gym_id)
        .not('completed_at', 'is', null),

      // Total volume from completed sessions
      admin
        .from('workout_sessions')
        .select('total_volume_lbs')
        .eq('member_id', memberId)
        .eq('gym_id', gym_id)
        .not('completed_at', 'is', null),

      // Training profile
      admin
        .from('user_training_profiles')
        .select('goal, experience')
        .eq('profile_id', member.user_id)
        .eq('gym_id', gym_id)
        .maybeSingle(),

      // Latest body metrics
      admin
        .from('body_metrics')
        .select('weight_lbs, body_fat_pct')
        .eq('member_id', memberId)
        .order('logged_at', { ascending: false })
        .limit(1)
        .maybeSingle(),

      // Top machines — workout_sessions has machine_id directly
      admin
        .from('workout_sessions')
        .select('machine_id, machines!inner(name)')
        .eq('member_id', memberId)
        .eq('gym_id', gym_id)
        .not('machine_id', 'is', null)
        .not('completed_at', 'is', null),

      // Active program
      admin
        .from('ai_programs')
        .select('id, title, goal, week_number, duration_weeks, sessions_completed, sessions_total, on_track, generated_by, trainer_approved')
        .eq('member_id', memberId)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    // Calculate total volume
    const totalVolumeLbs = (volumeRes.data ?? []).reduce((sum, s) => {
      return sum + (s.total_volume_lbs ?? 0);
    }, 0);

    // Top machines aggregation
    const machineCounts = new Map<string, { name: string; count: number }>();
    (topMachinesRes.data ?? []).forEach((s) => {
      const mid = s.machine_id as string;
      const name = (s.machines as unknown as { name: string })?.name ?? 'Unknown';
      const existing = machineCounts.get(mid);
      if (existing) {
        existing.count++;
      } else {
        machineCounts.set(mid, { name, count: 1 });
      }
    });
    const topMachines = [...machineCounts.values()]
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
      .map((m) => ({ machine_name: m.name, sessions: m.count }));

    return NextResponse.json({
      member_name: member.display_name ?? 'Unknown',
      avatar_url: member.avatar_url,
      email: profileRes.data?.email ?? '',
      joined_at: member.joined_gym_at,
      last_session_date: member.last_session_date,
      current_streak: member.current_streak ?? 0,
      smartgym_score: member.smartgym_score ?? 0,
      total_sessions: sessionsRes.data?.length ?? 0,
      total_volume_lbs: Math.round(totalVolumeLbs),
      goal: trainingProfileRes.data?.goal ?? null,
      experience: trainingProfileRes.data?.experience ?? null,
      body_metrics: bodyMetricsRes.data ?? null,
      top_machines: topMachines,
      program: programRes.data
        ? {
            id: programRes.data.id,
            title: programRes.data.title,
            goal: programRes.data.goal,
            week: programRes.data.week_number,
            total_weeks: programRes.data.duration_weeks,
            sessions_completed: programRes.data.sessions_completed,
            sessions_total: programRes.data.sessions_total,
            progress: programRes.data.sessions_total > 0
              ? Math.round((programRes.data.sessions_completed / programRes.data.sessions_total) * 100)
              : 0,
            on_track: programRes.data.on_track,
            generated_by: programRes.data.generated_by,
            trainer_approved: programRes.data.trainer_approved,
          }
        : null,
    });
  } catch (err) {
    console.error('[trainer/members/[memberId]] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

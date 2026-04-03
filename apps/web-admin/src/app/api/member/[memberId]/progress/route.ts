import { NextRequest, NextResponse } from 'next/server';
import { verifyMember } from '@/lib/auth/verifyMember';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ memberId: string }>;
}

/** GET /api/member/[memberId]/progress — Training progress data */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { memberId } = await params;

    const authResult = await verifyMember(memberId);
    if (authResult instanceof NextResponse) return authResult;
    const { admin } = authResult;

    // Fetch member for streak info
    const { data: member } = await admin
      .from('members')
      .select('current_streak, best_streak, joined_gym_at')
      .eq('id', memberId)
      .single();

    if (!member) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    // All completed sessions (last 90 days for calendar, all for stats)
    const ninetyDaysAgo = new Date(Date.now() - 90 * 86_400_000).toISOString().slice(0, 10);

    const [allSessionsRes, recentSessionsRes] = await Promise.all([
      // All completed sessions for volume/stats
      admin
        .from('workout_sessions')
        .select('id, session_date, total_volume_lbs, sets_count, created_at, completed_at, machine_id, is_personal_best, best_weight_lbs, best_reps')
        .eq('member_id', memberId)
        .not('completed_at', 'is', null)
        .order('session_date', { ascending: false }),

      // Recent 10 with machine names for list display
      admin
        .from('workout_sessions')
        .select('id, session_date, total_volume_lbs, sets_count, created_at, completed_at, machine_id, machines(name)')
        .eq('member_id', memberId)
        .not('completed_at', 'is', null)
        .order('session_date', { ascending: false })
        .limit(10),
    ]);

    const allSessions = allSessionsRes.data ?? [];
    const recentSessions = recentSessionsRes.data ?? [];

    // Total stats
    let totalVolume = 0;
    let totalSets = 0;
    for (const s of allSessions) {
      totalVolume += Number(s.total_volume_lbs) || 0;
      totalSets += s.sets_count || 0;
    }

    let avgPerWeek = 0;
    if (allSessions.length > 0 && member.joined_gym_at) {
      const weeks = Math.max(1, (Date.now() - new Date(member.joined_gym_at).getTime()) / (7 * 86_400_000));
      avgPerWeek = Math.round((allSessions.length / weeks) * 10) / 10;
    }

    // Weekly volume — last 8 weeks
    const weeklyVolume: { week: string; volume: number }[] = [];
    for (let i = 7; i >= 0; i--) {
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - weekStart.getDay() - i * 7);
      weekStart.setHours(0, 0, 0, 0);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);

      const startStr = weekStart.toISOString().slice(0, 10);
      const endStr = weekEnd.toISOString().slice(0, 10);

      let vol = 0;
      for (const s of allSessions) {
        if (s.session_date >= startStr && s.session_date < endStr) {
          vol += Number(s.total_volume_lbs) || 0;
        }
      }

      weeklyVolume.push({
        week: weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        volume: Math.round(vol),
      });
    }

    // Workout dates (last 90 days) for calendar
    const workoutDates = new Set<string>();
    for (const s of allSessions) {
      if (s.session_date >= ninetyDaysAgo) {
        workoutDates.add(s.session_date);
      }
    }

    // Personal records: sessions with PRs, grouped by machine
    const prMap = new Map<string, { machine_id: string; best_weight_lbs: number; best_reps: number; session_date: string }>();
    for (const s of allSessions) {
      if (s.is_personal_best && s.machine_id && s.best_weight_lbs) {
        const existing = prMap.get(s.machine_id);
        if (!existing || Number(s.best_weight_lbs) > existing.best_weight_lbs) {
          prMap.set(s.machine_id, {
            machine_id: s.machine_id,
            best_weight_lbs: Number(s.best_weight_lbs),
            best_reps: s.best_reps ?? 0,
            session_date: s.session_date,
          });
        }
      }
    }

    // Fetch machine names for PRs
    const prMachineIds = [...prMap.keys()];
    let personalRecords: { machine_name: string; weight_lbs: number; reps: number; date: string; est_1rm: number }[] = [];
    if (prMachineIds.length > 0) {
      const { data: machines } = await admin
        .from('machines')
        .select('id, name')
        .in('id', prMachineIds);

      const machineNameMap = new Map((machines ?? []).map((m: { id: string; name: string }) => [m.id, m.name]));

      personalRecords = [...prMap.values()]
        .map((pr) => {
          const reps = pr.best_reps || 1;
          // Epley formula for estimated 1RM
          const est1rm = reps === 1 ? pr.best_weight_lbs : Math.round(pr.best_weight_lbs * (1 + reps / 30));
          return {
            machine_name: machineNameMap.get(pr.machine_id) ?? 'Unknown',
            weight_lbs: pr.best_weight_lbs,
            reps: pr.best_reps,
            date: pr.session_date,
            est_1rm: est1rm,
          };
        })
        .sort((a, b) => b.est_1rm - a.est_1rm)
        .slice(0, 10);
    }

    // Format recent workouts
    const recentWorkouts = recentSessions.map((s) => {
      let durationMin = 0;
      if (s.completed_at && s.created_at) {
        durationMin = Math.round(
          (new Date(s.completed_at).getTime() - new Date(s.created_at).getTime()) / 60_000
        );
        if (durationMin < 0 || durationMin > 300) durationMin = 0;
      }
      return {
        id: s.id,
        date: s.session_date,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        machine_name: (s.machines as any)?.name ?? null,
        volume_lbs: Math.round(Number(s.total_volume_lbs) || 0),
        sets: s.sets_count || 0,
        duration_min: durationMin,
      };
    });

    return NextResponse.json({
      stats: {
        total_workouts: allSessions.length,
        total_volume_lbs: Math.round(totalVolume),
        total_sets: totalSets,
        avg_per_week: avgPerWeek,
        current_streak: member.current_streak,
      },
      weekly_volume: weeklyVolume,
      workout_dates: [...workoutDates].sort(),
      personal_records: personalRecords,
      recent_workouts: recentWorkouts,
    });
  } catch (err) {
    console.error('[member/progress] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

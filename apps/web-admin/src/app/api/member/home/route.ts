import { NextRequest, NextResponse } from 'next/server';
import { computeHeroState, computeLevelProgress } from '@nexera/ai-assist';
import { memberHomeQuerySchema } from '@/lib/validation/member';
import { verifyMember } from '@/lib/auth/verifyMember';
import { resolveMemberGym } from '@/lib/auth/tenant';
import { getReadinessScore } from '@/lib/readiness/readinessCache';
import { getMuscleMap } from '@/lib/muscleMap/muscleMapCache';
import { extractAiProgramDays } from '@nexera/utils';
import type { HomeScreenData, ProgramContextData } from '@nexera/types';

/** Whole days elapsed since the assignment started (never negative). */
function daysSince(dateStr: string): number {
  const elapsed = Date.now() - new Date(dateStr).getTime();
  return Math.max(0, Math.floor(elapsed / 86400000));
}

/**
 * GET /api/member/home?member_id=...&gym_id=...
 * Returns shaped HomeScreenData for the member home screen.
 */
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const parsed = memberHomeQuerySchema.safeParse({
      member_id: url.searchParams.get('member_id'),
      gym_id: url.searchParams.get('gym_id'),
    });

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
    }

    const { member_id } = parsed.data;

    // Verify the caller owns this member_id
    const authResult = await verifyMember(member_id);
    if (authResult instanceof NextResponse) return authResult;
    const { admin } = authResult;

    // Tenant binding (BE-H4): gym derived from the member row — the
    // caller-supplied gym_id query param is ignored.
    const gym_id = await resolveMemberGym(admin, member_id);
    if (!gym_id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const today = new Date().toISOString().split('T')[0];
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
    const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];

    // Run 10 queries in parallel (7 original + readiness + muscle map + unread check-in)
    const [
      memberResult,
      lastSessionResult,
      programResult,
      todaySessionsResult,
      challengeResult,
      feedResult,
      statsResult,
      readinessResult,
      muscleMapResult,
      unreadCheckInResult,
    ] = await Promise.all([
      // 1. Member data
      admin
        .from('members')
        .select('id, display_name, first_name, avatar_url, smartgym_score, current_streak, best_streak, last_session_date, leveled_up_at, primary_goal')
        .eq('id', member_id)
        .single(),

      // 2. Last session (PR info)
      admin
        .from('workout_sessions')
        .select('id, machine_id, is_personal_best, session_date, completed_at, machines(name)')
        .eq('member_id', member_id)
        .not('completed_at', 'is', null)
        .order('completed_at', { ascending: false })
        .limit(1)
        .maybeSingle(),

      // 3. Active program assignment — the source of truth. Points at EITHER
      // a trainer-built program (program_id → programs/program_days/
      // program_exercises) OR an AI program (ai_program_id → ai_programs
      // with program_data JSON). Resolved after this batch.
      admin
        .from('member_program_assignments')
        .select('id, program_id, ai_program_id, assigned_at, status')
        .eq('member_id', member_id)
        .eq('status', 'active')
        .order('assigned_at', { ascending: false })
        .limit(1)
        .maybeSingle(),

      // 4. Today's sessions
      admin
        .from('workout_sessions')
        .select('id, machine_id, sets_count, total_volume_lbs, completed_at, machines(name)')
        .eq('member_id', member_id)
        .eq('session_date', today),

      // 5. Active challenge participation
      admin
        .from('challenge_participants')
        .select(`
          id, challenge_id, current_score, current_rank,
          challenges:challenge_id(id, title, end_date)
        `)
        .eq('member_id', member_id)
        .eq('gym_id', gym_id)
        .limit(1)
        .maybeSingle(),

      // 6. Recent gym feed events (join member for display_name)
      admin
        .from('gym_feed_events')
        .select('id, event_type, display_text, context_data, created_at, member_id, members(display_name)')
        .eq('gym_id', gym_id)
        .order('created_at', { ascending: false })
        .limit(3),

      // 7. Weekly + all-time stats
      Promise.all([
        admin
          .from('workout_sessions')
          .select('id, total_volume_lbs')
          .eq('member_id', member_id)
          .gte('session_date', weekAgo)
          .not('completed_at', 'is', null),
        admin
          .from('workout_sessions')
          .select('id, is_personal_best')
          .eq('member_id', member_id)
          .eq('is_personal_best', true)
          .gte('session_date', monthAgo)
          .not('completed_at', 'is', null),
        admin
          .from('workout_sessions')
          .select('id, total_volume_lbs')
          .eq('member_id', member_id)
          .not('completed_at', 'is', null),
      ]),

      // 8. Readiness score
      getReadinessScore(member_id, gym_id, admin).catch((e) => { console.error('[home] readiness error:', e); return null; }),

      // 9. Muscle map (cached daily)
      getMuscleMap(member_id, gym_id, admin).catch((e) => { console.error('[home] muscle-map error:', e); return null; }),

      // 10. Unread check-in (UI_009)
      admin
        .from('weekly_checkins')
        .select('id')
        .eq('member_id', member_id)
        .not('sent_at', 'is', null)
        .is('read_at', null)
        .order('sent_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const member = memberResult.data as {
      id: string; display_name: string; first_name: string | null;
      avatar_url: string | null; smartgym_score: number; current_streak: number;
      best_streak: number; last_session_date: string | null;
      leveled_up_at: string | null; primary_goal: string | null;
    } | null;
    if (!member) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    // Compute hero state
    const lastSession = lastSessionResult.data as {
      id: string; machine_id: string; is_personal_best: boolean;
      session_date: string; completed_at: string | null;
      machines: { name: string } | null;
    } | null;
    const daysSinceLastWorkout = member.last_session_date
      ? Math.floor((Date.now() - new Date(member.last_session_date).getTime()) / 86400000)
      : null;

    // ─── Resolve active program (trainer OR AI) ─────────────────────────────
    const assignment = programResult.data as {
      id: string; program_id: string | null; ai_program_id: string | null;
      assigned_at: string; status: string;
    } | null;

    let programData: ProgramContextData | null = null;
    let isProgramComplete = false;

    // Path A: trainer-built program (assignment carries program_id)
    if (assignment?.program_id) {
      const [progResult, daysResult] = await Promise.all([
        admin
          .from('programs')
          .select('id, name, duration_weeks, sessions_per_week')
          .eq('id', assignment.program_id)
          .maybeSingle(),
        admin
          .from('program_days')
          .select('id, day_number, name')
          .eq('program_id', assignment.program_id)
          .order('day_number'),
      ]);

      const prog = progResult.data as {
        id: string; name: string; duration_weeks: number | null; sessions_per_week: number | null;
      } | null;
      const days = (daysResult.data ?? []) as Array<{ id: string; day_number: number; name: string }>;

      if (prog) {
        const totalWeeks = prog.duration_weeks || 1;
        const elapsed = daysSince(assignment.assigned_at);
        const weekNumber = Math.min(Math.floor(elapsed / 7) + 1, totalWeeks);
        const sessionsTotal = (prog.duration_weeks || 0) * (prog.sessions_per_week || 0);

        // Sessions completed since the program was assigned
        const { count: completedCount } = await admin
          .from('workout_sessions')
          .select('id', { count: 'exact', head: true })
          .eq('member_id', member_id)
          .gte('session_date', assignment.assigned_at.split('T')[0])
          .not('completed_at', 'is', null);

        // Today's day in the rotation → exercise list
        let todayExercises: Array<{ name: string; sets: number; reps: number }> = [];
        if (days.length > 0) {
          const todayDay = days[elapsed % days.length];
          const { data: dayExercises } = await admin
            .from('program_exercises')
            .select('exercise_name, default_sets, default_reps, order_index')
            .eq('program_day_id', todayDay.id)
            .order('order_index');
          todayExercises = ((dayExercises ?? []) as Array<{
            exercise_name: string; default_sets: number | null; default_reps: number | null;
          }>).map((e) => ({
            name: e.exercise_name,
            sets: e.default_sets || 0,
            reps: e.default_reps || 0,
          }));
        }

        programData = {
          program_id: prog.id,
          program_name: prog.name,
          week_number: weekNumber,
          total_weeks: totalWeeks,
          sessions_completed: completedCount || 0,
          sessions_total: sessionsTotal,
          today_exercises: todayExercises,
          progress_pct: sessionsTotal > 0
            ? Math.min(100, Math.round(((completedCount || 0) / sessionsTotal) * 100))
            : 0,
          is_complete: false,
        };
      }
    }

    // Path B: AI program (assignment carries ai_program_id, or legacy
    // fallback to the latest active ai_programs row when no assignment exists)
    if (!programData) {
      interface AiProgramRow {
        id: string; title: string; duration_weeks: number | null;
        sessions_per_week: number | null; program_data: unknown;
        week_number: number | null; sessions_completed: number | null;
        sessions_total: number | null; completed_at: string | null; created_at: string;
      }
      const aiSelect = 'id, title, duration_weeks, sessions_per_week, program_data, week_number, sessions_completed, sessions_total, completed_at, created_at';
      let aiProgramRow: AiProgramRow | null = null;

      if (assignment?.ai_program_id) {
        const { data } = await admin
          .from('ai_programs')
          .select(aiSelect)
          .eq('id', assignment.ai_program_id)
          .maybeSingle();
        aiProgramRow = data as AiProgramRow | null;
      } else if (!assignment) {
        const { data } = await admin
          .from('ai_programs')
          .select(aiSelect)
          .eq('member_id', member_id)
          .eq('is_active', true)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        aiProgramRow = data as AiProgramRow | null;
      }

      if (aiProgramRow) {
        isProgramComplete = !!aiProgramRow.completed_at;
        const jsonDays = extractAiProgramDays(aiProgramRow.program_data);
        const assignedAt = assignment?.assigned_at ?? aiProgramRow.created_at;
        const elapsed = daysSince(assignedAt);
        const totalWeeks = aiProgramRow.duration_weeks || 1;
        const weekNumber = aiProgramRow.week_number
          || Math.min(Math.floor(elapsed / 7) + 1, totalWeeks);
        const sessionsTotal = aiProgramRow.sessions_total
          ?? (aiProgramRow.duration_weeks || 0) * (aiProgramRow.sessions_per_week || 0);
        const sessionsCompleted = aiProgramRow.sessions_completed || 0;

        const todayDay = jsonDays.length > 0 ? jsonDays[elapsed % jsonDays.length] : null;
        const todayExercises = (todayDay?.exercises ?? []).map((e) => ({
          name: e.exercise_name || 'Exercise',
          sets: e.default_sets || 0,
          reps: e.default_reps || 0,
        }));

        programData = {
          program_id: aiProgramRow.id,
          program_name: aiProgramRow.title,
          week_number: weekNumber,
          total_weeks: totalWeeks,
          sessions_completed: sessionsCompleted,
          sessions_total: sessionsTotal,
          today_exercises: todayExercises,
          progress_pct: sessionsTotal > 0
            ? Math.min(100, Math.round((sessionsCompleted / sessionsTotal) * 100))
            : 0,
          is_complete: isProgramComplete,
        };
      }
    }

    // Check if leveled up recently (within last 24 hours)
    const leveledUpRecently = member.leveled_up_at
      ? (Date.now() - new Date(member.leveled_up_at).getTime()) < 86400000
      : false;

    const levelProgress = computeLevelProgress(member.smartgym_score || 0);

    const todaySessions = todaySessionsResult.data || [];
    const trainedToday = todaySessions.length > 0;

    // Check if PR was recent (last 24 hours)
    const recentPR = lastSession?.is_personal_best && lastSession.completed_at
      ? (Date.now() - new Date(lastSession.completed_at).getTime()) < 86400000
      : false;

    const hasUnreadCheckIn = !!unreadCheckInResult.data;

    const hero = computeHeroState({
      firstName: member.first_name || member.display_name || 'there',
      leveledUp: leveledUpRecently,
      newLevelName: leveledUpRecently ? levelProgress.current.name : null,
      newLevelNumber: leveledUpRecently ? levelProgress.current.level : null,
      programComplete: isProgramComplete,
      programName: programData?.program_name || null,
      recentPR,
      prExercise: recentPR && lastSession ? (lastSession.machines?.name || null) : null,
      currentStreak: member.current_streak || 0,
      daysSinceLastWorkout,
      hasProgram: !!programData && !isProgramComplete,
      programWeek: programData?.week_number || null,
      programTotalWeeks: programData?.total_weeks || null,
      trainedToday,
      todaySessions: todaySessions.length,
      hasUnreadCheckIn,
    });

    // Build challenge data
    let challengeData = null;
    const cp = challengeResult.data as {
      id: string; challenge_id: string; current_score: number; current_rank: number;
      challenges: { id: string; title: string; end_date: string } | null;
    } | null;
    if (cp) {
      const challenge = cp.challenges;
      if (challenge) {
        const daysLeft = Math.max(0, Math.ceil((new Date(challenge.end_date).getTime() - Date.now()) / 86400000));
        // Get participant count with a separate count query
        const { count: participantCount } = await admin
          .from('challenge_participants')
          .select('id', { count: 'exact', head: true })
          .eq('challenge_id', challenge.id);
        challengeData = {
          challenge_id: challenge.id,
          title: challenge.title,
          rank: cp.current_rank || 0,
          total_participants: participantCount || 0,
          progress_pct: 0,
          days_left: daysLeft,
        };
      }
    }

    // Build feed — reaction_count comes from feed_reactions (comment_count
    // is a different metric and used to be passed off as reactions here).
    const feedRows = (feedResult.data || []) as Array<Record<string, unknown>>;
    const feedEventIds = feedRows.map((e) => e.id as string);
    const reactionCountByEvent = new Map<string, number>();
    if (feedEventIds.length > 0) {
      const { data: feedReactions } = await admin
        .from('feed_reactions')
        .select('event_id')
        .in('event_id', feedEventIds);
      for (const r of (feedReactions ?? []) as Array<{ event_id: string }>) {
        reactionCountByEvent.set(r.event_id, (reactionCountByEvent.get(r.event_id) ?? 0) + 1);
      }
    }

    const feed = feedRows.map((e: Record<string, unknown>) => ({
      id: e.id as string,
      event_type: e.event_type as string,
      member_name: ((e.members as { display_name: string } | null)?.display_name) || 'Member',
      description: e.display_text as string,
      created_at: e.created_at as string,
      reaction_count: reactionCountByEvent.get(e.id as string) ?? 0,
      context_data: (e.context_data as Record<string, unknown>) || {},
    }));

    // Build stats
    const [weekSessions, monthPRs, allTimeSessions] = statsResult;
    const weekData = weekSessions.data || [];
    const allTimeData = allTimeSessions.data || [];

    const stats = {
      sessions_this_week: weekData.length,
      volume_this_week_lbs: weekData.reduce((sum: number, s: { total_volume_lbs: number }) => sum + (s.total_volume_lbs || 0), 0),
      prs_this_month: (monthPRs.data || []).length,
      all_time_sessions: allTimeData.length,
      all_time_volume_lbs: allTimeData.reduce((sum: number, s: { total_volume_lbs: number }) => sum + (s.total_volume_lbs || 0), 0),
    };

    const response: HomeScreenData = {
      hero: {
        variant: hero.variant,
        greeting: hero.greeting,
        headline: hero.headline,
        subline: hero.subline,
        metric: hero.metric,
        gradient: hero.gradient,
        accent: hero.accent,
      },
      level: {
        level: levelProgress.current.level,
        name: levelProgress.current.name,
        color: levelProgress.current.color,
        progressPct: levelProgress.progressPct,
        pointsToNext: levelProgress.pointsToNext,
        score: levelProgress.score,
      },
      today_sessions: todaySessions.map((s: Record<string, unknown>) => ({
        id: s.id as string,
        machine_name: ((s.machines as { name: string } | null)?.name) || 'Unknown',
        sets_count: (s.sets_count as number) || 0,
        total_volume_lbs: (s.total_volume_lbs as number) || 0,
        completed_at: s.completed_at as string | null,
      })),
      program: programData,
      challenge: challengeData,
      feed,
      stats,
      readiness: readinessResult ?? null,
      muscleMap: muscleMapResult ?? null,
    };

    return NextResponse.json(response);
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

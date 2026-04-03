import { NextRequest, NextResponse } from 'next/server';
import { computeHeroState, computeLevelProgress } from '@nexera/ai-assist';
import { memberHomeQuerySchema } from '@/lib/validation/member';
import { verifyMember } from '@/lib/auth/verifyMember';
import { getReadinessScore } from '@/lib/readiness/readinessCache';
import { getMuscleMap } from '@/lib/muscleMap/muscleMapCache';
import type { HomeScreenData } from '@nexera/types';

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

    const { member_id, gym_id } = parsed.data;

    // Verify the caller owns this member_id
    const authResult = await verifyMember(member_id);
    if (authResult instanceof NextResponse) return authResult;
    const { admin } = authResult;
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

      // 3. Active program context
      admin
        .from('member_program_assignments')
        .select(`
          id, program_id, current_week, sessions_completed, is_active,
          ai_programs(id, title, total_weeks, total_sessions, status)
        `)
        .eq('member_id', member_id)
        .eq('gym_id', gym_id)
        .eq('is_active', true)
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
        .select('id, event_type, display_text, context_data, created_at, comment_count, member_id, members(display_name)')
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

    const program = programResult.data as {
      id: string; program_id: string; current_week: number;
      sessions_completed: number; is_active: boolean;
      ai_programs: { id: string; title: string; total_weeks: number; total_sessions: number; status: string } | null;
    } | null;
    const aiProgram = program?.ai_programs ?? null;
    const isProgramComplete = aiProgram?.status === 'completed';

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
      programName: aiProgram?.title || null,
      recentPR,
      prExercise: recentPR && lastSession ? (lastSession.machines?.name || null) : null,
      currentStreak: member.current_streak || 0,
      daysSinceLastWorkout,
      hasProgram: !!program && !isProgramComplete,
      programWeek: program?.current_week || null,
      programTotalWeeks: aiProgram?.total_weeks || null,
      trainedToday,
      todaySessions: todaySessions.length,
      hasUnreadCheckIn,
    });

    // Build program context
    let programData = null;
    if (program && aiProgram && !isProgramComplete) {
      const progressPct = aiProgram.total_sessions > 0
        ? Math.round((program.sessions_completed / aiProgram.total_sessions) * 100)
        : 0;
      programData = {
        program_id: aiProgram.id,
        program_name: aiProgram.title,
        week_number: program.current_week || 1,
        total_weeks: aiProgram.total_weeks,
        sessions_completed: program.sessions_completed || 0,
        sessions_total: aiProgram.total_sessions,
        today_exercises: [], // Populated when program day endpoint is built
        progress_pct: progressPct,
        is_complete: false,
      };
    }

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

    // Build feed
    const feed = (feedResult.data || []).map((e: Record<string, unknown>) => ({
      id: e.id as string,
      event_type: e.event_type as string,
      member_name: ((e.members as { display_name: string } | null)?.display_name) || 'Member',
      description: e.display_text as string,
      created_at: e.created_at as string,
      reaction_count: (e.comment_count as number) || 0,
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

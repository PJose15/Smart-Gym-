import { NextRequest, NextResponse } from 'next/server';
import { runAfterResponse } from '@/lib/asyncWork';
import { z } from 'zod';
import { checkAchievementsForMember } from '@/lib/achievements';
import { generateSessionFeedEvents } from '@/lib/feedGenerator';
import { updateChallengeScores } from '@/lib/challengeScoring';
import { invalidateAndRefreshReadiness } from '@/lib/readiness/readinessCache';
import { invalidateAndRefreshMuscleMap } from '@/lib/muscleMap/muscleMapCache';
import { verifyMember } from '@/lib/auth/verifyMember';
import { validateUUIDs, uuidString } from '@/lib/validation/uuid';
import { checkRateLimit } from '@/lib/rateLimit';
import { triggerUptimizeAIAgent } from '@/lib/billing/triggerAgent';
import { sendSessionCompletePush } from '@/lib/notifications/sessionPush';

const completeSchema = z.object({
  member_id: uuidString,
});

interface RouteParams {
  params: Promise<{ sessionId: string }>;
}

/**
 * POST /api/sessions/[sessionId]/complete
 * Finalizes a workout session: sets completed_at, awards points,
 * computes streak, updates member stats.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { sessionId } = await params;
    const uuidError = validateUUIDs({ sessionId });
    if (uuidError) return uuidError;
    const body = await request.json();
    const parsed = completeSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }

    const { member_id } = parsed.data;

    // Verify the authenticated user owns this member_id (cookie or Bearer JWT)
    const authResult = await verifyMember(member_id, request);
    if (authResult instanceof NextResponse) return authResult;
    const { admin } = authResult;

    const rl = checkRateLimit(`session-complete:${member_id}`, 10, 60_000);
    if (rl) return rl;

    // Atomically claim the completion (M-6): the conditional update only
    // succeeds for the first caller, so concurrent requests can't double-
    // award points/achievements/pushes.
    const { data: session, error: claimError } = await admin
      .from('workout_sessions')
      .update({ completed_at: new Date().toISOString() })
      .eq('id', sessionId)
      .eq('member_id', member_id)
      .is('completed_at', null)
      .select('id, gym_id, member_id, sets_count, total_volume_lbs, best_weight_lbs, is_personal_best, session_date')
      .maybeSingle();

    if (claimError) {
      console.error('Session completion claim error:', claimError);
      return NextResponse.json({ error: 'Failed to complete session' }, { status: 500 });
    }

    if (!session) {
      // Either the session doesn't exist / isn't this member's, or it was
      // already completed — distinguish for the response.
      const { data: existing } = await admin
        .from('workout_sessions')
        .select('id, sets_count, total_volume_lbs, best_weight_lbs, is_personal_best, completed_at')
        .eq('id', sessionId)
        .eq('member_id', member_id)
        .maybeSingle();

      if (!existing) {
        return NextResponse.json({ error: 'Session not found' }, { status: 404 });
      }
      if (!existing.completed_at) {
        // The row exists and is still open, yet the claim didn't take it —
        // a transient failure, NOT idempotent success. Tell the client to
        // retry rather than silently dropping the completion.
        return NextResponse.json({ error: 'Failed to complete session' }, { status: 500 });
      }
      return NextResponse.json({
        success: true,
        already_completed: true,
        summary: {
          session_id: sessionId,
          sets_count: existing.sets_count,
          total_volume_lbs: existing.total_volume_lbs,
          best_weight_lbs: existing.best_weight_lbs,
          is_personal_best: existing.is_personal_best,
          points_awarded: 0,
          streak: null,
        },
      });
    }

    // Fetch member data + recent sessions + total session count in parallel
    const points = 50;
    const [memberResult, recentSessionsResult, sessionCountResult] = await Promise.all([
      admin.from('members').select('smartgym_score, best_streak, current_streak, display_name').eq('id', member_id).single(),
      admin.from('workout_sessions').select('session_date').eq('member_id', member_id)
        .not('completed_at', 'is', null).order('session_date', { ascending: false }).limit(30),
      admin.from('workout_sessions').select('id', { count: 'exact', head: true }).eq('member_id', member_id)
        .not('completed_at', 'is', null),
    ]);

    const scoreBeforeSession = memberResult.data?.smartgym_score || 0;
    const bestStreak = memberResult.data?.best_streak || 0;
    const previousStreak = memberResult.data?.current_streak || 0;
    const displayName = memberResult.data?.display_name || 'Member';
    const totalSessions = sessionCountResult.count || 0;

    // Compute streak
    let streak = 1;
    const recentSessions = recentSessionsResult.data;
    if (recentSessions && recentSessions.length > 1) {
      const dates = [...new Set(recentSessions.map((s) => s.session_date))].sort().reverse();
      for (let i = 1; i < dates.length; i++) {
        const curr = new Date(dates[i - 1]);
        const prev = new Date(dates[i]);
        const diffDays = Math.round((curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays <= 3) { streak++; } else { break; }
      }
    }

    // Single combined member update
    await admin
      .from('members')
      .update({
        smartgym_score: scoreBeforeSession + points,
        current_streak: streak,
        best_streak: Math.max(streak, bestStreak),
        streak_last_updated: session.session_date,
        last_session_date: session.session_date,
        last_seen_at: new Date().toISOString(),
      })
      .eq('id', member_id);

    // Check achievements and level-ups (pass original score for accurate level-up detection)
    const achievements = await checkAchievementsForMember(admin, member_id, session.gym_id, scoreBeforeSession);

    // Agent: level-up (fire-and-forget)
    if (achievements.leveledUp) {
      runAfterResponse(triggerUptimizeAIAgent('engagement-agent', {
        event: 'level-up',
        gym_id: session.gym_id,
        member_id,
        new_level: achievements.newLevel?.level ?? null,
        is_agent_initiated: false,
      }).catch(err => console.error('[session-complete] level-up agent trigger failed:', err instanceof Error ? err.message : 'Unknown error')));
    }

    // Agent: streak-broken â€” only when a real streak (>1) just reset to 1 (fire-and-forget)
    if (previousStreak > 1 && streak === 1) {
      runAfterResponse(triggerUptimizeAIAgent('engagement-agent', {
        event: 'streak-broken',
        gym_id: session.gym_id,
        member_id,
        previous_streak: previousStreak,
        is_agent_initiated: false,
      }).catch(err => console.error('[session-complete] streak-broken agent trigger failed:', err instanceof Error ? err.message : 'Unknown error')));
    }

    // Generate feed events (fire-and-forget)
    runAfterResponse(generateSessionFeedEvents(admin, {
      member_id,
      gym_id: session.gym_id,
      display_name: displayName,
      is_personal_best: session.is_personal_best ?? false,
      best_weight_lbs: session.best_weight_lbs,
      streak,
      total_sessions: totalSessions,
      leveled_up: achievements.leveledUp,
      new_level: achievements.newLevel?.level ?? null,
    }).catch(err => console.error('[session-complete] feed event generation failed:', err instanceof Error ? err.message : 'Unknown error')));

    // Update challenge scores (fire-and-forget)
    runAfterResponse(updateChallengeScores(admin, member_id, session.gym_id, {
      total_volume_lbs: session.total_volume_lbs || 0,
      is_personal_best: session.is_personal_best ?? false,
      machine_id: null,
      session_id: session.id,
    }).catch(err => console.error('[session-complete] challenge scoring failed:', err instanceof Error ? err.message : 'Unknown error')));

    // Agent: leaderboard-updated â€” unconditional; 24h/member cooldown in trigger route caps flooding (fire-and-forget)
    runAfterResponse(triggerUptimizeAIAgent('engagement-agent', {
      event: 'leaderboard-updated',
      gym_id: session.gym_id,
      member_id,
      session_id: session.id,
      is_agent_initiated: false,
    }).catch(err => console.error('[session-complete] leaderboard-updated agent trigger failed:', err instanceof Error ? err.message : 'Unknown error')));

    // Push notification: coalesced session-complete push (at most one push per session — NOTIF-02)
    runAfterResponse(sendSessionCompletePush({
      gym_id: session.gym_id,
      member_id,
      leveledUp: achievements.leveledUp,
      badgesUnlocked: achievements.newAchievements.length,
      isPersonalBest: session.is_personal_best ?? false,
      streak,
      previousStreak,
    }).catch(err => console.error('[session-complete] push failed:', err instanceof Error ? err.message : 'Unknown error')));

    // Invalidate and refresh readiness score + muscle map (fire-and-forget)
    runAfterResponse(invalidateAndRefreshReadiness(member_id, session.gym_id, admin).catch(() => {}));
    runAfterResponse(invalidateAndRefreshMuscleMap(member_id, session.gym_id, admin).catch(() => {}));

    return NextResponse.json({
      success: true,
      summary: {
        session_id: sessionId,
        sets_count: session.sets_count,
        total_volume_lbs: session.total_volume_lbs,
        best_weight_lbs: session.best_weight_lbs,
        is_personal_best: session.is_personal_best,
        points_awarded: points,
        streak,
      },
      new_achievements: achievements.newAchievements,
      leveled_up: achievements.leveledUp,
      new_level: achievements.newLevel,
    });
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

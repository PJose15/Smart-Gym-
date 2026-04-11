import { NextResponse } from 'next/server';
import { verifyStaff } from '@/lib/auth/verifyStaff';
import type { TrainerTodayData, AttentionItem, TrainingNowMember, TodaySessionSummary, RecentPR } from '@nexera/types';

export async function GET() {
  try {
    const result = await verifyStaff();
    if (result instanceof NextResponse) return result;

    const { admin, user_id, gym_id } = result;

    // Today as YYYY-MM-DD for session_date filter
    const now = new Date();
    const todayDate = now.toISOString().slice(0, 10);

    // Get trainer's assigned members directly from the members table.
    // Hard cap at 500 — a single trainer's roster never realistically
    // exceeds this.
    const { data: members } = await admin
      .from('members')
      .select('id, user_id, display_name, avatar_url, last_session_date')
      .eq('gym_id', gym_id)
      .eq('assigned_trainer_id', user_id)
      .limit(500);

    const memberMap = new Map((members ?? []).map((m) => [m.id, m]));
    const memberIds = (members ?? []).map((m) => m.id);

    // Parallel queries
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);

    const [sessionsRes, prsRes] = await Promise.all([
      // Today's sessions for assigned members (each row = one machine)
      memberIds.length > 0
        ? admin
            .from('workout_sessions')
            .select('id, member_id, machine_id, session_date, sets_count, total_volume_lbs, total_reps, completed_at, created_at')
            .eq('gym_id', gym_id)
            .in('member_id', memberIds)
            .eq('session_date', todayDate)
            .order('created_at', { ascending: false })
        : { data: [] },
      // Recent PRs (last 7 days) — PR data lives in workout_sessions
      memberIds.length > 0
        ? admin
            .from('workout_sessions')
            .select('member_id, machine_id, best_weight_lbs, personal_best_type, pr_improvement_lbs, pr_improvement_pct, created_at, machines(name)')
            .eq('gym_id', gym_id)
            .eq('is_personal_best', true)
            .in('member_id', memberIds)
            .gte('session_date', sevenDaysAgo)
            .order('created_at', { ascending: false })
            .limit(10)
        : { data: [] },
    ]);

    const sessions = sessionsRes.data ?? [];
    const prs = prsRes.data ?? [];

    // Build per-member aggregates for today's sessions
    const exerciseCountByMember = new Map<string, number>();
    const setCountByMember = new Map<string, number>();
    const earliestSessionByMember = new Map<string, string>();

    sessions.forEach((s) => {
      exerciseCountByMember.set(s.member_id, (exerciseCountByMember.get(s.member_id) ?? 0) + 1);
      setCountByMember.set(s.member_id, (setCountByMember.get(s.member_id) ?? 0) + (s.sets_count ?? 0));

      const current = earliestSessionByMember.get(s.member_id);
      if (!current || s.created_at < current) {
        earliestSessionByMember.set(s.member_id, s.created_at);
      }
    });

    // Build attention items
    const attention_items: AttentionItem[] = [];
    const atRiskDays = 14;
    const atRiskDate = new Date(Date.now() - atRiskDays * 86400000);

    (members ?? []).forEach((m) => {
      if (m.last_session_date && new Date(m.last_session_date) < atRiskDate) {
        attention_items.push({
          type: 'at_risk',
          member_name: m.display_name ?? 'Unknown',
          member_id: m.id,
          description: `No session in ${Math.floor((Date.now() - new Date(m.last_session_date).getTime()) / 86400000)} days`,
        });
      }
    });

    // Members training now: members with at least one session today where completed_at IS NULL
    const trainingNowMemberIds = new Set<string>();
    sessions.forEach((s) => {
      if (!s.completed_at) {
        trainingNowMemberIds.add(s.member_id);
      }
    });

    const members_training_now: TrainingNowMember[] = Array.from(trainingNowMemberIds).map((memberId) => {
      const m = memberMap.get(memberId);
      return {
        member_id: memberId,
        member_name: m?.display_name ?? 'Unknown',
        avatar_url: m?.avatar_url ?? null,
        started_at: earliestSessionByMember.get(memberId) ?? now.toISOString(),
        exercises_count: exerciseCountByMember.get(memberId) ?? 0,
      };
    });

    // Today's sessions — one summary per member
    const seenMembers = new Set<string>();
    const todays_sessions: TodaySessionSummary[] = [];

    const latestCompletedByMember = new Map<string, string | null>();
    const allCompletedByMember = new Map<string, boolean>();
    const earliestSessionIdByMember = new Map<string, string>();

    sessions.forEach((s) => {
      if (!allCompletedByMember.has(s.member_id)) {
        allCompletedByMember.set(s.member_id, true);
      }
      if (!s.completed_at) {
        allCompletedByMember.set(s.member_id, false);
      } else {
        const current = latestCompletedByMember.get(s.member_id);
        if (!current || s.completed_at > current) {
          latestCompletedByMember.set(s.member_id, s.completed_at);
        }
      }

      if (s.created_at === earliestSessionByMember.get(s.member_id)) {
        earliestSessionIdByMember.set(s.member_id, s.id);
      }
    });

    sessions.forEach((s) => {
      if (seenMembers.has(s.member_id)) return;
      seenMembers.add(s.member_id);

      const m = memberMap.get(s.member_id);
      const allDone = allCompletedByMember.get(s.member_id) ?? false;

      todays_sessions.push({
        session_id: earliestSessionIdByMember.get(s.member_id) ?? s.id,
        member_id: s.member_id,
        member_name: m?.display_name ?? 'Unknown',
        started_at: earliestSessionByMember.get(s.member_id) ?? s.created_at,
        finished_at: allDone ? (latestCompletedByMember.get(s.member_id) ?? null) : null,
        exercises_count: exerciseCountByMember.get(s.member_id) ?? 0,
        total_sets: setCountByMember.get(s.member_id) ?? 0,
      });
    });

    // Recent PRs
    const recent_prs: RecentPR[] = prs.map((p) => {
      const m = memberMap.get(p.member_id);
      const machineName = (p.machines as unknown as { name: string } | null)?.name ?? 'Unknown Exercise';
      return {
        member_name: m?.display_name ?? 'Unknown',
        member_id: p.member_id,
        exercise_name: machineName,
        value: p.best_weight_lbs ?? 0,
        pr_type: p.personal_best_type ?? 'weight',
        achieved_at: p.created_at,
      };
    });

    const response: TrainerTodayData = {
      attention_items,
      members_training_now,
      todays_sessions,
      recent_prs,
    };

    return NextResponse.json(response);
  } catch (err) {
    console.error('[trainer/today] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

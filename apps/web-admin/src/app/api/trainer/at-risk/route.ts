import { NextResponse } from 'next/server';
import { verifyStaff } from '@/lib/auth/verifyStaff';
import { computeAtRiskMembers } from '@nexera/ai-assist';
import type { MemberData } from '@nexera/ai-assist';

export const dynamic = 'force-dynamic';

/**
 * GET /api/trainer/at-risk
 * At-risk members for the calling trainer (their active assignments in the
 * caller's gym).
 *
 * ST-H3: `feedback_discomfort_summary` is own-rows-only under RLS and
 * `workout_sessions` trainer reads depend on `members.assigned_trainer_id`,
 * so client-side reads silently return zero rows and staff decide from wrong
 * data. This route runs the same aggregation with the service-role admin
 * client, scoped to the caller's gym + assignments.
 */
export async function GET() {
  const result = await verifyStaff();
  if (result instanceof NextResponse) return result;

  try {
    const { admin, gym_id, user_id } = result;

    // Members assigned to this trainer in this gym (user ids)
    const { data: assignments, error: assignErr } = await admin
      .from('trainer_assignments')
      .select('member_profile_id')
      .eq('trainer_profile_id', user_id)
      .eq('gym_id', gym_id)
      .eq('status', 'active');

    if (assignErr) {
      console.error('[/api/trainer/at-risk] Assignments error:', assignErr);
      return NextResponse.json({ error: 'Failed to load assignments' }, { status: 500 });
    }

    const memberUserIds = Array.from(
      new Set((assignments ?? []).map((a) => a.member_profile_id).filter((id): id is string => !!id)),
    );

    if (memberUserIds.length === 0) {
      return NextResponse.json({ members: [] });
    }

    // trainer_assignments.member_profile_id is a users.id; workout_sessions
    // keys on members.id — map through the members table (gym-scoped).
    const { data: memberRows, error: memberErr } = await admin
      .from('members')
      .select('id, user_id')
      .eq('gym_id', gym_id)
      .in('user_id', memberUserIds);

    if (memberErr) {
      console.error('[/api/trainer/at-risk] Members error:', memberErr);
      return NextResponse.json({ error: 'Failed to load members' }, { status: 500 });
    }

    const memberRowIds = (memberRows ?? []).map((m) => m.id);
    const userIdByMemberId = new Map<string, string | null>(
      (memberRows ?? []).map((m) => [m.id, m.user_id]),
    );

    const [usersRes, sessionsRes, discomfortRes] = await Promise.all([
      admin.from('users').select('id, display_name, email').in('id', memberUserIds),
      memberRowIds.length > 0
        ? admin
            .from('workout_sessions')
            .select('member_id, completed_at')
            .in('member_id', memberRowIds)
            .not('completed_at', 'is', null)
            .order('completed_at', { ascending: false })
            .limit(1000)
        : Promise.resolve({ data: [] as { member_id: string; completed_at: string }[], error: null }),
      admin
        .from('feedback_discomfort_summary')
        .select('profile_id, discomfort_count_7d, top_body_areas_7d')
        .in('profile_id', memberUserIds),
    ]);

    if (usersRes.error) {
      console.error('[/api/trainer/at-risk] Users error:', usersRes.error);
      return NextResponse.json({ error: 'Failed to load member names' }, { status: 500 });
    }
    if (sessionsRes.error) {
      console.error('[/api/trainer/at-risk] Sessions error:', sessionsRes.error);
      return NextResponse.json({ error: 'Failed to load sessions' }, { status: 500 });
    }

    const namesById = new Map<string, string>(
      (usersRes.data ?? []).map((u) => [u.id, u.display_name ?? u.email ?? 'Unknown']),
    );

    // Most recent completed session per user id (rows are sorted desc)
    const lastCompletedByUser = new Map<string, string>();
    for (const s of sessionsRes.data ?? []) {
      const uid = userIdByMemberId.get(s.member_id);
      if (!uid || lastCompletedByUser.has(uid)) continue;
      if (s.completed_at) lastCompletedByUser.set(uid, s.completed_at);
    }

    const discomfortByProfile = new Map(
      (discomfortRes.data ?? []).map((d) => [d.profile_id, d]),
    );

    const memberDataList: MemberData[] = memberUserIds.map((uid) => {
      const discomfort = discomfortByProfile.get(uid);
      return {
        profileId: uid,
        memberName: namesById.get(uid) ?? 'Unknown',
        lastWorkoutAt: lastCompletedByUser.get(uid) ?? null,
        discomfortCount7d: discomfort?.discomfort_count_7d ?? 0,
        discomfortBodyAreas: discomfort?.top_body_areas_7d ?? [],
        plateauExercises: [], // Plateau detection requires additional query logic
      };
    });

    return NextResponse.json({ members: computeAtRiskMembers(memberDataList) });
  } catch (err) {
    console.error('[/api/trainer/at-risk] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

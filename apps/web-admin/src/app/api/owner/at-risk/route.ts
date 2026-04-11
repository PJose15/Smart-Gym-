import { NextResponse } from 'next/server';
import { verifyStaff } from '@/lib/auth/verifyStaff';
import { computeAtRiskMembers } from '@nexera/ai-assist';
import type { MemberData } from '@nexera/ai-assist';

export async function GET() {
  try {
    const result = await verifyStaff('owner');
    if (result instanceof NextResponse) return result;

    const { admin, gym_id } = result;

    // Fetch active members + their most recent workout.
    // "At-risk" is computed from days-since-last-workout, so we only need
    // sessions from the last 30 days: any member with no row in that
    // window is already flagged (lastWorkoutAt = null). This bounds the
    // query to one month of gym activity instead of all-time history.
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();

    const [membersRes, sessionsRes] = await Promise.all([
      admin
        .from('members')
        .select('id, display_name')
        .eq('gym_id', gym_id)
        .eq('status', 'active'),
      admin
        .from('workout_sessions')
        .select('member_id, created_at')
        .eq('gym_id', gym_id)
        .gte('created_at', thirtyDaysAgo)
        .order('created_at', { ascending: false }),
    ]);

    const members = membersRes.data ?? [];
    const sessions = sessionsRes.data ?? [];

    // Build last-workout map (first occurrence = most recent due to desc order)
    const lastWorkoutMap = new Map<string, string>();
    sessions.forEach((s) => {
      if (!lastWorkoutMap.has(s.member_id)) {
        lastWorkoutMap.set(s.member_id, s.created_at);
      }
    });

    // Build MemberData array — discomfort/plateau data not available in schema,
    // so at-risk detection is based on workout recency only
    const memberData: MemberData[] = members.map((m) => ({
      profileId: m.id,
      memberName: m.display_name,
      lastWorkoutAt: lastWorkoutMap.get(m.id) ?? null,
      discomfortCount7d: 0,
      discomfortBodyAreas: [],
      plateauExercises: [],
    }));

    const atRisk = computeAtRiskMembers(memberData);

    return NextResponse.json(atRisk);
  } catch (err) {
    console.error('[owner/at-risk] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

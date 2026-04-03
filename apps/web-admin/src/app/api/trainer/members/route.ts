import { NextResponse } from 'next/server';
import { verifyStaff } from '@/lib/auth/verifyStaff';
import type { TrainerMemberListItem } from '@nexera/types';

export async function GET() {
  try {
    const result = await verifyStaff();
    if (result instanceof NextResponse) return result;

    const { admin, user_id, gym_id } = result;

    // Get members assigned to this trainer directly from the members table
    const { data: members } = await admin
      .from('members')
      .select('id, user_id, display_name, avatar_url, last_session_date, current_streak')
      .eq('gym_id', gym_id)
      .eq('assigned_trainer_id', user_id);

    if (!members || members.length === 0) {
      return NextResponse.json([]);
    }

    const memberIds = members.map((m) => m.id);

    // Get active programs for all members
    const { data: activePrograms } = await admin
      .from('ai_programs')
      .select('member_id')
      .in('member_id', memberIds)
      .eq('is_active', true);

    const programMembers = new Set((activePrograms ?? []).map((p) => p.member_id));

    // Get completed sessions count
    const { data: sessionRows } = await admin
      .from('workout_sessions')
      .select('member_id')
      .eq('gym_id', gym_id)
      .in('member_id', memberIds)
      .not('completed_at', 'is', null);

    // Count sessions per member
    const sessionCounts = new Map<string, number>();
    (sessionRows ?? []).forEach((s) => {
      sessionCounts.set(s.member_id, (sessionCounts.get(s.member_id) ?? 0) + 1);
    });

    const atRiskDate = new Date(Date.now() - 14 * 86400000);

    const items: TrainerMemberListItem[] = members.map((m) => {
      let status: 'active' | 'at_risk' | 'inactive' = 'active';
      if (!m.last_session_date) {
        status = 'inactive';
      } else if (new Date(m.last_session_date) < atRiskDate) {
        status = 'at_risk';
      }

      return {
        member_id: m.id,
        member_name: m.display_name ?? 'Unknown',
        avatar_url: m.avatar_url ?? null,
        last_session_date: m.last_session_date ?? null,
        total_sessions: sessionCounts.get(m.id) ?? 0,
        current_streak: m.current_streak ?? 0,
        status,
        has_program: programMembers.has(m.id),
      };
    });

    // Sort: at_risk first, then by name
    items.sort((a, b) => {
      const statusOrder = { at_risk: 0, active: 1, inactive: 2 };
      const diff = statusOrder[a.status] - statusOrder[b.status];
      if (diff !== 0) return diff;
      return a.member_name.localeCompare(b.member_name);
    });

    return NextResponse.json(items);
  } catch (err) {
    console.error('[trainer/members] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

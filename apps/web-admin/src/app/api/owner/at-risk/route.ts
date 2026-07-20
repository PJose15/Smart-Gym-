import { NextResponse } from 'next/server';
import { verifyStaff } from '@/lib/auth/verifyStaff';
import { fetchGymAtRiskMembers } from '@/lib/agents/atRiskScan';
import { triggerUptimizeAIAgent } from '@/lib/billing/triggerAgent';

export async function GET() {
  try {
    const result = await verifyStaff('owner');
    if (result instanceof NextResponse) return result;

    const { admin, gym_id } = result;

    const atRisk = await fetchGymAtRiskMembers(admin, gym_id);

    // Fire retention-agent per at-risk member (fire-and-forget).
    // The 7-day per-(gym, agent, event, member) cooldown in the trigger route
    // absorbs repeated dashboard visits — no double-firing within the window.
    // member_id is always set to profileId (never null — Pitfall 4).
    atRisk.forEach((m) => {
      triggerUptimizeAIAgent('retention-agent', {
        event: 'member-at-risk',
        gym_id,
        member_id: m.profileId,
        is_agent_initiated: false,
      }).catch(console.error);
    });

    return NextResponse.json(atRisk);
  } catch (err) {
    console.error('[owner/at-risk] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

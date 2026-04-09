import { NextRequest, NextResponse } from 'next/server';
import { verifyMember } from '@/lib/auth/verifyMember';
import { validateUUIDs } from '@/lib/validation/uuid';

export async function GET(
  _req: NextRequest,
  { params }: { params: { memberId: string } }
) {
  try {
    const uuidError = validateUUIDs({ memberId: params.memberId });
    if (uuidError) return uuidError;
    const auth = await verifyMember(params.memberId);
    if (auth instanceof NextResponse) return auth;
    const { admin } = auth;

    const { data: cache } = await admin
      .from('member_muscle_cache')
      .select('muscle_group, recovery_state, last_trained_at')
      .eq('member_id', params.memberId);

    const recommendations = (cache ?? []).map((m) => {
      let recommendation = 'Ready to train';
      if (m.recovery_state === 'sore')
        recommendation = 'Rest — still recovering';
      else if (m.recovery_state === 'recovering')
        recommendation = 'Light work only';
      else if (m.recovery_state === 'fresh')
        recommendation = 'Good to go — prioritize this group';
      return {
        muscle_group: m.muscle_group,
        state: m.recovery_state,
        last_trained_at: m.last_trained_at,
        recommendation,
      };
    });

    return NextResponse.json({ recommendations });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

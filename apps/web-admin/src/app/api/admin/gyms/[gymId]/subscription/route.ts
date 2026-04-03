import { NextRequest, NextResponse } from 'next/server';
import { verifySuperAdmin } from '@/lib/auth/verifySuperAdmin';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { gymId: string } }
) {
  try {
    const result = await verifySuperAdmin();
    if (result instanceof NextResponse) return result;
    const { admin, user_id } = result;

    const body = await req.json();
    const { subscription_tier, subscription_status } = body;
    const updates: Record<string, string> = {};
    if (subscription_tier) updates.subscription_tier = subscription_tier;
    if (subscription_status)
      updates.subscription_status = subscription_status;
    if (Object.keys(updates).length === 0)
      return NextResponse.json(
        { error: 'No fields to update' },
        { status: 400 }
      );

    const { error } = await admin
      .from('gyms')
      .update(updates)
      .eq('id', params.gymId);
    if (error)
      return NextResponse.json(
        { error: 'Failed to update subscription' },
        { status: 500 }
      );

    await admin.from('admin_actions_log').insert({
      admin_user_id: user_id,
      action: 'update_subscription',
      target_gym_id: params.gymId,
      details: updates,
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

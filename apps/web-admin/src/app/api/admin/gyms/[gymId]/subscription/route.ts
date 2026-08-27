import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifySuperAdmin } from '@/lib/auth/verifySuperAdmin';
import { validateUUIDs } from '@/lib/validation/uuid';
import { checkRateLimit } from '@/lib/rateLimit';

const subscriptionSchema = z
  .object({
    subscription_tier: z.enum(['starter', 'growth', 'pro']).optional(),
    subscription_status: z
      .enum(['trial', 'active', 'past_due', 'cancelled', 'payment_required'])
      .optional(),
  })
  .refine((v) => v.subscription_tier !== undefined || v.subscription_status !== undefined, {
    message: 'At least one field required',
  });

export async function PATCH(
  req: NextRequest,
  { params }: { params: { gymId: string } }
) {
  try {
    const uuidError = validateUUIDs({ gymId: params.gymId });
    if (uuidError) return uuidError;
    const result = await verifySuperAdmin();
    if (result instanceof NextResponse) return result;
    const { admin, user_id } = result;

    const parsed = subscriptionSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }
    const { subscription_tier, subscription_status } = parsed.data;
    const updates: Record<string, string> = {};
    if (subscription_tier) updates.subscription_tier = subscription_tier;
    if (subscription_status) updates.subscription_status = subscription_status;

    const rl = checkRateLimit(`admin-sub:${user_id}`, 20, 60_000);
    if (rl) return rl;

    const { error } = await admin
      .from('gyms')
      .update(updates)
      .eq('id', params.gymId);
    if (error)
      return NextResponse.json(
        { error: 'Failed to update subscription' },
        { status: 500 }
      );

    const { error: logError } = await admin.from('admin_actions_log').insert({
      admin_user_id: user_id,
      action_type: 'update_subscription',
      target_type: 'gym',
      target_id: params.gymId,
      details: updates,
    });
    if (logError) {
      console.error('[admin/gyms/subscription] Failed to log action:', logError);
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

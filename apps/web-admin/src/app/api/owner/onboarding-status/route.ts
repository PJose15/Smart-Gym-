import { NextResponse } from 'next/server';
import { verifyStaff } from '@/lib/auth/verifyStaff';
import { computeDaysRemaining } from './types';
import type { OnboardingStatusResponse } from './types';

export async function GET() {
  try {
    const result = await verifyStaff('owner');
    if (result instanceof NextResponse) return result;

    const { admin, gym_id } = result;

    const [machinesRes, membersRes, scansRes, billingRes] = await Promise.all([
      admin
        .from('machines')
        .select('id', { count: 'exact', head: true })
        .eq('gym_id', gym_id)
        .eq('is_active', true),
      admin
        .from('members')
        .select('id', { count: 'exact', head: true })
        .eq('gym_id', gym_id)
        .eq('is_active', true),
      admin
        .from('machine_scan_events')
        .select('id', { count: 'exact', head: true })
        .eq('gym_id', gym_id),
      admin
        .from('gym_billing')
        .select('subscription_status, trial_ends_at')
        .eq('gym_id', gym_id)
        .maybeSingle(),
    ]);

    const billing = billingRes.data as {
      subscription_status: string;
      trial_ends_at: string | null;
    } | null;

    const is_trialing = billing?.subscription_status === 'trialing';
    const trial_ends_at = billing?.trial_ends_at ?? null;
    const days_remaining = is_trialing ? computeDaysRemaining(trial_ends_at) : null;

    const response: OnboardingStatusResponse = {
      checklist: {
        has_machine: (machinesRes.count ?? 0) > 0,
        has_members: (membersRes.count ?? 0) > 0,
        has_shared_qr: (scansRes.count ?? 0) > 0,
      },
      trial: {
        is_trialing,
        trial_ends_at,
        days_remaining,
      },
    };

    return NextResponse.json(response);
  } catch (err) {
    console.error('[owner/onboarding-status] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

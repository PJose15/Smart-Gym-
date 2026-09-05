import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function GET() {
  // Step 1: Verify authenticated user (server-validated via GoTrue)
  const supabase = await createServerSupabaseClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError || !userData.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = userData.user;
  const userId = user.id;
  const admin = getAdminClient();

  // Step 2: Find owner gym membership
  const { data: membership, error: membershipError } = await admin
    .from('gym_memberships')
    .select('gym_id, role, status')
    .eq('user_id', userId)
    .eq('role', 'owner')
    .eq('status', 'active')
    .single();

  if (membershipError || !membership) {
    return NextResponse.json({ error: 'no_gym' }, { status: 404 });
  }

  const gymId = membership.gym_id;

  // Step 3: Fetch gym details
  const { data: gym } = await admin
    .from('gyms')
    .select('name, subscription_tier')
    .eq('id', gymId)
    .single();

  // Step 4: Fetch billing info
  const { data: billing } = await admin
    .from('gym_billing')
    .select('stripe_customer_id, stripe_subscription_id, subscription_status')
    .eq('gym_id', gymId)
    .maybeSingle();

  return NextResponse.json({
    gym_id: gymId,
    gym_name: gym?.name ?? null,
    tier: gym?.subscription_tier ?? null,
    email_confirmed: !!user.email_confirmed_at,
    billing: {
      has_customer: !!billing?.stripe_customer_id,
      has_subscription: !!billing?.stripe_subscription_id,
      subscription_status: billing?.subscription_status ?? null,
    },
  });
}

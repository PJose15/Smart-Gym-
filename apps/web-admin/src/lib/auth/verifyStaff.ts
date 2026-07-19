import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { StaffRole } from '@nexera/types';

export interface StaffVerifyResult {
  user_id: string;
  gym_id: string;
  role: StaffRole;
  permissions: Record<string, boolean>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: SupabaseClient<any, 'public', any>;
}

/**
 * Verifies the current session user has a staff role (trainer or owner)
 * in at least one gym. Returns user_id, gym_id, role, and admin client.
 */
export async function verifyStaff(
  requiredRole?: StaffRole
): Promise<StaffVerifyResult | NextResponse> {
  const supabase = await createServerSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Check gym_memberships for trainer or owner role
  const query = supabase
    .from('gym_memberships')
    .select('gym_id, role, permissions')
    .eq('user_id', session.user.id)
    .eq('status', 'active');

  if (requiredRole) {
    query.eq('role', requiredRole);
  } else {
    query.in('role', ['trainer', 'owner']);
  }

  const { data: membership } = await query.limit(1).maybeSingle();

  if (!membership) {
    return NextResponse.json({ error: 'Forbidden — staff role required' }, { status: 403 });
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  return {
    user_id: session.user.id,
    gym_id: membership.gym_id,
    role: membership.role as StaffRole,
    permissions: (membership.permissions as Record<string, boolean>) ?? {},
    admin,
  };
}

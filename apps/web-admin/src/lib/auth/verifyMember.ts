import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

interface VerifyResult {
  /** The authenticated user's member_id */
  member_id: string;
  /** Admin client for service-role operations */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: SupabaseClient<any, 'public', any>;
}

/**
 * Verifies that the current session user owns the given member_id.
 * Returns the admin client for further operations, or a 401/403 NextResponse.
 */
export async function verifyMember(
  requestedMemberId: string
): Promise<VerifyResult | NextResponse> {
  const supabase = await createServerSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Look up which member belongs to this user
  const { data: member } = await supabase
    .from('members')
    .select('id')
    .eq('user_id', session.user.id)
    .eq('id', requestedMemberId)
    .maybeSingle();

  if (!member) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  return { member_id: member.id, admin };
}

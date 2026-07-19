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
 * Accepts either a cookie-based session (web) or a Bearer JWT (mobile).
 * Returns the admin client for further operations, or a 401/403 NextResponse.
 *
 * @param requestedMemberId - The member ID to verify ownership of
 * @param request - Optional Request object; when present, Bearer JWT in
 *   Authorization header is tried before the cookie session fallback.
 *   All existing call sites omit this param and keep cookie-only behavior.
 */
export async function verifyMember(
  requestedMemberId: string,
  request?: Request
): Promise<VerifyResult | NextResponse> {
  // Admin (service-role) client used for both auth lookup and member ownership check
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  let userId: string | null = null;

  // ── Bearer path (mobile clients) ──────────────────────────────────────────
  const authHeader = request?.headers.get('authorization');
  if (authHeader?.toLowerCase().startsWith('bearer ')) {
    const token = authHeader.slice(7); // strip "Bearer " prefix
    const { data: { user }, error } = await admin.auth.getUser(token);
    if (!error && user) {
      userId = user.id;
    }
    // On error/null: fall through to cookie path (browser may send Bearer too)
  }

  // ── Cookie path (web / fallback) ──────────────────────────────────────────
  if (!userId) {
    const supabase = await createServerSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      userId = session.user.id;
    }
  }

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // ── Member ownership check (admin client in both paths) ──────────────────
  const { data: member } = await admin
    .from('members')
    .select('id')
    .eq('user_id', userId)
    .eq('id', requestedMemberId)
    .maybeSingle();

  if (!member) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  return { member_id: member.id, admin };
}

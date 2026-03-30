import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

interface SuperAdminVerifyResult {
  user_id: string;
  email: string;
  display_name: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: SupabaseClient<any, 'public', any>;
}

/**
 * Verifies the current session user is a super_admin.
 * Returns 404 on ANY failure (conceals admin existence).
 */
export async function verifySuperAdmin(): Promise<SuperAdminVerifyResult | NextResponse> {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session?.user) {
      return NextResponse.json({ error: 'Not Found' }, { status: 404 });
    }

    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data: user } = await admin
      .from('users')
      .select('id, email, display_name, platform_role')
      .eq('id', session.user.id)
      .eq('platform_role', 'super_admin')
      .maybeSingle();

    if (!user) {
      return NextResponse.json({ error: 'Not Found' }, { status: 404 });
    }

    return {
      user_id: user.id,
      email: user.email,
      display_name: user.display_name,
      admin,
    };
  } catch (err) {
    console.error('[verifySuperAdmin] Error:', err);
    return NextResponse.json({ error: 'Not Found' }, { status: 404 });
  }
}

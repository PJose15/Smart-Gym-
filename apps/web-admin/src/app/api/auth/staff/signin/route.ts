import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { checkRateLimit } from '@/lib/rateLimit';

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();
    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password required' }, { status: 400 });
    }

    const rl = checkRateLimit(`staff-signin:${email}`, 5, 60_000);
    if (rl) return rl;

    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error || !data.session) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    // Verify user has a staff role
    const { data: membership } = await supabase
      .from('gym_memberships')
      .select('gym_id, role')
      .eq('user_id', data.user.id)
      .eq('status', 'active')
      .in('role', ['trainer', 'owner'])
      .limit(1)
      .maybeSingle();

    if (!membership) {
      await supabase.auth.signOut();
      return NextResponse.json({ error: 'Staff access required' }, { status: 403 });
    }

    return NextResponse.json({
      user_id: data.user.id,
      email: data.user.email,
      role: membership.role,
      gym_id: membership.gym_id,
    });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

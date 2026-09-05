import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';
import { checkRateLimit } from '@/lib/rateLimit';

export async function POST(req: NextRequest) {
  try {
    const { follower_id, following_id } = await req.json();
    if (!follower_id || !following_id)
      return NextResponse.json(
        { error: 'follower_id and following_id required' },
        { status: 400 }
      );

    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Rate limit AFTER auth, keyed on the authenticated user (M-9).
    const rl = checkRateLimit(`unfollow:${user.id}`, 30, 60_000);
    if (rl) return rl;

    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data: member } = await admin
      .from('members')
      .select('id')
      .eq('id', follower_id)
      .eq('user_id', user.id)
      .maybeSingle();
    if (!member)
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { error } = await admin
      .from('social_connections')
      .delete()
      .eq('follower_id', follower_id)
      .eq('following_id', following_id);
    if (error)
      return NextResponse.json(
        { error: 'Failed to unfollow' },
        { status: 500 }
      );
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

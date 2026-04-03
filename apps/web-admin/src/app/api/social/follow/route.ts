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
    if (follower_id === following_id)
      return NextResponse.json(
        { error: 'Cannot follow yourself' },
        { status: 400 }
      );

    const rl = checkRateLimit(`follow:${follower_id}`, 30, 60_000);
    if (rl) return rl;

    const supabase = await createServerSupabaseClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Verify follower belongs to this user
    const { data: member } = await admin
      .from('members')
      .select('id')
      .eq('id', follower_id)
      .eq('user_id', session.user.id)
      .maybeSingle();
    if (!member)
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { error } = await admin
      .from('social_connections')
      .upsert(
        { follower_id, following_id },
        { onConflict: 'follower_id,following_id' }
      );
    if (error)
      return NextResponse.json(
        { error: 'Failed to follow' },
        { status: 500 }
      );
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

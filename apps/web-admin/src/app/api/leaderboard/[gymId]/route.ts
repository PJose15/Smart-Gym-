import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';
import { validateUUIDs } from '@/lib/validation/uuid';

export async function GET(
  req: NextRequest,
  { params }: { params: { gymId: string } }
) {
  try {
    const uuidError = validateUUIDs({ gymId: params.gymId });
    if (uuidError) return uuidError;
    const supabase = await createServerSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Verify member is at gym
    const { data: member } = await admin
      .from('members')
      .select('id')
      .eq('user_id', session.user.id)
      .eq('gym_id', params.gymId)
      .maybeSingle();
    if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const url = req.nextUrl.searchParams;
    const type = url.get('type') || 'volume';
    const period = url.get('period') || 'week';
    const limit = Math.min(Number(url.get('limit')) || 50, 100);

    const { data, error } = await admin
      .from('member_leaderboard_positions')
      .select('member_id, display_name, avatar_url, rank, value')
      .eq('gym_id', params.gymId)
      .eq('leaderboard_type', type)
      .eq('period', period)
      .order('rank', { ascending: true })
      .limit(limit);

    if (error) return NextResponse.json({ error: 'Failed to fetch leaderboard' }, { status: 500 });
    return NextResponse.json({ leaderboard: data ?? [], type, period });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

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
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Verify member is at gym
    const { data: member } = await admin
      .from('members')
      .select('id')
      .eq('user_id', user.id)
      .eq('gym_id', params.gymId)
      .maybeSingle();
    if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const url = req.nextUrl.searchParams;
    const type = url.get('type') || 'volume';
    const period = url.get('period') || 'weekly';
    const leaderboardType = `${type}-${period}`;
    const limit = Math.min(Number(url.get('limit')) || 50, 100);

    const { data: positions, error: posErr } = await admin
      .from('member_leaderboard_positions')
      .select('member_id, current_rank, current_value')
      .eq('gym_id', params.gymId)
      .eq('leaderboard_type', leaderboardType)
      .order('current_rank', { ascending: true })
      .limit(limit);

    if (posErr) return NextResponse.json({ error: 'Failed to fetch leaderboard' }, { status: 500 });
    if (!positions || positions.length === 0) {
      return NextResponse.json({ leaderboard: [], type, period });
    }

    // Join to members for display info
    const memberIds = positions.map((p: { member_id: string }) => p.member_id);
    const { data: members } = await admin
      .from('members')
      .select('id, display_name, avatar_url')
      .in('id', memberIds);

    const memberMap = new Map<string, { display_name: string; avatar_url: string | null }>();
    for (const m of members ?? []) {
      memberMap.set(m.id, { display_name: m.display_name, avatar_url: m.avatar_url });
    }

    const leaderboard = positions.map((p: { member_id: string; current_rank: number; current_value: number }) => ({
      member_id: p.member_id,
      rank: p.current_rank,
      value: Number(p.current_value),
      display_name: memberMap.get(p.member_id)?.display_name ?? 'Unknown',
      avatar_url: memberMap.get(p.member_id)?.avatar_url ?? null,
    }));

    return NextResponse.json({ leaderboard, type, period });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

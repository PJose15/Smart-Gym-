import { NextRequest, NextResponse } from 'next/server';
import { verifyMember } from '@/lib/auth/verifyMember';
import { resolveMemberGym } from '@/lib/auth/tenant';
import { leaderboardQuerySchema } from '@/lib/validation/leaderboard';
import type { LeaderboardEntry, LeaderboardResponse } from '@nexera/types';

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const parsed = leaderboardQuerySchema.safeParse({
      member_id: sp.get('member_id'),
      gym_id: sp.get('gym_id'),
      period: sp.get('period') ?? 'weekly',
      limit: sp.get('limit') ?? '50',
    });

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }

    const { member_id, period, limit } = parsed.data;

    const auth = await verifyMember(member_id);
    if (auth instanceof NextResponse) return auth;

    const { admin } = auth;

    // Tenant binding (BE-H4): gym derived from the member row — the
    // caller-supplied gym_id query param is ignored.
    const gym_id = await resolveMemberGym(admin, member_id);
    if (!gym_id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    // Calculate since date for weekly
    let since: string | null = null;
    if (period === 'weekly') {
      const now = new Date();
      const day = now.getDay();
      const diff = day === 0 ? 6 : day - 1;
      const monday = new Date(now);
      monday.setDate(now.getDate() - diff);
      monday.setHours(0, 0, 0, 0);
      since = monday.toISOString();
    }

    const { data: rankings, error: rpcErr } = await admin.rpc('get_leaderboard', {
      p_gym_id: gym_id,
      p_since: since,
      p_limit: limit,
    });

    if (rpcErr) {
      return NextResponse.json({ error: 'Leaderboard query failed' }, { status: 500 });
    }

    if (!rankings || rankings.length === 0) {
      return NextResponse.json({
        entries: [],
        my_rank: null,
        total_participants: 0,
      } satisfies LeaderboardResponse);
    }

    // Get member's user_id to find current user in results
    const { data: currentMember } = await admin
      .from('members')
      .select('user_id')
      .eq('id', member_id)
      .single();

    const currentUserId = currentMember?.user_id;

    // Get display info for all ranked members
    const profileIds = rankings.map((r: { profile_id: string }) => r.profile_id);
    const { data: members } = await admin
      .from('members')
      .select('user_id, display_name, avatar_url')
      .eq('gym_id', gym_id)
      .in('user_id', profileIds);

    const memberMap = new Map<string, { display_name: string; avatar_url: string | null }>();
    for (const m of members ?? []) {
      if (m.user_id) {
        memberMap.set(m.user_id, { display_name: m.display_name, avatar_url: m.avatar_url });
      }
    }

    let myRank: number | null = null;
    const entries: LeaderboardEntry[] = rankings.map(
      (r: { profile_id: string; total_points: number }, index: number) => {
        const isCurrent = r.profile_id === currentUserId;
        if (isCurrent) myRank = index + 1;
        return {
          rank: index + 1,
          profile_id: r.profile_id,
          full_name: memberMap.get(r.profile_id)?.display_name || 'Unknown',
          avatar_url: memberMap.get(r.profile_id)?.avatar_url || null,
          total_points: Number(r.total_points),
          is_current_user: isCurrent,
        };
      },
    );

    return NextResponse.json({
      entries,
      my_rank: myRank,
      total_participants: entries.length,
    } satisfies LeaderboardResponse);
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

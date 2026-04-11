import { NextRequest, NextResponse } from 'next/server';
import { verifyMember } from '@/lib/auth/verifyMember';
import { validateUUIDs } from '@/lib/validation/uuid';

export async function GET(
  req: NextRequest,
  { params }: { params: { memberId: string } }
) {
  try {
    const uuidError = validateUUIDs({ memberId: params.memberId });
    if (uuidError) return uuidError;
    const auth = await verifyMember(params.memberId);
    if (auth instanceof NextResponse) return auth;
    const { admin } = auth;

    const url = new URL(req.url);
    const offset = Math.max(0, parseInt(url.searchParams.get('offset') ?? '0', 10) || 0);
    const limit = Math.min(
      100,
      Math.max(1, parseInt(url.searchParams.get('limit') ?? '50', 10) || 50),
    );

    const [followingRes, followersRes, followingCountRes, followersCountRes] =
      await Promise.all([
        admin
          .from('social_connections')
          .select(
            'following_id, members!social_connections_following_id_fkey(display_name, avatar_url)',
          )
          .eq('follower_id', params.memberId)
          .range(offset, offset + limit - 1),
        admin
          .from('social_connections')
          .select(
            'follower_id, members!social_connections_follower_id_fkey(display_name, avatar_url)',
          )
          .eq('following_id', params.memberId)
          .range(offset, offset + limit - 1),
        admin
          .from('social_connections')
          .select('follower_id', { count: 'exact', head: true })
          .eq('follower_id', params.memberId),
        admin
          .from('social_connections')
          .select('following_id', { count: 'exact', head: true })
          .eq('following_id', params.memberId),
      ]);

    return NextResponse.json({
      following: followingRes.data ?? [],
      followers: followersRes.data ?? [],
      following_count: followingCountRes.count ?? 0,
      followers_count: followersCountRes.count ?? 0,
    });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

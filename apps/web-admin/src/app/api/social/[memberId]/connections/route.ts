import { NextRequest, NextResponse } from 'next/server';
import { verifyMember } from '@/lib/auth/verifyMember';
import { validateUUIDs } from '@/lib/validation/uuid';

export async function GET(
  _req: NextRequest,
  { params }: { params: { memberId: string } }
) {
  try {
    const uuidError = validateUUIDs({ memberId: params.memberId });
    if (uuidError) return uuidError;
    const auth = await verifyMember(params.memberId);
    if (auth instanceof NextResponse) return auth;
    const { admin } = auth;

    const { data: following } = await admin
      .from('social_connections')
      .select(
        'following_id, members!social_connections_following_id_fkey(display_name, avatar_url)'
      )
      .eq('follower_id', params.memberId);
    const { data: followers } = await admin
      .from('social_connections')
      .select(
        'follower_id, members!social_connections_follower_id_fkey(display_name, avatar_url)'
      )
      .eq('following_id', params.memberId);

    return NextResponse.json({
      following: following ?? [],
      followers: followers ?? [],
      following_count: following?.length ?? 0,
      followers_count: followers?.length ?? 0,
    });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

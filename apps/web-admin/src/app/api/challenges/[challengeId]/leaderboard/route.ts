import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';
import { validateUUIDs } from '@/lib/validation/uuid';
import { assertInGym } from '@/lib/auth/tenant';

export async function GET(
  req: NextRequest,
  { params }: { params: { challengeId: string } }
) {
  try {
    const uuidError = validateUUIDs({ challengeId: params.challengeId });
    if (uuidError) return uuidError;
    const supabase = await createServerSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Tenant binding (BE-H4): resolve the caller's member row → gym, and
    // require the challenge to belong to that gym (404 — don't leak existence).
    const { data: callerMember } = await admin
      .from('members')
      .select('id, gym_id')
      .eq('user_id', session.user.id)
      .maybeSingle();
    if (!callerMember?.gym_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (!(await assertInGym(admin, 'gym_challenges', params.challengeId, callerMember.gym_id))) {
      return NextResponse.json({ error: 'Challenge not found' }, { status: 404 });
    }

    const url = new URL(req.url);
    const offset = Math.max(0, parseInt(url.searchParams.get('offset') ?? '0', 10) || 0);
    const limit = Math.min(
      100,
      Math.max(1, parseInt(url.searchParams.get('limit') ?? '50', 10) || 50),
    );

    const { data, error } = await admin
      .from('challenge_participants')
      .select('member_id, current_score, current_rank, members(display_name, avatar_url)')
      .eq('challenge_id', params.challengeId)
      .order('current_score', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) return NextResponse.json({ error: 'Failed to fetch leaderboard' }, { status: 500 });
    return NextResponse.json({ leaderboard: data ?? [] });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';
import { validateUUIDs } from '@/lib/validation/uuid';

export async function GET(
  _req: NextRequest,
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

    const { data, error } = await admin
      .from('challenge_participants')
      .select('member_id, current_score, current_rank, members(display_name, avatar_url)')
      .eq('challenge_id', params.challengeId)
      .order('current_score', { ascending: false });

    if (error) return NextResponse.json({ error: 'Failed to fetch leaderboard' }, { status: 500 });
    return NextResponse.json({ leaderboard: data ?? [] });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';

interface RouteParams {
  params: Promise<{ sessionId: string }>;
}

export async function GET(
  _req: NextRequest,
  { params }: RouteParams
) {
  try {
    const { sessionId } = await params;

    const supabase = await createServerSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data: ws, error } = await admin
      .from('workout_sessions')
      .select('*, workout_sets(*)')
      .eq('id', sessionId)
      .maybeSingle();

    if (error || !ws) return NextResponse.json({ error: 'Session not found' }, { status: 404 });

    // Verify requester is session owner, their trainer, or gym owner
    const { data: member } = await admin
      .from('members')
      .select('id, user_id, gym_id')
      .eq('id', ws.member_id)
      .maybeSingle();

    if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const isOwner = member.user_id === session.user.id;

    let isStaff = false;
    if (!isOwner) {
      const { data: membership } = await admin
        .from('gym_memberships')
        .select('role')
        .eq('user_id', session.user.id)
        .eq('gym_id', member.gym_id)
        .in('role', ['trainer', 'owner'])
        .maybeSingle();

      isStaff = !!membership;
    }

    if (!isOwner && !isStaff) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    return NextResponse.json(ws);
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

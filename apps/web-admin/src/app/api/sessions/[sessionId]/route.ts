import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';
import { validateUUIDs } from '@/lib/validation/uuid';

interface RouteParams {
  params: Promise<{ sessionId: string }>;
}

export async function GET(
  req: NextRequest,
  { params }: RouteParams
) {
  try {
    const { sessionId } = await params;
    const uuidError = validateUUIDs({ sessionId });
    if (uuidError) return uuidError;

    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Resolve caller: Bearer JWT (mobile) first, then cookie session (web)
    let userId: string | null = null;
    const authHeader = req.headers.get('authorization');
    if (authHeader?.toLowerCase().startsWith('bearer ')) {
      const { data: { user } } = await admin.auth.getUser(authHeader.slice(7));
      if (user) userId = user.id;
    }
    if (!userId) {
      const supabase = await createServerSupabaseClient();
      const { data: { user: cookieUser } } = await supabase.auth.getUser();
      if (cookieUser) userId = cookieUser.id;
    }
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: ws, error } = await admin
      .from('workout_sessions')
      .select(
        'id, gym_id, machine_id, member_id, session_date, workout_mode, sets, sets_count, total_volume_lbs, best_weight_lbs, best_reps, is_personal_best, personal_best_type, pr_improvement_lbs, pr_improvement_pct, previous_best_lbs, ai_tip_shown, ai_tip_source, completed_at, created_at, updated_at'
      )
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

    const isOwner = member.user_id === userId;

    let isStaff = false;
    if (!isOwner) {
      const { data: membership } = await admin
        .from('gym_memberships')
        .select('role')
        .eq('user_id', userId)
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

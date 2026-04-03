import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';

interface RouteParams {
  params: Promise<{ slug: string }>;
}

export async function GET(
  _req: NextRequest,
  { params }: RouteParams
) {
  try {
    const { slug } = await params;

    const supabase = await createServerSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Get machine by slug
    const { data: machine } = await admin
      .from('machines')
      .select('id, gym_id, name, category, muscle_groups')
      .eq('qr_slug', slug)
      .maybeSingle();

    if (!machine) return NextResponse.json({ error: 'Machine not found' }, { status: 404 });

    // Get member at this gym
    const { data: member } = await admin
      .from('members')
      .select('id')
      .eq('user_id', session.user.id)
      .eq('gym_id', machine.gym_id)
      .maybeSingle();

    if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    // Last 5 sessions on this machine
    const { data: history } = await admin
      .from('workout_sessions')
      .select('id, session_date, total_volume_lbs, is_personal_best, created_at')
      .eq('member_id', member.id)
      .eq('machine_id', machine.id)
      .order('created_at', { ascending: false })
      .limit(5);

    // Active program context
    const { data: program } = await admin
      .from('ai_programs')
      .select('id, title, program_data, sessions_per_week')
      .eq('member_id', member.id)
      .eq('is_active', true)
      .maybeSingle();

    let todays_target = null;
    let workout_mode = 'free';
    if (program?.program_data?.days) {
      workout_mode = 'ai_program';
      for (const day of program.program_data.days) {
        const match = day.exercises?.find(
          (ex: { machine_id?: string }) => ex.machine_id === machine.id
        );
        if (match) {
          todays_target = match;
          break;
        }
      }
    }

    return NextResponse.json({
      machine,
      workout_mode,
      todays_target,
      last_sessions: history ?? [],
    });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

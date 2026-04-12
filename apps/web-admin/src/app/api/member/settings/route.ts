import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';
import { memberSettingsSchema } from '@/lib/validation/staff';
import { checkRateLimit } from '@/lib/rateLimit';

async function getAuthMember() {
  const supabase = await createServerSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // Get member for this user
  const { data: member } = await admin
    .from('members')
    .select('id')
    .eq('user_id', session.user.id)
    .limit(1)
    .maybeSingle();

  if (!member) {
    return { error: NextResponse.json({ error: 'Member not found' }, { status: 404 }) };
  }

  return { member_id: member.id, admin };
}

export async function GET() {
  try {
    const result = await getAuthMember();
    if ('error' in result) return result.error;

    const { admin, member_id } = result;

    const settingsCols = 'id, member_id, weight_unit, date_format, profile_visible, show_on_leaderboard, share_achievements, share_prs_to_feed, show_streak_publicly, share_weight_with_trainer, share_workout_with_trainer, show_body_weight, updated_at';

    // Get or create settings
    let { data: settings } = await admin
      .from('member_settings')
      .select(settingsCols)
      .eq('member_id', member_id)
      .maybeSingle();

    if (!settings) {
      // Create default settings
      const { data: created } = await admin
        .from('member_settings')
        .insert({ member_id })
        .select(settingsCols)
        .single();
      settings = created;
    }

    return NextResponse.json(settings);
  } catch (err) {
    console.error('[member/settings GET] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const result = await getAuthMember();
    if ('error' in result) return result.error;

    const { admin, member_id } = result;
    const body = await req.json();

    const parsed = memberSettingsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
    }

    const rl = checkRateLimit(`member-settings:${member_id}`, 10, 60_000);
    if (rl) return rl;

    // Upsert settings
    const { data: settings, error } = await admin
      .from('member_settings')
      .upsert({ member_id, ...parsed.data }, { onConflict: 'member_id' })
      .select('id, member_id, weight_unit, date_format, profile_visible, show_on_leaderboard, share_achievements, share_prs_to_feed, show_streak_publicly, share_weight_with_trainer, share_workout_with_trainer, show_body_weight, updated_at')
      .single();

    if (error) {
      console.error('[member/settings PUT] DB error:', error);
      return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
    }

    return NextResponse.json(settings);
  } catch (err) {
    console.error('[member/settings PUT] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

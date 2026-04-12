import { NextRequest, NextResponse } from 'next/server';
import { verifyStaff } from '@/lib/auth/verifyStaff';
import { gymSettingsSchema } from '@/lib/validation/staff';
import { checkRateLimit } from '@/lib/rateLimit';

const GYM_SETTINGS_COLS =
  'id, gym_id, primary_color, secondary_color, font_preference, custom_domain, hide_smartgym_branding, show_public_profile, show_public_stats, public_profile_headline, require_member_photo, allow_anonymous_logging, show_gym_feed, show_leaderboards, leaderboard_scope, enable_member_chat_with_ai, ai_program_auto_generate, trainer_must_approve_ai_programs, program_duration_weeks, default_maintenance_interval_days, at_risk_threshold_days, default_trainer_can_create_challenges, default_trainer_can_manage_all, default_trainer_can_view_analytics, owner_daily_digest, owner_at_risk_alerts, owner_new_member_notification, owner_pr_notifications, owner_monthly_report, owner_maintenance_alerts, equipment_maintenance_alerts, maintenance_alert_days_ahead, gym_open_time, gym_close_time, timezone, currency, weight_unit, created_at, updated_at';

export async function GET() {
  try {
    const result = await verifyStaff('owner');
    if (result instanceof NextResponse) return result;

    const { admin, gym_id } = result;

    const { data: settings } = await admin
      .from('gym_settings')
      .select(GYM_SETTINGS_COLS)
      .eq('gym_id', gym_id)
      .single();

    if (!settings) {
      return NextResponse.json({ error: 'Settings not found' }, { status: 404 });
    }

    return NextResponse.json(settings);
  } catch (err) {
    console.error('[owner/settings GET] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const result = await verifyStaff('owner');
    if (result instanceof NextResponse) return result;

    const { admin, gym_id } = result;
    const body = await req.json();

    const parsed = gymSettingsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
    }

    const rl = checkRateLimit(`gym-settings:${gym_id}`, 20, 60_000);
    if (rl) return rl;

    const { data: settings, error } = await admin
      .from('gym_settings')
      .update(parsed.data)
      .eq('gym_id', gym_id)
      .select(GYM_SETTINGS_COLS)
      .single();

    if (error) {
      console.error('[owner/settings PUT] DB error:', error);
      return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
    }

    return NextResponse.json(settings);
  } catch (err) {
    console.error('[owner/settings PUT] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

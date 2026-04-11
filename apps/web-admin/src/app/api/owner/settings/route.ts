import { NextRequest, NextResponse } from 'next/server';
import { verifyStaff } from '@/lib/auth/verifyStaff';
import { gymSettingsSchema } from '@/lib/validation/staff';
import { checkRateLimit } from '@/lib/rateLimit';

export async function GET() {
  try {
    const result = await verifyStaff('owner');
    if (result instanceof NextResponse) return result;

    const { admin, gym_id } = result;

    const { data: settings } = await admin
      .from('gym_settings')
      .select('*')
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
      .select()
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

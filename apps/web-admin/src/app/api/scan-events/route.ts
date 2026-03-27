import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { scanEventSchema } from '@/lib/validation/session';

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

/**
 * POST /api/scan-events
 * Logs a machine scan event for analytics.
 * Called when a user enters the logging flow on a machine.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = scanEventSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid input' },
        { status: 400 }
      );
    }

    const { machine_id, member_id, gym_id, workout_mode, was_in_program } = parsed.data;
    const admin = getAdminClient();

    const { data, error } = await admin
      .from('machine_scan_events')
      .insert({
        machine_id,
        member_id,
        gym_id,
        scanned_at: new Date().toISOString(),
        workout_mode,
        was_in_program,
        led_to_log: false, // Updated later when session completes
      })
      .select('id')
      .single();

    if (error) {
      console.error('Scan event insert error:', error);
      return NextResponse.json({ error: 'Failed to log scan event' }, { status: 500 });
    }

    return NextResponse.json({ scan_event_id: data.id });
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/scan-events
 * Updates a scan event (e.g., mark led_to_log = true on session complete).
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { scan_event_id, led_to_log } = body;

    if (!scan_event_id || typeof led_to_log !== 'boolean') {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }

    const admin = getAdminClient();

    const { error } = await admin
      .from('machine_scan_events')
      .update({ led_to_log })
      .eq('id', scan_event_id);

    if (error) {
      console.error('Scan event update error:', error);
      return NextResponse.json({ error: 'Failed to update scan event' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { scanEventSchema } from '@/lib/validation/session';
import { validateUUIDs } from '@/lib/validation/uuid';
import { assertInGym } from '@/lib/auth/tenant';
import { checkRateLimit } from '@/lib/rateLimit';

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
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const parsed = scanEventSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid input' },
        { status: 400 }
      );
    }

    const { machine_id, member_id, workout_mode, was_in_program } = parsed.data;

    // M-4: the scan flow only fires this once the member is authenticated, so
    // a null member_id is never legitimate here.
    if (!member_id) {
      return NextResponse.json({ error: 'member_id is required' }, { status: 400 });
    }

    const admin = getAdminClient();

    // M-4: bind the event to the caller — member must be owned by the session
    // user; gym is derived from the member row (body gym_id is ignored).
    const { data: member } = await admin
      .from('members')
      .select('id, gym_id')
      .eq('id', member_id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!member) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // M-9: rate limit after auth, keyed on the verified member
    const rl = checkRateLimit(`scan-event:${member.id}`, 30, 60_000);
    if (rl) return rl;

    // Machine must belong to the member's gym
    const machineOk = await assertInGym(admin, 'machines', machine_id, member.gym_id);
    if (!machineOk) {
      return NextResponse.json({ error: 'Machine not found' }, { status: 404 });
    }

    const { data, error } = await admin
      .from('machine_scan_events')
      .insert({
        machine_id,
        member_id: member.id,
        gym_id: member.gym_id,
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
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { scan_event_id, led_to_log } = body;

    if (!scan_event_id || typeof led_to_log !== 'boolean') {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }
    const uuidError = validateUUIDs({ scan_event_id });
    if (uuidError) return uuidError;

    const rl = checkRateLimit(`scan-event-patch:${user.id}`, 60, 60_000);
    if (rl) return rl;

    const admin = getAdminClient();

    // M-4: only update scan events belonging to a member owned by this user.
    const { data: memberRows } = await admin
      .from('members')
      .select('id')
      .eq('user_id', user.id);

    const memberIds = (memberRows ?? []).map((m) => m.id);
    if (memberIds.length === 0) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { data: updated, error } = await admin
      .from('machine_scan_events')
      .update({ led_to_log })
      .eq('id', scan_event_id)
      .in('member_id', memberIds)
      .select('id');

    if (error) {
      console.error('Scan event update error:', error);
      return NextResponse.json({ error: 'Failed to update scan event' }, { status: 500 });
    }

    if (!updated || updated.length === 0) {
      // Missing or cross-tenant event — same response either way
      return NextResponse.json({ error: 'Scan event not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

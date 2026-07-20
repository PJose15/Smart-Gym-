import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

/**
 * POST /api/dev/agent-echo
 *
 * Staging-only echo receiver for UptimizeAI agent forwarding verification.
 * Active only when DEMO_ECHO_AGENTS=true — always returns 404 in production.
 *
 * Usage: set UPTIMIZE_WEBHOOK_URL=http://localhost:3000/api/dev/agent-echo
 *        and DEMO_ECHO_AGENTS=true in your local .env, then fire any agent
 *        trigger. Console will log the received payload and the matching
 *        smartgym_agent_logs row will have action_taken='echo-received'.
 *
 * Expected body shape (forwarded by trigger route in plan 05-02):
 *   { agent_name: string, payload: object, log_id: string }
 *
 * NOTE: status column has a CHECK constraint (sent/failed/pending/skipped).
 *       Reception is recorded via action_taken text column — never status.
 */
export async function POST(request: Request) {
  if (process.env.NODE_ENV === 'production' || process.env.DEMO_ECHO_AGENTS !== 'true') {
    return NextResponse.json({ error: 'Not available' }, { status: 404 });
  }

  let body: { agent_name?: unknown; payload?: unknown; log_id?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  console.log('[agent-echo] received:', JSON.stringify(body));

  if (typeof body.log_id === 'string') {
    const admin = getAdminClient();
    const { error } = await admin
      .from('smartgym_agent_logs')
      .update({ action_taken: 'echo-received' })
      .eq('id', body.log_id);

    if (error) {
      console.error('[agent-echo] failed to update log row:', error.message);
    }
  }

  return NextResponse.json({
    echoed: true,
    agent_name: body.agent_name ?? null,
    log_id: body.log_id ?? null,
  });
}

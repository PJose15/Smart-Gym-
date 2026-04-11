import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import { checkAgentAccess } from '@/lib/billing/featureGate';

const triggerPayloadSchema = z
  .object({
    event: z.string().max(100).optional(),
  })
  .passthrough();

const triggerBodySchema = z.object({
  agent_name: z.string().min(1).max(100),
  payload: triggerPayloadSchema,
});

export const dynamic = 'force-dynamic';

const KNOWN_AGENTS = [
  'retention-agent',
  'engagement-agent',
  'revenue-agent',
  'operations-agent',
  'growth-agent',
];

export async function POST(request: Request) {
  try {
    // Auth: internal key only
    const internalKey = process.env.INTERNAL_WEBHOOK_KEY;
    if (!internalKey) {
      return NextResponse.json({ error: 'Internal webhook key not configured' }, { status: 500 });
    }

    const providedKey = request.headers.get('x-smartgym-internal-key');
    if (providedKey !== internalKey) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rawBody = await request.text();
    if (rawBody.length > 50_000) {
      return NextResponse.json({ error: 'payload too large' }, { status: 413 });
    }
    let jsonBody: unknown;
    try {
      jsonBody = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }
    const parsed = triggerBodySchema.safeParse(jsonBody);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }
    const { agent_name, payload } = parsed.data;

    if (!KNOWN_AGENTS.includes(agent_name)) {
      return NextResponse.json({ error: `Unknown agent: ${agent_name}` }, { status: 400 });
    }

    const gymId = payload.gym_id as string | undefined;

    // Check feature gating if gym_id is provided
    if (gymId) {
      const access = await checkAgentAccess(gymId, agent_name);
      if (!access.hasAccess) {
        // Log the skipped trigger
        const admin = getAdminClient();
        await admin.from('smartgym_agent_logs').insert({
          gym_id: gymId,
          member_id: (payload.member_id as string) || null,
          agent_name,
          trigger_event: payload.event as string || 'unknown',
          status: 'skipped',
          error_message: access.reason || 'Feature not available for tier',
          payload,
        });

        return NextResponse.json({
          success: false,
          error: access.reason,
          upgrade_message: access.upgradeMessage,
        }, { status: 403 });
      }
    }

    // Log the agent trigger
    const admin = getAdminClient();
    await admin.from('smartgym_agent_logs').insert({
      gym_id: gymId || null,
      member_id: (payload.member_id as string) || null,
      agent_name,
      trigger_event: payload.event as string || 'unknown',
      status: 'sent',
      payload,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[agents/trigger] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

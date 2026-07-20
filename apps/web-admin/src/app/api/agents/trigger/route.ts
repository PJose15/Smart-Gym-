import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import { checkAgentAccess } from '@/lib/billing/featureGate';
import { getCooldownWindowStart, isPlatformEvent } from './cooldown';

const triggerPayloadSchema = z
  .object({
    event: z.string().max(100).optional(),
    /**
     * Loop-safety flag (Phase 6 contract).
     * When Phase 6 dispatcher wires notifications it checks is_agent_initiated === true
     * and skips re-triggering agents. The flag must be in the schema BEFORE any call
     * site goes live — even though Phase 6 consumes it, Phase 5 establishes it.
     */
    is_agent_initiated: z.boolean().optional(),
    /**
     * Optional dedup key for call sites that need finer-grained dedup beyond
     * (gym, agent, event, member). E.g. 'session-<id>' scopes the cooldown to a
     * specific session so a retry of the same session is always skipped.
     * Max 200 chars to prevent payload bloat.
     */
    dedup_key: z.string().max(200).optional(),
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
    const memberId = (payload.member_id as string) || null;
    const triggerEvent = (payload.event as string) || 'unknown';
    const dedupKey = payload.dedup_key as string | undefined;

    const admin = getAdminClient();

    // ── Tier gating ──────────────────────────────────────────────────────────
    // Platform events bypass tier gating by documented design (see cooldown.ts).
    // All other gym-scoped events go through checkAgentAccess.
    if (gymId && !isPlatformEvent(triggerEvent)) {
      const access = await checkAgentAccess(gymId, agent_name);
      if (!access.hasAccess) {
        await admin.from('smartgym_agent_logs').insert({
          gym_id: gymId,
          member_id: memberId,
          agent_name,
          trigger_event: triggerEvent,
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

    // ── Cooldown dedup ────────────────────────────────────────────────────────
    // Only when gym_id is present (gym-less payloads keep legacy behavior).
    // Only checks 'sent' rows — skipped rows do NOT extend the cooldown window.
    if (gymId) {
      // Build the dedup query chain using any to allow dynamic member/dedup_key scoping.
      // The Supabase query builder returns the same chainable type from .eq()/.is()/.gte()
      // but TypeScript's generated types don't fully express this — 'any' is the idiomatic
      // pattern for dynamic filter building in this codebase.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let dedupQuery: any = admin
        .from('smartgym_agent_logs')
        .select('id')
        .eq('gym_id', gymId)
        .eq('agent_name', agent_name)
        .eq('trigger_event', triggerEvent)
        .gte('executed_at', getCooldownWindowStart(triggerEvent));

      // Member scoping: member A firing never blocks member B
      if (memberId) {
        dedupQuery = dedupQuery.eq('member_id', memberId);
      } else {
        dedupQuery = dedupQuery.is('member_id', null);
      }

      // Additional dedup_key scoping when present
      if (dedupKey) {
        dedupQuery = dedupQuery.eq('payload->>dedup_key', dedupKey);
      }

      const { data: recent } = await dedupQuery.limit(1);

      if (recent && recent.length > 0) {
        await admin.from('smartgym_agent_logs').insert({
          gym_id: gymId,
          member_id: memberId,
          agent_name,
          trigger_event: triggerEvent,
          status: 'skipped',
          error_message: 'Cooldown window active',
          payload,
        });

        return NextResponse.json({ success: true, skipped: true, reason: 'cooldown' });
      }
    }

    // ── Log trigger as 'sent' + capture id for failure recording ─────────────
    const { data: logRow } = await admin
      .from('smartgym_agent_logs')
      .insert({
        gym_id: gymId || null,
        member_id: memberId,
        agent_name,
        trigger_event: triggerEvent,
        status: 'sent',
        payload,
      })
      .select('id')
      .single();

    // ── Fire-and-forget forward to UptimizeAI ─────────────────────────────────
    // UPTIMIZE_WEBHOOK_URL absent = skip forwarding (local dev / no external endpoint).
    // This is a locked staging-ready decision: forwarding is optional by design.
    const webhookUrl = process.env.UPTIMIZE_WEBHOOK_URL;
    if (webhookUrl) {
      fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-uptimize-key': process.env.UPTIMIZE_API_KEY ?? '',
        },
        body: JSON.stringify({ agent_name, payload, log_id: logRow?.id ?? null }),
        signal: AbortSignal.timeout(10_000),
      }).catch(async (err) => {
        console.error('[agents/trigger] forward failed:', err instanceof Error ? err.message : 'Unknown error');
        if (logRow?.id) {
          await admin
            .from('smartgym_agent_logs')
            .update({ status: 'failed', error_message: String(err) })
            .eq('id', logRow.id);
        }
      });
    }

    return NextResponse.json({ success: true, log_id: logRow?.id ?? null });
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

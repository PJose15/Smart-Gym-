# Phase 5: UptimizeAI Agent Connection — Research

**Researched:** 2026-07-19
**Domain:** Agent webhook forwarding, cooldown deduplication, event-source wiring, cron jobs, loop safety
**Confidence:** HIGH (grounded in direct file reads of all agent infra + migrations + cron routes)

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| AGENT-01 | `/api/agents/trigger` forwards to `UPTIMIZE_WEBHOOK_URL` fire-and-forget after logging; failures recorded as `status: 'failed'` in `smartgym_agent_logs` | Confirmed: route exists, logs to DB, does NOT yet forward externally — forwarding fetch is the first code change |
| AGENT-02 | Cooldown check against `smartgym_agent_logs` per (gym, agent, event, window) before firing; `is_agent_initiated` flag prevents agent→notification→agent loops; dead-table references verified resolved | Confirmed: no dedup logic exists in trigger route today; `last_fired_at` column exists on `gym_agent_config` but is unused; dead tables resolved via migrations 024-026 per REQUIREMENTS.md |
| AGENT-03 | Event-driven call sites wired: session complete (level-up, streak-broken, leaderboard-updated), feature-gate denial, at-risk detection, new-gym-onboarded, challenge-ended — plus 3 already-wired Stripe billing triggers | Confirmed: session complete route has zero agent calls today; challenge complete route has no agent call; at-risk route has no agent call; featureGate.ts has no agent call; 3 Stripe triggers already wired in billing/webhook |
| AGENT-04 | Daily/weekly cron routes cover: dormant members (14d), at-risk early warning, machine underutilization, check-in SLA overdue, weekly summary | Confirmed: only 2 cron routes exist (`checkin-deadline`, `dna-recompute`); all 5 agent cron scans are NEW files |
| AGENT-05 | `checkAgentAccess()` tier gating enforced; every fire logged with agent name, trigger event, status, payload; all 13 automations verifiably end-to-end in staging | Confirmed: `checkAgentAccess()` already works correctly; `smartgym_agent_logs` schema complete; staging verification requires UPTIMIZE_WEBHOOK_URL set or a mock receiver |
</phase_requirements>

---

## Summary

Phase 7 (pre-GSD) built complete agent webhook infrastructure: `/api/agents/trigger` route, `triggerUptimizeAIAgent()` helper, `gym_agent_config` table, `smartgym_agent_logs` table, and `checkAgentAccess()` tier gating. The billing webhook already fires 3 of the 13 agents (retention on cancel, revenue on payment-failed, engagement on trial-ending). Everything logs correctly. The critical gap: the trigger route logs to the DB and returns `{ success: true }` — it does NOT forward to any external UptimizeAI endpoint. Phase 5 is primarily wiring work.

There are four distinct work streams: (1) add the external forwarding fetch to `/api/agents/trigger` (AGENT-01), (2) add cooldown dedup + `is_agent_initiated` loop-safety (AGENT-02), (3) add `triggerUptimizeAIAgent()` call sites to 5 existing routes (AGENT-03), and (4) create 3 new cron routes covering the 5 scheduled automation triggers (AGENT-04). The `UPTIMIZE_WEBHOOK_URL` and `UPTIMIZE_API_KEY` env vars do not exist in `.env.example` — the phase must either configure a real endpoint or deploy a lightweight echo/mock receiver for staging verification.

**Primary recommendation:** Build AGENT-02 dedup first (migration + cooldown check in trigger route), then AGENT-01 forwarding, then AGENT-03 call sites, then AGENT-04 cron routes. Never add a call site before the dedup guard exists — per Pitfall 7.

---

## Codebase Ground Truth

### What EXISTS (verified by file read)

| Asset | File | Status |
|-------|------|--------|
| Agent trigger route | `apps/web-admin/src/app/api/agents/trigger/route.ts` | EXISTS — logs to DB, no external forwarding |
| triggerUptimizeAIAgent helper | `apps/web-admin/src/lib/billing/triggerAgent.ts` | EXISTS — POSTs to internal route with INTERNAL_WEBHOOK_KEY |
| checkAgentAccess() | `apps/web-admin/src/lib/billing/featureGate.ts` | EXISTS — full tier check, correct |
| Tier definitions | `apps/web-admin/src/lib/billing/tiers.ts` | EXISTS — starter=[], growth=[retention,engagement], pro=[all 5] |
| KNOWN_AGENTS list | trigger route | EXISTS — 5 agents: retention, engagement, revenue, operations, growth |
| gym_agent_config table | migration 001 | EXISTS — gym_id, agent_id, enabled bool, custom_config jsonb, last_fired_at timestamptz, fire_count int, UNIQUE(gym_id, agent_id) |
| smartgym_agent_logs table | migration 001 | EXISTS — gym_id, member_id, agent_name, trigger_event, action_taken, channel, status (sent/failed/pending/skipped), error_message, payload, executed_at |
| Billing webhook agent wiring | `apps/web-admin/src/app/api/billing/webhook/route.ts` | EXISTS — 3 agents wired (subscription_cancelled→retention, payment_failed→revenue, trial_ending→engagement) |
| send-push-notification Edge Function | `supabase/functions/send-push-notification/index.ts` | EXISTS — checks `notification_preferences.enabled` (boolean only), sends via Expo Push API, logs to `notification_log` |
| notification_log table | migration 019 | EXISTS — profile_id, type, title, body, data jsonb, status (sent/failed), expo_receipt_id |
| device_tokens table | migration 019 | EXISTS — profile_id, expo_push_token, platform, active bool, UNIQUE(profile_id, expo_push_token) |
| push/send route | `apps/web-admin/src/app/api/push/send/route.ts` | EXISTS — owner-broadcast only; inserts into `notifications` table; does NOT call Edge Function or check push preferences per-member |
| checkin-deadline cron | `apps/web-admin/src/app/api/cron/checkin-deadline/route.ts` | EXISTS — auto-sends overdue check-ins; no agent trigger |
| dna-recompute cron | `apps/web-admin/src/app/api/cron/dna-recompute/route.ts` | EXISTS — weekly DNA recompute; no agent trigger |
| at-risk route | `apps/web-admin/src/app/api/owner/at-risk/route.ts` | EXISTS — computes at-risk members; NO agent call |
| challenge complete route | `apps/web-admin/src/app/api/challenges/[challengeId]/complete/route.ts` | EXISTS — deactivates challenge; NO agent call |
| session complete route | `apps/web-admin/src/app/api/sessions/[sessionId]/complete/route.ts` | EXISTS — awards points, checks achievements, generates feed events; NO agent calls |

### What DOES NOT EXIST (must be built)

| Missing Asset | Required For |
|---------------|-------------|
| `UPTIMIZE_WEBHOOK_URL` env var | AGENT-01 forwarding |
| `UPTIMIZE_API_KEY` env var | AGENT-01 forwarding authentication |
| External forwarding fetch in trigger route | AGENT-01 |
| Cooldown dedup logic in trigger route | AGENT-02 |
| Migration adding `created_at` alias / dedup index on `smartgym_agent_logs(gym_id, agent_name, trigger_event, executed_at)` — partial index for time-window queries | AGENT-02 |
| `is_agent_initiated` field in agent payload schema | AGENT-02 loop safety |
| `triggerUptimizeAIAgent` call in session complete route (level-up, streak-broken, leaderboard-updated) | AGENT-03 |
| `triggerUptimizeAIAgent` call in feature gate denial path | AGENT-03 |
| `triggerUptimizeAIAgent` call in at-risk route | AGENT-03 |
| `triggerUptimizeAIAgent` call in challenge complete route | AGENT-03 |
| `triggerUptimizeAIAgent` call in onboard register route (new-gym-onboarded) | AGENT-03 |
| `api/cron/agent-daily/route.ts` — dormant members + machine underutilization scans | AGENT-04 |
| `api/cron/agent-weekly/route.ts` — weekly summary + churn risk alert | AGENT-04 |
| Staging verification strategy (mock receiver or real UPTIMIZE_WEBHOOK_URL) | AGENT-05 |
| `lib/notifications/dispatcher.ts` — minimal core for Phase 5 agent outputs | Phase 5/6 ordering decision |

---

## Standard Stack

### Core (all already installed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@supabase/supabase-js` | v2 | DB admin client for agent log inserts + dedup queries | Already the pattern in all 40+ API routes |
| `zod` | v3 | Payload validation in trigger route | Already used in trigger route today |
| Next.js App Router API routes | v14 | Cron route handlers + agent wiring | Existing infra |
| `INTERNAL_WEBHOOK_KEY` auth pattern | — | Cron-to-route and internal-to-route auth | Already used in both cron routes + trigger route |

### New Env Vars Required

| Var | Purpose | Staging Value |
|-----|---------|---------------|
| `UPTIMIZE_WEBHOOK_URL` | External agent engine endpoint | Set to echo receiver URL (see Staging section) |
| `UPTIMIZE_API_KEY` | Auth header to UptimizeAI | Set to any non-empty string for staging mock |

These must be added to `apps/web-admin/.env.example` and documented in `DEMO_SETUP.md`.

---

## Architecture Patterns

### Pattern 1: Trigger Route Forwarding (AGENT-01)

The trigger route must return quickly — it is called fire-and-forget from billing webhooks. The external POST must not block the INSERT or the response.

```typescript
// After admin.from('smartgym_agent_logs').insert(...) in trigger/route.ts
// Capture log id from insert result for correlation
const { data: logRow } = await admin.from('smartgym_agent_logs').insert({...}).select('id').single();

const webhookUrl = process.env.UPTIMIZE_WEBHOOK_URL;
if (webhookUrl) {
  fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-uptimize-key': process.env.UPTIMIZE_API_KEY ?? '',
    },
    body: JSON.stringify({ agent_name, payload, log_id: logRow?.id }),
    signal: AbortSignal.timeout(10_000),
  }).catch(async (err) => {
    console.error('[agents/trigger] forward failed:', err);
    // Update log row to status: 'failed'
    await admin.from('smartgym_agent_logs')
      .update({ status: 'failed', error_message: String(err) })
      .eq('id', logRow?.id);
  });
}
return NextResponse.json({ success: true });
```

Key details:
- Insert must now use `.select('id').single()` to capture the log row id for failure updates
- `AbortSignal.timeout(10_000)` prevents the fire-and-forget from hanging forever
- `.catch()` updates the log row to `'failed'` status — satisfies AGENT-01 failure recording requirement
- `UPTIMIZE_WEBHOOK_URL` absent = skip forwarding (local dev / Starter tier passthrough)

### Pattern 2: Cooldown Dedup (AGENT-02)

Query `smartgym_agent_logs` before firing — check same `(gym_id, agent_name, trigger_event)` within the cooldown window. Log `'skipped'` if within window.

```typescript
// In trigger/route.ts — before the INSERT, after checkAgentAccess passes
const COOLDOWN_MINUTES: Record<string, number> = {
  'retention-agent': 60 * 24 * 7,   // 7 days
  'engagement-agent': 60 * 24,       // 24 hours
  'revenue-agent': 60 * 24,          // 24 hours
  'operations-agent': 60 * 24 * 7,   // 7 days
  'growth-agent': 60 * 24 * 7,       // 7 days
};

const triggerEvent = (payload.event as string) || 'unknown';
const windowMinutes = COOLDOWN_MINUTES[agent_name] ?? 60;
const windowStart = new Date(Date.now() - windowMinutes * 60_000).toISOString();

const { data: recent } = await admin
  .from('smartgym_agent_logs')
  .select('id')
  .eq('gym_id', gymId)
  .eq('agent_name', agent_name)
  .eq('trigger_event', triggerEvent)
  .eq('status', 'sent')
  .gte('executed_at', windowStart)
  .limit(1);

if (recent && recent.length > 0) {
  await admin.from('smartgym_agent_logs').insert({
    gym_id: gymId, agent_name, trigger_event: triggerEvent,
    status: 'skipped', error_message: 'Cooldown window active', payload,
  });
  return NextResponse.json({ success: true, skipped: true, reason: 'cooldown' });
}
```

Note: the `executed_at` column already exists on `smartgym_agent_logs`. The existing `idx_agent_logs_gym_time` index on `(gym_id, executed_at DESC)` will be used. A composite index on `(gym_id, agent_name, trigger_event, executed_at DESC)` should be added in migration 029 for sub-millisecond dedup queries at scale.

### Pattern 3: is_agent_initiated Loop Guard (AGENT-02)

The `is_agent_initiated: boolean` field must be added to the trigger payload schema so the Phase 6 notification dispatcher can detect and break agent→notification→agent loops.

```typescript
// In trigger/route.ts — extend triggerPayloadSchema
const triggerPayloadSchema = z.object({
  event: z.string().max(100).optional(),
  is_agent_initiated: z.boolean().optional(),  // ADD THIS
}).passthrough();
```

When Phase 6 dispatcher wires notifications, it checks `data.is_agent_initiated === true` and skips re-triggering agents. This flag must be in the schema BEFORE any call site goes live — even though Phase 6 uses it, Phase 5 establishes it.

### Pattern 4: Event-Driven Call Sites (AGENT-03)

All call sites follow the same fire-and-forget pattern from the billing webhook:

```typescript
triggerUptimizeAIAgent('engagement-agent', {
  event: 'level-up',
  gym_id: session.gym_id,
  member_id: member_id,
  new_level: achievements.newLevel?.level,
  is_agent_initiated: false,
}).catch(err => console.error('[session-complete] level-up agent trigger failed:', err));
```

Never `await` a trigger call in a user-facing request path. Always `.catch()` to prevent unhandled rejection.

### Pattern 5: Cron Route Structure (AGENT-04)

Follow the pattern from `checkin-deadline/route.ts` exactly:

```typescript
// apps/web-admin/src/app/api/cron/agent-daily/route.ts
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  // 1. Validate INTERNAL_WEBHOOK_KEY (x-smartgym-internal-key OR Authorization: Bearer)
  // 2. Get admin client
  // 3. Scan for eligible targets (dormant members, underutilized machines)
  // 4. For each eligible: triggerUptimizeAIAgent(...).catch(console.error)
  // 5. Return { triggered: N }
}
```

The Authorization: Bearer fallback is needed because pg_cron calls routes with `Authorization: Bearer <key>` not the custom header.

### Pattern 6: Staging Verification Strategy (AGENT-05)

UptimizeAI external service is not configured (no `UPTIMIZE_WEBHOOK_URL` in `.env.example`, no real endpoint discovered in codebase). For staging verification, use a lightweight echo receiver route:

```typescript
// apps/web-admin/src/app/api/dev/agent-echo/route.ts
// Only active when DEMO_ECHO_AGENTS=true (never in production)
export async function POST(request: Request) {
  if (process.env.DEMO_ECHO_AGENTS !== 'true') {
    return NextResponse.json({ error: 'Not available' }, { status: 404 });
  }
  const body = await request.json();
  console.log('[agent-echo] received:', JSON.stringify(body));
  // Insert into smartgym_agent_logs with status 'echoed' for traceability
  return NextResponse.json({ echoed: true, agent_name: body.agent_name, log_id: body.log_id });
}
```

Set `UPTIMIZE_WEBHOOK_URL=http://localhost:3000/api/dev/agent-echo` in the demo `.env` and `DEMO_ECHO_AGENTS=true`. This makes every agent trigger visibly log in the console and return a verifiable response — all 13 automations can be confirmed end-to-end in staging without a real UptimizeAI endpoint.

### Pattern 7: Phase 5 vs Phase 6 Notification Dispatcher Decision

**Decision required by planner:** Most of the 13 agents are designed to output member push notifications. Phase 6 builds the full notification dispatcher. Phase 5 must decide:

**Option A — Minimal dispatcher stub in Phase 5 (Wave 1 plan)**
Build `lib/notifications/dispatcher.ts` as a thin wrapper that calls the `send-push-notification` Edge Function. No preferences check yet. Phase 6 hardens it with dedup, quiet hours, and per-category preferences. This gives agents a real output channel in Phase 5.

**Option B — Scope Phase 5 agent outputs to owner email + logs only**
Phase 5 agents fire, get forwarded to UptimizeAI, and log. The UptimizeAI engine is responsible for generating and delivering member-facing pushes. Phase 5 code never touches `send-push-notification`. Phase 6 wires the notification triggers for the events that do NOT come from agents.

**Recommendation: Option B for Phase 5.**
Rationale:
1. `UPTIMIZE_WEBHOOK_URL` is the agent output channel — UptimizeAI handles its own push delivery, not this codebase.
2. The notification dispatcher in Phase 6 wires 24+ triggers from *internal* events (session complete, check-in reply, etc.). Agent-originated pushes go through a different path (external engine → its own push API or calls back to send-push-notification Edge Function directly with `is_agent_initiated: true`).
3. Building a partial dispatcher in Phase 5 that works differently from the final Phase 6 dispatcher creates technical debt and potential double-fire on events that are both agent-triggered AND internally-triggered.
4. The `is_agent_initiated` flag in the payload schema is Phase 5's contribution to loop safety — it is used by Phase 6's dispatcher, not Phase 5's.
5. Phase 5's observable output is `smartgym_agent_logs` rows + the echo receiver confirming UptimizeAI reception — this fully satisfies AGENT-05.

**If the planner disagrees:** Option A is viable if UptimizeAI is confirmed to be a pure decision-engine that returns actions but does not deliver pushes itself (i.e., it calls back to the app). In that case, build the minimal dispatcher in Wave 1 of Phase 5 and explicitly document that Phase 6 hardens it.

---

## The 13 Automations: Exact Trigger Map

Based on FEATURES.md specification + confirmed codebase state:

**Retention Agent (Growth+) — 3 automations**

| # | Trigger Event | Source | Wiring Status | Cooldown |
|---|--------------|--------|---------------|---------|
| 1 | `subscription-cancelled` | `billing/webhook` on `subscription_cancelled` action | ALREADY WIRED | N/A (event-driven, rare) |
| 2 | `member-at-risk` | `owner/at-risk/route.ts` GET handler — add fire-and-forget call | NEEDS WIRING | 7 days per (gym, member) |
| 3 | `member-inactive-14d` | New `api/cron/agent-daily/route.ts` — scan `members.last_session_date` | NEW CRON | 7 days per (gym, member) |

**Engagement Agent (Growth+) — 3 automations**

| # | Trigger Event | Source | Wiring Status | Cooldown |
|---|--------------|--------|---------------|---------|
| 4 | `trial-ending-soon` | `billing/webhook` on `trial_ending` action | ALREADY WIRED | N/A (event-driven) |
| 5 | `level-up` | `sessions/[id]/complete/route.ts` — add call when `achievements.leveledUp === true` | NEEDS WIRING | 24h per member |
| 6 | `streak-broken` | `sessions/[id]/complete/route.ts` — add call when `streak < prior streak` (need prior streak from member data already fetched) | NEEDS WIRING | 24h per member |

**Revenue Agent (Pro) — 2 automations**

| # | Trigger Event | Source | Wiring Status | Cooldown |
|---|--------------|--------|---------------|---------|
| 7 | `payment-failed` | `billing/webhook` on `payment_failed` action | ALREADY WIRED | N/A (event-driven) |
| 8 | `upgrade-opportunity` | `featureGate.ts` `checkFeatureAccess()` when `hasAccess: false` | NEEDS WIRING | 7 days per (gym, feature) |

**Operations Agent (Pro) — 3 automations**

| # | Trigger Event | Source | Wiring Status | Cooldown |
|---|--------------|--------|---------------|---------|
| 9 | `weekly-summary` | New `api/cron/agent-weekly/route.ts` — runs Sunday UTC | NEW CRON | 7 days per gym |
| 10 | `machine-underutilized` | New `api/cron/agent-daily/route.ts` — scan `machine_scan_events` for 0-count machines | NEW CRON | 7 days per (gym, machine) |
| 11 | `checkin-sla-overdue` | New `api/cron/agent-daily/route.ts` — scan `weekly_checkins` for `trainer_approved=false AND sent_at IS NULL AND created_at < 48h ago` | NEW CRON (reuse query from `checkin-deadline` cron) |  7 days per check-in |

**Growth Agent (Pro) — 2 automations**

| # | Trigger Event | Source | Wiring Status | Cooldown |
|---|--------------|--------|---------------|---------|
| 12 | `challenge-ended` | `challenges/[challengeId]/complete/route.ts` — add call after deactivation | NEEDS WIRING | N/A (event-driven, per challenge) |
| 13 | `new-gym-onboarded` | `api/onboard/register/route.ts` — add call after successful gym creation | NEEDS WIRING | N/A (event-driven, once per gym) |

**Leaderboard-updated (maps to engagement-agent) — additional call site**

Per REQUIREMENTS.md AGENT-03: "leaderboard-updated" must also fire from session complete. This is the challenge score update path: after `updateChallengeScores()` detects a rank change, add trigger for `engagement-agent` with event `leaderboard-updated`. The `challengeScoring.ts` lib would need to return rank-change data, or the session complete route can fire it unconditionally after challenge score update.

**Total wiring changes to existing routes: 5**
**New cron routes: 2** (`agent-daily`, `agent-weekly`)
**New lib changes: 1** (trigger route: forwarding + dedup + `is_agent_initiated`)

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| External HTTP forward with failure recording | Custom retry queue | Simple fire-and-forget `.catch()` that updates log row to `'failed'` | At this scale, a failed agent fire is observable and recoverable; a queue adds infrastructure cost that isn't justified |
| Cooldown dedup | Redis/in-memory TTL | Query `smartgym_agent_logs` with `gte('executed_at', windowStart)` | `smartgym_agent_logs` already exists, already indexed on `(gym_id, executed_at DESC)`; Postgres is the right store for this |
| Message queue for agent triggers | BullMQ / SQS | Fire-and-forget from API routes | ARCHITECTURE.md explicitly recommends against this for Tier 1 |
| Custom webhook authentication | OAuth / JWT | `INTERNAL_WEBHOOK_KEY` header pattern | Already established in 2 cron routes and the trigger route |
| Cron scheduling in application code | `node-cron` / `setInterval` | pg_cron (already running 8 jobs in DB) + Next.js route as the handler | pg_cron is already configured; routes are the right handler target |

---

## Common Pitfalls

### Pitfall 1: Wiring Call Sites Before Dedup Guard Exists
**What goes wrong:** First call to trigger agent from session complete route fires before cooldown check is in trigger route. One high-volume gym (100 workouts/day) fires `engagement-agent` 100 times before anyone notices.
**How to avoid:** Migration 029 (dedup index) + cooldown check in trigger route must be Wave 1, Plan 1 — verified deployed before any new call site is added.
**Warning signs:** `smartgym_agent_logs` row count growing at the same rate as `workout_sessions` row count.

### Pitfall 2: Agent Loop (Pitfall 7 from PITFALLS.md)
**What goes wrong:** UptimizeAI agent receives trigger, calls back into the app to create a notification, notification creation re-triggers the agent. Both agent logs and notification_log flood.
**How to avoid:** `is_agent_initiated: true` in payload schema (Phase 5). Phase 6 dispatcher checks this flag and skips re-triggering agents. The flag in the schema is Phase 5's responsibility even though Phase 6 uses it.
**Warning signs:** `smartgym_agent_logs` rows accumulating faster than one per session; Edge Function invocations spiking in Supabase dashboard.

### Pitfall 3: `status: 'sent'` Logged Before External Forward Confirmed
**What goes wrong:** Trigger route inserts log row as `status: 'sent'` then the external forward fails silently (no `.catch()` updates the row). Observability requirement (AGENT-05) is violated — owner sees 'sent' but UptimizeAI never received the call.
**How to avoid:** Insert with `status: 'sent'`, then in the `.catch()` of the forward fetch, update to `status: 'failed'`. The log row id must be captured from the insert (`.select('id').single()` pattern) to do this update.
**Warning signs:** All log rows show `status: 'sent'` even when UptimizeAI echo receiver shows no incoming calls.

### Pitfall 4: at-risk Route Fires Agent Per GET Request (Not Per Member)
**What goes wrong:** The `/api/owner/at-risk` GET route returns the list of at-risk members. If a single `triggerUptimizeAIAgent` call is added at the route level (one fire per page load), it fires once per owner dashboard visit, not once per at-risk member.
**How to avoid:** Iterate the `atRisk` array; call `triggerUptimizeAIAgent` once per at-risk member with `member_id` in the payload. The cooldown check prevents re-firing for the same member within 7 days even if the owner visits the dashboard multiple times.
**Warning signs:** `smartgym_agent_logs` shows `member_id: null` for retention-agent rows from the at-risk route.

### Pitfall 5: streak-broken Detection is Ambiguous
**What goes wrong:** The session complete route computes `streak` from recent sessions. "Streak broken" means the current streak (e.g., 3) is less than the member's `best_streak` (e.g., 15). But a member whose first-ever session streak is 3 also has `streak < best_streak` (0). Triggering the engagement agent on a new member's first session is wrong.
**How to avoid:** Fire `streak-broken` only when `previousStreak > 1 AND streak === 1` — i.e., the member was on a streak of at least 2 days that just reset to 1. The member's `current_streak` column before the update serves as `previousStreak`. It is already fetched in the `memberResult` query (as `best_streak`) — but `current_streak` is not currently fetched. Add `current_streak` to the members SELECT in session complete.
**Warning signs:** `engagement-agent` firing for new members with event `streak-broken` when they have only 1 session.

### Pitfall 6: Challenge-ended Agent Fires in Wrong Place
**What goes wrong:** The `challenges/[challengeId]/complete` route is owner-initiated (POST from dashboard). Adding the agent trigger there means the agent fires only when the owner manually marks a challenge complete. If challenges auto-expire (based on `ends_at` date) without any owner action, the agent never fires.
**How to avoid:** The `agent-daily` cron should also scan for challenges where `ends_at < now() AND is_active = true` and both: deactivate them AND fire the growth-agent. The explicit owner-complete route fires the agent too — but the cron handles the auto-expiry case. This means two code paths both fire the agent, each with its own cooldown check.

### Pitfall 7: Cron Batch Size and Timeout
**What goes wrong:** `agent-daily` cron scans all active members for dormancy. A gym with 500 members runs 500 cooldown checks + up to 500 trigger calls. On Vercel Hobby the function timeout is 10s; Pro is 60s. 500 sequential DB queries will timeout.
**How to avoid:** Use the `dna-recompute` pattern: process in batches of 10 with `Promise.allSettled`. For each batch: query cooldown status for all 10 members in one `IN` query, not 10 sequential queries. Fire eligible triggers fire-and-forget (no await in the batch).

---

## Architecture: Build Order for Phase 5

```
Wave 1 — Foundation (must precede all wiring)
  Plan 05-01: Migration 029 (dedup index on smartgym_agent_logs) + is_agent_initiated schema
              + UPTIMIZE_WEBHOOK_URL forwarding in trigger route
              + cooldown check in trigger route
              + agent-echo dev route for staging
              + update .env.example with new env vars
              + tests: cooldown dedup, forwarding, skipped status

Wave 2 — Event-driven call sites (AGENT-03)
  Plan 05-02: Session complete wiring (level-up, streak-broken, leaderboard-updated)
              + challenge-ended wiring
              + at-risk route wiring (per-member)
              Tests: each new call site fires correct agent + dedup prevents double-fire

  Plan 05-03: Feature-gate upgrade-opportunity wiring
              + new-gym-onboarded wiring (onboard/register route)
              Tests: upgrade-opportunity fires for Pro-only feature denied to Growth; onboard fires once

Wave 3 — Cron scans (AGENT-04)
  Plan 05-04: api/cron/agent-daily/route.ts
              (dormant-members scan, machine-underutilization scan, checkin-SLA-overdue scan,
               challenge auto-expiry scan)
              Tests: each scan type with mocked DB returns

  Plan 05-05: api/cron/agent-weekly/route.ts
              (weekly-summary, churn-risk-alert)
              Tests: weekly summary fires for active gyms; suppressed for zero-member gyms

Wave 4 — Phase gate
  Plan 05-06: End-to-end staging verification against demo environment (Iron Society)
              All 13 automations triggered via echo receiver, logs inspected
              Tier gating: Starter gets 0 fires, Growth gets 5, Pro gets 13
              All 13 visible in smartgym_agent_logs
```

---

## Code Examples

### Verified Dedup Query Pattern (HIGH confidence — derived from existing schema)

```typescript
// Cooldown check — uses existing idx_agent_logs_gym_time index
const windowStart = new Date(Date.now() - windowMinutes * 60_000).toISOString();

const { data: recent } = await admin
  .from('smartgym_agent_logs')
  .select('id')
  .eq('gym_id', gymId)
  .eq('agent_name', agent_name)
  .eq('trigger_event', triggerEvent)
  .eq('status', 'sent')
  .gte('executed_at', windowStart)
  .limit(1);

const isDuplicate = (recent?.length ?? 0) > 0;
```

### Migration 029 Pattern (HIGH confidence — follows existing migration conventions)

```sql
-- Migration 029: Agent dedup index + is_agent_initiated in payload schema (enforced by app)
-- Note: is_agent_initiated is stored in the payload jsonb column — no schema migration needed for it.
-- The dedup index is what needs a migration.

CREATE INDEX IF NOT EXISTS idx_agent_logs_dedup
  ON smartgym_agent_logs(gym_id, agent_name, trigger_event, executed_at DESC)
  WHERE status = 'sent';

-- Optional: index for per-member dedup queries (at-risk, dormant retention scenarios)
CREATE INDEX IF NOT EXISTS idx_agent_logs_member_dedup
  ON smartgym_agent_logs(gym_id, agent_name, member_id, executed_at DESC)
  WHERE member_id IS NOT NULL AND status = 'sent';
```

### Session Complete: Streak-Broken Detection (HIGH confidence — current code read)

```typescript
// In sessions/[sessionId]/complete/route.ts — add current_streak to member SELECT
const [memberResult, ...] = await Promise.all([
  admin.from('members')
    .select('smartgym_score, best_streak, current_streak, display_name')  // ADD current_streak
    .eq('id', member_id).single(),
  ...
]);

const previousStreak = memberResult.data?.current_streak || 0;
// After computing new streak...
if (previousStreak > 1 && streak === 1) {
  triggerUptimizeAIAgent('engagement-agent', {
    event: 'streak-broken',
    gym_id: session.gym_id,
    member_id,
    previous_streak: previousStreak,
    is_agent_initiated: false,
  }).catch(err => console.error('[session-complete] streak-broken agent failed:', err));
}
```

### Cron Batch Processing Pattern (HIGH confidence — mirrors dna-recompute)

```typescript
// In api/cron/agent-daily/route.ts — dormant member scan
const { data: dormantMembers } = await admin
  .from('members')
  .select('id, gym_id')
  .eq('status', 'active')
  .lt('last_session_date', fourteenDaysAgo);

// Process in batches of 10
for (let i = 0; i < (dormantMembers?.length ?? 0); i += 10) {
  const batch = dormantMembers!.slice(i, i + 10);
  await Promise.allSettled(
    batch.map(m =>
      triggerUptimizeAIAgent('retention-agent', {
        event: 'member-inactive-14d',
        gym_id: m.gym_id,
        member_id: m.id,
        is_agent_initiated: false,
      }).catch(err => console.error('[agent-daily] dormant trigger failed:', err))
    )
  );
}
```

---

## State of the Art

| Old Approach | Current Approach | Status |
|--------------|------------------|--------|
| agent/trigger only logs to DB | agent/trigger logs + forwards to UPTIMIZE_WEBHOOK_URL | Phase 5 adds forwarding |
| No cooldown dedup | Per-(gym, agent, event, window) cooldown check via smartgym_agent_logs | Phase 5 adds this |
| 3 of 13 automations wired (Stripe billing only) | All 13 wired via events + crons | Phase 5 completes this |
| No cron agent scans | 2 new cron routes covering 5 scheduled triggers | Phase 5 adds crons |

---

## Open Questions

1. **Is UptimizeAI a real external endpoint or will it be built in a future phase?**
   - What we know: `UPTIMIZE_WEBHOOK_URL` is absent from `.env.example`; `uptimize-engine` directory was mentioned in architecture research but is not in this monorepo
   - What's unclear: Whether the external engine exists and needs credentials, or whether Phase 5 must treat UptimizeAI as a black box with a mock receiver indefinitely
   - Recommendation: Use the echo receiver route for staging; add `UPTIMIZE_WEBHOOK_URL` and `UPTIMIZE_API_KEY` to `.env.example` with clear `# REQUIRED: contact UptimizeAI team` comments; document in `DEMO_SETUP.md`

2. **Does `leaderboard-updated` require returning rank-change data from `updateChallengeScores`?**
   - What we know: `challengeScoring.ts` currently returns `void`; session complete calls it fire-and-forget
   - What's unclear: Whether the agent should fire for every challenge score update or only when rank changes
   - Recommendation: For Phase 5 simplicity, fire `engagement-agent` with event `leaderboard-updated` unconditionally after `updateChallengeScores` completes. Cooldown window (24h) prevents flooding. Rank-aware firing is a Phase 6+ enhancement.

3. **Should the `upgrade-opportunity` trigger fire in `checkFeatureAccess` or in a separate route?**
   - What we know: `checkFeatureAccess` is called from many routes; adding a trigger call there affects all call sites simultaneously
   - What's unclear: Whether the revenue-agent should fire on every denied access or only on specific high-value feature gates (e.g., AI programs, challenges)
   - Recommendation: Add a `shouldTriggerUpgradeAgent(feature: FeatureKey): boolean` guard that returns true only for `ai_programs`, `challenges`, `coach_notes`, `custom_branding` — the features most likely to represent upgrade intent. Wire in the callers of `checkFeatureAccess` that handle `hasAccess: false`, not inside `checkFeatureAccess` itself (to avoid triggering from internal admin bypasses).

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Jest + ts-jest (configured) |
| Config file | `apps/web-admin/jest.config.js` |
| Quick run command | `cd apps/web-admin && npx jest --testPathPattern="agents\|triggerAgent\|agent-daily\|agent-weekly"` |
| Full suite command | `cd apps/web-admin && npx jest` |

Current test baseline: 347 web-admin tests across 32 test files.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AGENT-01 | Forwarding fetch called with correct payload when UPTIMIZE_WEBHOOK_URL set | unit | `npx jest --testPathPattern="agents/trigger"` | ❌ Wave 1 |
| AGENT-01 | `status: 'failed'` logged when forward fetch throws | unit | `npx jest --testPathPattern="agents/trigger"` | ❌ Wave 1 |
| AGENT-01 | No forwarding attempt when UPTIMIZE_WEBHOOK_URL absent | unit | `npx jest --testPathPattern="agents/trigger"` | ❌ Wave 1 |
| AGENT-02 | Cooldown check returns 'skipped' log when same (gym, agent, event) within window | unit | `npx jest --testPathPattern="agents/trigger"` | ❌ Wave 1 |
| AGENT-02 | Cooldown check passes when outside window | unit | `npx jest --testPathPattern="agents/trigger"` | ❌ Wave 1 |
| AGENT-02 | `is_agent_initiated` present in payload schema (passthrough) | unit | `npx jest --testPathPattern="agents/trigger"` | ❌ Wave 1 |
| AGENT-03 | session-complete fires engagement-agent on level-up | unit | `npx jest --testPathPattern="session.*complete"` | ❌ Wave 2 |
| AGENT-03 | session-complete fires engagement-agent on streak-broken (prev > 1, current = 1) | unit | `npx jest --testPathPattern="session.*complete"` | ❌ Wave 2 |
| AGENT-03 | session-complete fires engagement-agent on leaderboard-updated | unit | `npx jest --testPathPattern="session.*complete"` | ❌ Wave 2 |
| AGENT-03 | session-complete does NOT fire streak-broken for first-ever session | unit | `npx jest --testPathPattern="session.*complete"` | ❌ Wave 2 |
| AGENT-03 | challenge-complete fires growth-agent | unit | `npx jest --testPathPattern="challenges.*complete"` | ❌ Wave 2 |
| AGENT-03 | at-risk route fires retention-agent per at-risk member | unit | `npx jest --testPathPattern="at-risk"` | ❌ Wave 2 |
| AGENT-03 | upgrade-opportunity fires revenue-agent for guarded features | unit | `npx jest --testPathPattern="featureGate"` | ❌ Wave 2 |
| AGENT-04 | agent-daily cron identifies dormant members and fires retention-agent | unit | `npx jest --testPathPattern="agent-daily"` | ❌ Wave 3 |
| AGENT-04 | agent-daily cron identifies underutilized machines and fires operations-agent | unit | `npx jest --testPathPattern="agent-daily"` | ❌ Wave 3 |
| AGENT-04 | agent-weekly cron fires operations-agent with weekly-summary event | unit | `npx jest --testPathPattern="agent-weekly"` | ❌ Wave 3 |
| AGENT-05 | Starter tier gym receives 0 agent fires (all skipped with tier reason) | unit | `npx jest --testPathPattern="checkAgentAccess"` | partial (featureGate tests exist) |
| AGENT-05 | Growth tier gym fires retention-agent and engagement-agent only | unit | `npx jest --testPathPattern="checkAgentAccess"` | partial |
| AGENT-05 | Pro tier gym fires all 5 agent families | unit | `npx jest --testPathPattern="checkAgentAccess"` | partial |

### Sampling Rate

- **Per task commit:** `cd apps/web-admin && npx jest --testPathPattern="agents\|triggerAgent\|featureGate"`
- **Per wave merge:** `cd apps/web-admin && npx jest`
- **Phase gate:** Full web-admin suite green (347+ tests) + tsc clean before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `apps/web-admin/src/app/api/agents/trigger/__tests__/trigger.test.ts` — covers AGENT-01 + AGENT-02 (forwarding, dedup, skipped status, loop guard)
- [ ] `apps/web-admin/src/app/api/sessions/[sessionId]/complete/__tests__/complete-agents.test.ts` — covers AGENT-03 session-complete wiring (level-up, streak-broken, leaderboard-updated)
- [ ] `apps/web-admin/src/app/api/cron/agent-daily/__tests__/agent-daily.test.ts` — covers AGENT-04 daily scan
- [ ] `apps/web-admin/src/app/api/cron/agent-weekly/__tests__/agent-weekly.test.ts` — covers AGENT-04 weekly scan

---

## Sources

### Primary (HIGH confidence)

- Direct file read: `apps/web-admin/src/app/api/agents/trigger/route.ts` — confirmed exact current state
- Direct file read: `apps/web-admin/src/lib/billing/triggerAgent.ts` — confirmed helper shape
- Direct file read: `apps/web-admin/src/lib/billing/tiers.ts` — confirmed tier-to-agent mapping
- Direct file read: `apps/web-admin/src/lib/billing/featureGate.ts` — confirmed checkAgentAccess logic
- Direct file read: `apps/web-admin/src/app/api/billing/webhook/route.ts` — confirmed 3 wired triggers
- Direct file read: `apps/web-admin/src/app/api/sessions/[sessionId]/complete/route.ts` — confirmed 0 agent calls
- Direct file read: `apps/web-admin/src/app/api/owner/at-risk/route.ts` — confirmed 0 agent calls
- Direct file read: `apps/web-admin/src/app/api/challenges/[challengeId]/complete/route.ts` — confirmed 0 agent calls
- Direct file read: `supabase/migrations/001_nexera_schema.sql` — confirmed `smartgym_agent_logs` schema + `gym_agent_config` schema
- Direct file read: `supabase/migrations/019_missing_tables.sql` — confirmed `device_tokens` + `notification_log` schema
- Direct file read: `supabase/functions/send-push-notification/index.ts` — confirmed Edge Function interface
- Direct file read: `apps/web-admin/.env.example` — confirmed UPTIMIZE vars absent
- Direct file read: `apps/web-admin/src/app/api/cron/checkin-deadline/route.ts` — confirmed cron route pattern
- Direct file read: `apps/web-admin/src/app/api/cron/dna-recompute/route.ts` — confirmed batch processing pattern
- Direct file read: `.planning/research/ARCHITECTURE.md` — Feature 5 section
- Direct file read: `.planning/research/PITFALLS.md` — Pitfall 7 (agent loop)
- Direct file read: `.planning/research/FEATURES.md` — 13 automations spec

### Secondary (MEDIUM confidence)

- `.planning/REQUIREMENTS.md` AGENT-01..05 — confirmed requirements text + "dead-table references verified resolved via migrations 024-026" claim
- `.planning/ROADMAP.md` Phase 5 dependency note — confirmed Phase 5 ↔ Phase 6 ordering tension

---

## Metadata

**Confidence breakdown:**
- Existing infra (trigger route, helper, tiers, featureGate): HIGH — all files directly read
- Dedup pattern: HIGH — schema verified, index pattern follows established migration conventions
- 13 automations trigger map: HIGH — cross-referenced FEATURES.md spec with actual route file states
- UptimizeAI external endpoint: LOW — no env vars, no real endpoint found; staging strategy is a recommendation
- Phase 5 vs Phase 6 dispatcher decision: MEDIUM — recommendation based on architecture inference; planner must confirm

**Research date:** 2026-07-19
**Valid until:** 2026-08-19 (stable domain — only stale if UPTIMIZE_WEBHOOK_URL gets configured externally)

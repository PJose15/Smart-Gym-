# Architecture Research

**Domain:** Multi-tenant gym SaaS — Tier 1 Launch Blocker Integration
**Researched:** 2026-06-03
**Confidence:** HIGH (derived from direct file-by-file audit of 524 source files)

---

## System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│  apps/web-admin  (Next.js 14 App Router, Vercel)                    │
│  ┌──────────────┐ ┌──────────────┐ ┌────────────┐ ┌─────────────┐  │
│  │ owner/*      │ │ (member)/*   │ │ (trainer)/ │ │ admin/*     │  │
│  │ onboard/*    │ │ gym/ feed    │ │ members/   │ │ agents/     │  │
│  └──────┬───────┘ └──────┬───────┘ └─────┬──────┘ └──────┬──────┘  │
│         └────────────────┴───────────────┴───────────────┘          │
│                          api/ (122 routes)                           │
│   verifyMember() · verifyStaff('owner') · verifySuperAdmin()         │
│   CSRF middleware (apps/web-admin/middleware.ts)                     │
└────────────────────────────┬────────────────────────────────────────┘
                             │ Supabase JS v2
┌────────────────────────────▼────────────────────────────────────────┐
│  Supabase                                                            │
│  ┌─────────────┐ ┌──────────────┐ ┌────────────────────────────┐   │
│  │ Auth        │ │ Postgres     │ │ Edge Functions (Deno)      │   │
│  │ (session +  │ │ 56 tables    │ │ send-push-notification     │   │
│  │  OTP + PW)  │ │ RLS on all  │ │ ai-generate                │   │
│  └─────────────┘ └──────────────┘ │ trainer-copilot            │   │
│  ┌─────────────┐ ┌──────────────┐ └────────────────────────────┘   │
│  │ 8 cron jobs │ │ 9 views      │                                   │
│  └─────────────┘ └──────────────┘                                   │
└────────────────────────────┬────────────────────────────────────────┘
                             │ REST + auth tokens
┌────────────────────────────▼────────────────────────────────────────┐
│  apps/mobile  (Expo SDK ~52, React Native)                          │
│  app/_layout.tsx (session guard + push registration)                │
│  app/(tabs)/  index | scan | progress | profile                     │
│  AsyncStorage cache · offlineQueue · notificationService            │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Feature 1: Owner Self-Serve Onboarding

### Where Signup Lives

Create a new unauthenticated route group `apps/web-admin/src/app/(onboard)/` to keep onboarding entirely outside the existing `owner/` layout (which requires a session and an active `owner` role in `gym_memberships`).

```
apps/web-admin/src/app/
└── (onboard)/
    ├── layout.tsx              NEW — no auth check, unauthenticated shell
    ├── signup/
    │   └── page.tsx            NEW — Step 1: name / email / gym name / password
    ├── verify-email/
    │   └── page.tsx            NEW — Step 2: "check your inbox" holding screen
    ├── subscribe/
    │   └── page.tsx            NEW — Step 3: tier picker → Stripe Checkout redirect
    └── setup/
        ├── page.tsx            NEW — Step 4: first machine wizard
        └── import/
            └── page.tsx        NEW — Optional: CSV member import
```

The existing `apps/web-admin/middleware.ts` passes `/m/*` through; add `/(onboard)/` to the bypass list so these pages load without a Supabase session.

### Auth Model

1. User hits `/signup` (no session required — CSRF exempt by middleware update).
2. Server Action or API route `POST /api/onboard/register`:
   - Calls `supabase.auth.signUp({ email, password })` using the service-role client (so we control the flow).
   - Creates a row in `gyms` (name, slug derived from gym name).
   - Creates a row in `gym_memberships` `(user_id, gym_id, role: 'owner', status: 'active')`.
   - Creates a row in `gym_settings` with defaults.
   - Creates a row in `gym_billing` with `subscription_status: 'trialing'`.
3. Supabase sends verification email automatically (default behavior).
4. User lands on `/verify-email` waiting screen.
5. After email click, Supabase redirects to `/subscribe?gym_id=<id>` (configure via `emailRedirectTo` in signUp call).
6. `/subscribe` checks session, renders tier cards, calls existing `POST /api/billing/checkout`.

**Tables touched by registration:** `auth.users` (Supabase Auth), `gyms`, `gym_memberships`, `gym_settings`, `gym_billing`.

**New API route needed:** `POST /api/onboard/register` — public, CSRF exempt (add to `CSRF_EXEMPT` array in `apps/web-admin/middleware.ts`), validates with Zod, no `verifyStaff` (pre-auth), uses service-role client.

### Stripe Handoff

The existing `POST /api/billing/checkout` route already supports owner-authenticated checkout. After email verification the user has a session and holds an `owner` role, so `verifyStaff('owner')` will pass. The checkout creates a 30-day trial (`trial_period_days: 30` already in `apps/web-admin/src/lib/billing/stripeHelpers.ts`). This means trial-first with card capture at checkout.

Stripe webhook `apps/web-admin/src/app/api/billing/webhook/route.ts` already handles:
- `customer.subscription.updated` → updates `gym_billing` + `gyms.subscription_tier`
- `customer.subscription.deleted` → sets `subscription_status: 'cancelled'`
- `invoice.payment_failed` → sets `subscription_status: 'past_due'`
- `customer.subscription.trial_will_end` → fires `engagement-agent`

No new webhook handling needed for onboarding.

Stripe success_url is already configured as `/owner/billing?success=true` — that redirects into the authenticated owner area, which is the correct post-subscribe landing page.

### First Machine Wizard

The existing `/machines` page (`apps/web-admin/src/app/machines/page.tsx`, ~850 lines) provides full machine CRUD and QR generation. The onboarding wizard should NOT reuse that page directly — it is a dense CRUD table and will overwhelm a brand-new owner.

**Decision:** Create a lightweight guided wizard at `/setup` that calls the same API endpoints (`POST /api/machines`, `GET /api/machines/[id]/qr`) but with a simpler focused form. Extract the machine creation form fields into a shared component `apps/web-admin/src/components/machines/MachineForm.tsx` (NEW, ~150 lines) that both `/machines` and `/setup` import.

### CSV Member Import

**New API route:** `POST /api/owner/members/import`

- Auth: `verifyStaff('owner')` — existing pattern.
- Parsing: `papaparse` on the server side (already available in Node/Next.js context).
- For each valid CSV row: upsert into `auth.users` via Supabase Admin Auth API (inviteUserByEmail), then insert into `members` and `gym_memberships`.
- RLS implication: use service-role client (`SUPABASE_SERVICE_ROLE_KEY`) — already the pattern used by all staff-initiated admin operations in this codebase.
- Bulk size: 100-row batch limit per request; stream results back as JSON. Do NOT use an Edge Function — the 50KB payload cap on the existing agents endpoint is too small, and Next.js API routes have configurable body size limits.
- New page: `apps/web-admin/src/app/owner/members/import/page.tsx` (NEW, ~200 lines) — drag-and-drop CSV, column mapping UI, preview table, submit.

### New Components to Build

| File | Type | Purpose |
|------|------|---------|
| `apps/web-admin/src/app/(onboard)/layout.tsx` | NEW | Unauthenticated onboarding shell |
| `apps/web-admin/src/app/(onboard)/signup/page.tsx` | NEW | Step 1 registration form |
| `apps/web-admin/src/app/(onboard)/verify-email/page.tsx` | NEW | Step 2 holding screen |
| `apps/web-admin/src/app/(onboard)/subscribe/page.tsx` | NEW | Step 3 tier picker |
| `apps/web-admin/src/app/(onboard)/setup/page.tsx` | NEW | Step 4 first machine wizard |
| `apps/web-admin/src/app/(onboard)/setup/import/page.tsx` | NEW | CSV member import UI |
| `apps/web-admin/src/app/api/onboard/register/route.ts` | NEW | Pre-auth gym+user creation |
| `apps/web-admin/src/app/api/owner/members/import/route.ts` | NEW | Bulk CSV import endpoint |
| `apps/web-admin/src/components/machines/MachineForm.tsx` | NEW | Extracted shared machine form |

### Modified Components

| File | Change |
|------|--------|
| `apps/web-admin/middleware.ts` | Add `/(onboard)/` and `/api/onboard/` to CSRF_EXEMPT list |
| `apps/web-admin/src/app/machines/page.tsx` | Refactor inline form to import `MachineForm.tsx` |

### Build Order (Feature 1)

1. `POST /api/onboard/register` route + Zod schema
2. `(onboard)/` layout + signup page (wires to step 1)
3. `(onboard)/verify-email` + `(onboard)/subscribe` (wires to existing billing/checkout)
4. `MachineForm` extraction + `(onboard)/setup` wizard
5. `POST /api/owner/members/import` route
6. `owner/members/import/` page

---

## Features 2-4: Mobile Social Feed, Challenges, Program View

### New File Locations

The existing tab bar in `apps/mobile/app/(tabs)/_layout.tsx` has 4 tabs: Home, Scan, Progress, Profile. There are two options for placing the new screens:

**Option A — New "Community" tab in tab bar.** Add a 5th tab at position 3 (between Scan and Progress). Feed, challenges, and program naturally group under gym engagement.

**Option B — Nested under Home via modal stack.** Community Pulse component on Home already links to feed; program view is already partially shown via TodayZone.

**Recommendation: Option A with a "Gym" tab.** The mobile web equivalent is the `/gym` route (which hosts feed + challenges + leaderboard). Mirrors that structure. Tab bar already uses BlurView + AnimatedTabIcon infrastructure — adding a 5th tab is a 10-line change to `(tabs)/_layout.tsx` plus a new file `apps/mobile/app/(tabs)/gym.tsx`.

For the program view, it belongs in a modal stack (not a tab), launched from the Home screen's TodayZone. Route: `apps/mobile/app/program/index.tsx`.

```
apps/mobile/app/
├── (tabs)/
│   ├── _layout.tsx             MODIFY — add 'gym' tab (Ionicons 'people-outline')
│   └── gym.tsx                 NEW — top-level community screen (feed + challenges tabs)
├── program/
│   └── index.tsx               NEW — full program view (week/day grid)
└── challenges/
    └── [challengeId].tsx       NEW — challenge detail + leaderboard
```

### API Client Patterns

The mobile app does NOT use React Query or SWR. It uses a custom AsyncStorage-backed cache (`apps/mobile/src/lib/cacheManager.ts`) with `getCached` / `setCache` / `cacheFirst` functions plus a `requestDeduper.ts` for in-flight deduplication.

**Recommendation: Follow the existing pattern.** Do not introduce React Query. The mobile codebase is already structured around direct `fetch` calls with `cacheFirst()` wrapping. Consistency > marginal DX improvement.

Feed API call pattern (matching existing home screen style):
```typescript
// In apps/mobile/app/(tabs)/gym.tsx
const [feedData, setFeedData] = useState<FeedEventFull[]>([]);
const loadFeed = useCallback(async () => {
  const fresh = await fetch(
    `/api/member/feed?member_id=${memberId}&gym_id=${gymId}&limit=20`
  ).then(r => r.json());
  setFeedData(fresh.events ?? []);
}, [memberId, gymId]);
```

For cursor-based pagination (feed): maintain `nextCursor` state, append on "load more" press.

### Existing Endpoints the Mobile Screens Will Consume

| Screen | Endpoint | Status |
|--------|----------|--------|
| Feed | `GET /api/member/feed?member_id=&gym_id=&cursor=&limit=` | EXISTS |
| Feed react | `POST /api/member/feed/react` | EXISTS |
| Feed comments | `GET/POST /api/member/feed/comments` | EXISTS |
| Challenges list | `GET /api/member/challenges?member_id=&gym_id=` | EXISTS |
| Challenge detail | `GET /api/member/challenges/[challengeId]` | EXISTS |
| Challenge join | `POST /api/member/challenges/[challengeId]/join` | EXISTS |
| Program | `GET /api/member/[memberId]/program` | EXISTS |

**No new API routes needed for Features 2, 3, or 4.** This is pure mobile UI work on top of working endpoints.

### Caching Strategy

| Screen | Cache Key | TTL |
|--------|-----------|-----|
| Feed (first page) | `feed:${gymId}` | 2 minutes (social is time-sensitive) |
| Challenges list | `challenges:${gymId}` | 5 minutes |
| Program | `program:${memberId}` | 15 minutes |

Add these keys to `CacheTTL` in `apps/mobile/src/lib/cacheManager.ts`.

### Offline Queue Coverage

The offline queue (`apps/mobile/src/lib/offlineQueue.ts`) is write-only: it queues failed Supabase `INSERT` operations for replay. It does NOT cover reads. Feed, challenges, and program are all read operations — they will simply show cached data when offline, or a "no connection" empty state. No offline queue changes needed for Features 2-4.

The one write operation in these features is "react to feed event" (`POST /api/member/feed/react`). Enqueue that on failure using `enqueueEvent('feed_reactions', payload)` — same pattern as existing workout set logging.

### Theme Integration

The existing `apps/mobile/src/theme/colors.ts` (40+ tokens) must be used throughout. The web-admin feed components (`FeedEventCard`, `FeedList`, `CommunityPulse`, `CommentSection`, `ReactionBar`) are React web components and cannot be imported into Expo. Build React Native equivalents using the same color tokens. The logic (event type dispatch, reaction counts) can be extracted into a shared pure-function helper in `packages/utils/` if desired, but this is optional.

### New Components to Build

| File | Type | Purpose |
|------|------|---------|
| `apps/mobile/app/(tabs)/gym.tsx` | NEW | Community tab: Feed + Challenges sub-tabs |
| `apps/mobile/app/program/index.tsx` | NEW | Full program week/day grid view |
| `apps/mobile/app/challenges/[challengeId].tsx` | NEW | Challenge detail + leaderboard |
| `apps/mobile/src/components/feed/FeedItem.tsx` | NEW | Single feed event card (RN) |
| `apps/mobile/src/components/feed/ReactionBar.tsx` | NEW | 4 reaction buttons + counts |
| `apps/mobile/src/components/challenges/ChallengeCard.tsx` | NEW | Challenge list card (RN) |
| `apps/mobile/src/components/challenges/ChallengeLeaderboard.tsx` | NEW | Rank list (RN) |
| `apps/mobile/src/components/program/ProgramDayCard.tsx` | NEW | Day card with exercise list (RN) |

### Modified Components

| File | Change |
|------|--------|
| `apps/mobile/app/(tabs)/_layout.tsx` | Add 5th "Gym" tab |
| `apps/mobile/app/_layout.tsx` | Add `Stack.Screen` entries for program and challenge routes |
| `apps/mobile/src/lib/cacheManager.ts` | Add `feed`, `challenges`, `program` TTL keys |

### Build Order (Features 2-4)

1. `cacheManager.ts` TTL additions (no risk, pure data)
2. `ChallengeCard` + `ChallengeLeaderboard` components (simpler, fewer edge cases)
3. `gym.tsx` tab + `_layout.tsx` modification — show challenges sub-tab first
4. `FeedItem` + `ReactionBar` components
5. Feed sub-tab wired into `gym.tsx`
6. `ProgramDayCard` + `program/index.tsx`
7. `challenges/[challengeId].tsx` detail screen

---

## Feature 5: UptimizeAI Agent Connection

### Current State

`apps/web-admin/src/app/api/agents/trigger/route.ts` is a working internal webhook that:
- Authenticates via `INTERNAL_WEBHOOK_KEY` header
- Validates `agent_name` against `KNOWN_AGENTS` (5 agents: retention, engagement, revenue, operations, growth)
- Checks tier/feature gating via `checkAgentAccess()`
- Logs to `smartgym_agent_logs`
- **Returns `{ success: true }` after logging** — it does NOT forward the payload to any external agent system yet.

`apps/web-admin/src/lib/billing/triggerAgent.ts` provides `triggerUptimizeAIAgent(agentName, payload)` — the caller-side helper that POSTs to `/api/agents/trigger` with the internal key.

The billing webhook already calls `triggerUptimizeAIAgent` for 3 events (subscription cancelled → retention-agent, payment failed → revenue-agent, trial ending → engagement-agent).

### Agent Definitions / gym_agent_config

The `gym_agent_config` table exists in the schema (audit confirms it) but its column definitions are not in `DATA_MODEL.md`. Based on the agents trigger route, the relevant per-gym config is:
- Which agents are enabled (derived from subscription tier via `checkAgentAccess`)
- The tier-to-agent mapping is already in `apps/web-admin/src/lib/billing/tiers.ts`

The `smartgym_agent_logs` table already records: `gym_id`, `member_id`, `agent_name`, `trigger_event`, `status` (`sent`/`skipped`), `error_message`, `payload`.

### What "Wiring" Actually Means

The `/api/agents/trigger` route currently logs the trigger but does NOT forward it to an external agent runner. "Connecting" the 13 agents means two things:

1. **Add the missing source-event call sites** — places in existing API routes and cron jobs that should call `triggerUptimizeAIAgent()` but do not.
2. **Add forwarding logic in `/api/agents/trigger`** — after logging, actually invoke the UptimizeAI agent system (the external `uptimize-engine` referenced in the working directory paths).

Based on the audit and session complete route, here is the full trigger source map:

| Agent | Trigger Event | Source Call Site | Action Needed |
|-------|--------------|-----------------|---------------|
| retention-agent | `subscription-cancelled` | `apps/web-admin/src/app/api/billing/webhook/route.ts` | ALREADY WIRED |
| retention-agent | `member-at-risk` | `apps/web-admin/src/app/api/owner/at-risk/route.ts` | ADD call to `triggerUptimizeAIAgent` |
| retention-agent | `member-inactive-30d` | New cron job (daily) scanning `members.last_session_date` | NEW cron job + trigger |
| engagement-agent | `trial-ending-soon` | `apps/web-admin/src/app/api/billing/webhook/route.ts` | ALREADY WIRED |
| engagement-agent | `session-streak-broken` | `apps/web-admin/src/app/api/sessions/[sessionId]/complete/route.ts` | ADD: if streak < prior streak, trigger |
| engagement-agent | `check-in-no-response-48h` | `apps/web-admin/src/app/api/cron/` (new cron job) | NEW cron trigger |
| revenue-agent | `payment-failed` | `apps/web-admin/src/app/api/billing/webhook/route.ts` | ALREADY WIRED |
| revenue-agent | `upgrade-opportunity` | `apps/web-admin/src/lib/billing/featureGate.ts` — on `hasAccess: false` | ADD trigger on denied feature access |
| operations-agent | `machine-underutilized` | Weekly cron scanning `machine_scan_events` usage | NEW cron trigger |
| operations-agent | `new-gym-onboarded` | `apps/web-admin/src/app/api/onboard/register/route.ts` | ADD trigger (post-Feature 1) |
| growth-agent | `challenge-ended` | `apps/web-admin/src/app/api/challenges/` route or cron | ADD trigger on challenge completion |
| growth-agent | `leaderboard-updated` | `apps/web-admin/src/app/api/sessions/[sessionId]/complete/route.ts` | ADD fire-and-forget trigger |
| engagement-agent | `level-up` | `apps/web-admin/src/app/api/sessions/[sessionId]/complete/route.ts` | ADD: check `achievements.leveledUp` |

### Reliability Architecture

**Pattern: fire-and-forget with logged idempotency** — exactly what the billing webhook already uses for agent calls (`triggerUptimizeAIAgent(...).catch(err => console.error(...))`). This is the correct pattern for Tier 1 given that:
- Agents are enhancement automation, not correctness-critical
- The `smartgym_agent_logs` table provides observability without needing a durable queue
- Supabase Database Webhooks would require Postgres extensions and add infrastructure complexity

**Idempotency key:** `smartgym_agent_logs` inserts an `id` (UUID) per trigger. The external agent system should use `(gym_id, agent_name, trigger_event, created_at truncated to day)` as a dedup window to avoid re-running on retry. This is a concern for the agent runner, not the Next.js trigger layer.

**Do NOT introduce a message queue (BullMQ, etc.) in Tier 1.** The fire-and-forget + log pattern is sufficient for launch scale.

### Forwarding Logic in /api/agents/trigger

After logging, add a call to the external UptimizeAI system. Based on the monorepo structure (uptimize-engine exists at `c:\Users\pjaco\uptimize-engine\`), the integration is likely an HTTP call to an external service URL or a direct import.

For Tier 1, the simplest pattern is to extend `triggerBodySchema` to optionally include a `callback_url` and make the trigger route POST to the UptimizeAI webhook endpoint (stored as `UPTIMIZE_WEBHOOK_URL` env var). The route already has the shape; just add the forwarding step:

```typescript
// After logging in /api/agents/trigger route.ts
if (process.env.UPTIMIZE_WEBHOOK_URL) {
  fetch(process.env.UPTIMIZE_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-uptimize-key': process.env.UPTIMIZE_API_KEY! },
    body: JSON.stringify({ agent_name, payload, log_id: insertedLogId }),
  }).catch(err => console.error('[agents/trigger] forward failed:', err));
}
```

### Per-Gym Opt-Out

Already handled: `checkAgentAccess(gymId, agentName)` gates on subscription tier. If a gym needs individual opt-out beyond tier, add a boolean `agent_enabled` column to `gym_agent_config` — but that is Tier 2 granularity.

### New Components to Build

| File | Type | Purpose |
|------|------|---------|
| `apps/web-admin/src/app/api/cron/agent-triggers/route.ts` | NEW | Daily cron: scan inactive members + underutilized machines, fire agents |
| `UPTIMIZE_WEBHOOK_URL` env var | CONFIG | External agent system endpoint |

### Modified Components

| File | Change |
|------|--------|
| `apps/web-admin/src/app/api/agents/trigger/route.ts` | Add forwarding fetch to `UPTIMIZE_WEBHOOK_URL` after log insert |
| `apps/web-admin/src/app/api/sessions/[sessionId]/complete/route.ts` | Add `triggerUptimizeAIAgent` for level-up and streak-broken events |
| `apps/web-admin/src/lib/billing/featureGate.ts` | Add `triggerUptimizeAIAgent('revenue-agent', ...)` on denied access |
| `apps/web-admin/src/app/api/owner/at-risk/route.ts` | Add trigger for retention-agent on at-risk fetch (fire-and-forget) |

### Build Order (Feature 5)

1. Add `UPTIMIZE_WEBHOOK_URL` forwarding to `/api/agents/trigger/route.ts` (enables end-to-end testing)
2. Add `KNOWN_AGENTS` list expansion if agents beyond the current 5 need to be added
3. Wire `session-complete` triggers (level-up, streak broken, leaderboard) into existing route
4. Wire `featureGate` upgrade opportunity trigger
5. Wire `at-risk` retention trigger
6. New cron route for inactive-member and machine-underutilization scans

---

## Feature 6: Notification Orchestration

### Complete Trigger Inventory

Derived from existing event sources in the codebase:

| # | Trigger Event | Source | Priority |
|---|--------------|--------|---------|
| 1 | Workout completed (first of day) | `POST /api/sessions/[id]/complete` | Medium |
| 2 | Personal record (PR) hit | `POST /api/sessions/[id]/complete` (is_personal_best) | High |
| 3 | Achievement unlocked (any of 39) | `checkAchievementsForMember()` in session complete | High |
| 4 | Level up | `checkAchievementsForMember()` → leveledUp | High |
| 5 | Streak milestone (3/7/14/30/60/100) | `generateSessionFeedEvents()` streak milestone | Medium |
| 6 | Session milestone (10/25/50/100...) | `generateSessionFeedEvents()` session milestone | Low |
| 7 | Weekly check-in generated (trainer wants response) | `POST /api/agents/checkin-generate` per member | High |
| 8 | Check-in reply received (trainer responded) | `POST /api/member/[id]/check-ins/[id]/reply` | High |
| 9 | Trainer message received | `POST /api/trainer/messages/[id]` | High |
| 10 | Coach note approved + sent | `supabase/functions/trainer-copilot/approve-and-send.ts` | High |
| 11 | Program assigned | `POST /api/programs/assign` (if exists) or trainer action | Medium |
| 12 | Challenge joined (confirmation) | `POST /api/member/challenges/[id]/join` | Low |
| 13 | Challenge milestone reached | `updateChallengeScores()` in session complete | Medium |
| 14 | Leaderboard rank change (top 3 entry) | Session complete after challenge score update | Low |
| 15 | Trial ending in 3 days | Stripe webhook `customer.subscription.trial_will_end` | High |
| 16 | Payment failed | Stripe webhook `invoice.payment_failed` | High |
| 17 | Member inactive 7 days (re-engagement) | Cron job / at-risk scan | Medium |
| 18 | Feed reaction on my event | `POST /api/member/feed/react` | Low |
| 19 | New follower (social_connections — currently broken) | Deferred — table doesn't exist yet | Defer |
| 20 | Gym-wide announcement (owner push) | `POST /api/push/send` | High |
| 21 | Readiness score available (daily) | Daily readiness cron | Low — do NOT send daily, noisy |
| 22 | Weekly summary (Sunday) | New weekly cron | Medium |

### Centralization Decision: Notification Dispatcher

**Build a centralized notification dispatcher** rather than scattered calls. This is the pattern implied by the existing Edge Function interface: `POST send-push-notification { profile_id, type, title, body, data? }`.

**Location:** `apps/web-admin/src/lib/notifications/dispatcher.ts` (NEW)

```typescript
export async function sendNotification(input: {
  profile_id: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, string>;
}): Promise<void> {
  // Fire-and-forget to Edge Function
  fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/send-push-notification`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify(input),
  }).catch(err => console.error('[dispatcher] push failed:', err));
}
```

All call sites import `sendNotification` from this one file. If the delivery mechanism changes (e.g., swap Expo Push for APNs direct), only `dispatcher.ts` changes.

### Preference Enforcement

The Edge Function `send-push-notification` already checks `notification_preferences.enabled` (boolean, default true). This is correct for a global on/off.

For Tier 1, the `notification_preferences` table needs a column audit. The Edge Function only checks `enabled: boolean`. For Tier 1, enforce preferences at the dispatcher level (not at the Edge Function level) so web-side filtering is consistent:

```typescript
// In dispatcher.ts — before calling Edge Function
const { data: prefs } = await admin
  .from('notification_preferences')
  .select('enabled, quiet_hours_start, quiet_hours_end, types_disabled')
  .eq('profile_id', input.profile_id)
  .maybeSingle();

if (prefs?.enabled === false) return; // globally disabled
if (prefs?.types_disabled?.includes(input.type)) return; // type disabled
// quiet hours check here
```

This means the Edge Function's own preference check becomes redundant once the dispatcher is in place. Keep it as a safety net.

**Notification preferences UI:** `apps/mobile/app/settings.tsx` already exists (settings screen). Add a "Notifications" section that POSTs to `PATCH /api/member/settings` (existing route) to update `notification_preferences`.

### Quiet Hours, Dedup, Rate Limiting

| Concern | Tier 1 Approach |
|---------|----------------|
| Quiet hours | Check in `dispatcher.ts` — if current time is within `quiet_hours_start`/`quiet_hours_end`, skip delivery |
| Dedup | `notification_log` table already exists and is populated by Edge Function; check for same `(profile_id, type)` within last 5 minutes before sending |
| Rate limiting | Cap at 5 push notifications per member per hour in dispatcher; track count via `notification_log` SELECT COUNT |

### Failure / Retry Handling

The Edge Function already logs to `notification_log` with `status: 'sent'` or `status: 'failed'`. Add a daily cron job `apps/web-admin/src/app/api/cron/retry-notifications/route.ts` (NEW, low priority) that queries `notification_log WHERE status = 'failed' AND created_at > NOW() - INTERVAL '24 hours'` and retries. For Tier 1 launch, fire-and-forget with logging is sufficient — retry cron can be deferred to post-launch.

### NotificationType Expansion

`apps/mobile/src/lib/notificationService.ts` has `NOTIFICATION_ROUTES` keyed on `NotificationType`. Currently only 4 types are registered (`coach_note`, `badge_unlocked`, `streak_milestone`, `leaderboard_rank`). The full 22-trigger inventory requires expanding this map and adding deep link routes for each type.

New routes to add to `NOTIFICATION_ROUTES`:
- `workout_complete` → `/(tabs)/home` (or no-op)
- `pr_hit` → `/(tabs)/progress`
- `level_up` → `/(tabs)/profile`
- `check_in_request` → new check-in screen (Tier 2) — for Tier 1, fallback to `/(tabs)/profile`
- `trainer_message` → `/(tabs)/profile` (messaging not on mobile yet)
- `challenge_milestone` → `/(tabs)/gym` (after gym tab is built)
- `program_assigned` → `apps/mobile/app/program/index.tsx` (after Feature 4)

### New Components to Build

| File | Type | Purpose |
|------|------|---------|
| `apps/web-admin/src/lib/notifications/dispatcher.ts` | NEW | Central push dispatcher with preference + dedup checks |
| `apps/web-admin/src/app/api/cron/retry-notifications/route.ts` | NEW (Tier 2) | Retry failed notifications (defer from Tier 1 MVP) |

### Modified Components

| File | Change |
|------|--------|
| `apps/web-admin/src/app/api/sessions/[sessionId]/complete/route.ts` | Add `sendNotification` calls for PR, achievement, level-up, streak milestone |
| `apps/web-admin/src/app/api/agents/checkin-generate/route.ts` | Add `sendNotification` per member after check-in generation |
| `apps/web-admin/src/app/api/member/[memberId]/check-ins/[checkInId]/reply/route.ts` | Add `sendNotification` to member on reply |
| `supabase/functions/trainer-copilot/approve-and-send.ts` | Add push call or verify it already fires |
| `apps/mobile/src/lib/notificationService.ts` | Expand `NOTIFICATION_ROUTES` for new types |
| `apps/mobile/app/settings.tsx` | Add notification preferences section |

### Build Order (Feature 6)

1. `dispatcher.ts` — foundation everything else depends on
2. Expand `NOTIFICATION_ROUTES` in mobile `notificationService.ts`
3. Wire session-complete notifications (PR, achievement, level-up, streak)
4. Wire check-in generated notification (high user value)
5. Wire check-in reply notification
6. Wire trainer coach note push (verify approve-and-send Edge Function)
7. Add notification preferences UI to mobile settings screen

---

## Recommended Build Order Across All 6 Features

Dependencies drive this order:

```
Feature 6: Notification dispatcher.ts    ← Build FIRST (agents and session-complete depend on it)
     ↓
Feature 5: Agent wiring                  ← Wire agent triggers (some send notifications)
     ↓
Feature 1: Owner onboarding             ← Standalone, can proceed in parallel with 2-4
     ↓
Feature 2: Mobile feed                  ← Requires gym tab added first
Feature 3: Mobile challenges            ← Can share gym tab with Feature 2
Feature 4: Mobile program view          ← Independent modal route
```

**Optimal parallel tracks for a team:**

- Track A: Feature 6 (dispatcher) → Feature 5 (agent wiring) → Feature 1 (onboarding)
- Track B: Feature 3 (challenges, simpler) → Feature 2 (feed) → Feature 4 (program view)

Track A and Track B have no file-level conflicts after the initial dispatcher and tab layout changes.

---

## Architectural Debt: Phase-In vs Defer

### Address Inside Tier 1

| Debt Item | File | Action |
|-----------|------|--------|
| `/api/agents/trigger` only logs, does not forward | `route.ts` | Fix in Feature 5 step 1 |
| `NOTIFICATION_ROUTES` missing 18 of 22 types | `notificationService.ts` | Fix in Feature 6 step 2 |
| `notification_preferences` has no granular type control UI | `settings.tsx` | Add to Feature 6 step 7 |
| Owner has no self-serve signup path | — | Feature 1 in full |
| Stripe trial_period_days=30 hardcoded | `stripeHelpers.ts` | Leave as-is for launch |

### Defer to Post-Tier-1

| Debt Item | Reason to Defer |
|-----------|----------------|
| `error_log` table missing (code references it in `/admin/errors`) | Admin error UI still renders, just with empty data; no launch blocker |
| `social_connections` table missing (DOC_26 follow/unfollow API exists) | Social graph feature not in Tier 1 scope |
| `platform_daily_metrics` missing | Super admin analytics page shows empty data, not broken |
| `admin_actions_log` missing | Audit trail feature, not correctness-critical |
| ~15 dead tables from migration 021 | Zero performance impact at launch scale; no action needed |
| In-memory rate limiting (resets on deploy) | Acceptable for launch; migrate to Redis post-launch |
| Push notification retry cron | Failure rate low at launch; add in first post-launch sprint |

---

## Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| `(onboard)/*` pages | Unauthenticated gym signup flow | `/api/onboard/register`, `/api/billing/checkout` |
| `/api/onboard/register` | Pre-auth gym + user creation | Supabase Auth Admin API, `gyms`, `gym_memberships`, `gym_billing` |
| `owner/members/import` | Bulk CSV member creation | `/api/owner/members/import`, `members`, `auth.users` |
| `apps/mobile/app/(tabs)/gym.tsx` | Community tab host | `/api/member/feed`, `/api/member/challenges` |
| `apps/mobile/app/program/index.tsx` | Full program view | `/api/member/[memberId]/program` |
| `notifications/dispatcher.ts` | Centralized push dispatch | `notification_preferences`, `notification_log`, Edge Function `send-push-notification` |
| `/api/agents/trigger` | Agent trigger + log | `smartgym_agent_logs`, `UPTIMIZE_WEBHOOK_URL` (new), `gym_agent_config` |
| `triggerUptimizeAIAgent()` | Caller helper | `/api/agents/trigger` via internal key |

---

## Data Flow

### Onboarding Flow

```
/signup form POST
    → /api/onboard/register
        → supabase.auth.signUp()
        → INSERT gyms, gym_memberships, gym_settings, gym_billing
        → return { gym_id }
    → /verify-email page (holding)

Email click → /subscribe?gym_id=
    → verifyStaff('owner') passes (session now exists)
    → POST /api/billing/checkout
        → createStripeCustomer()
        → createCheckoutSession(trial_period_days: 30)
        → return { checkout_url }
    → redirect to Stripe

Stripe success → /owner/billing?success=true
Stripe webhook → handleStripeWebhook() updates gym_billing + gyms

/setup first machine wizard
    → POST /api/machines (existing)
    → GET /api/machines/[id]/qr (existing)
```

### Notification Dispatch Flow

```
Event source (session complete, check-in, etc.)
    → sendNotification({ profile_id, type, title, body, data })  [dispatcher.ts]
        → check notification_preferences (skip if disabled)
        → check notification_log dedup (skip if sent < 5 min ago)
        → check quiet hours
        → POST supabase/functions/send-push-notification
            → check device_tokens (active=true)
            → POST Expo Push API (batch)
            → INSERT notification_log (status: sent|failed)
```

### Agent Trigger Flow

```
Event source (billing webhook, session complete, cron, etc.)
    → triggerUptimizeAIAgent(agentName, payload)  [triggerAgent.ts]
        → POST /api/agents/trigger (INTERNAL_WEBHOOK_KEY)
            → checkAgentAccess(gymId, agentName)  [featureGate.ts]
            → INSERT smartgym_agent_logs
            → POST UPTIMIZE_WEBHOOK_URL (new: fire-and-forget)
```

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Blocking Webhook Response with Agent Calls

**What people do:** `await triggerUptimizeAIAgent(...)` inside Stripe webhook handler before returning.
**Why it's wrong:** Stripe retries webhooks after 30s timeout. An agent call that takes >30s causes repeated duplicate events.
**Do this instead:** The existing code already uses `.catch(err => ...)` fire-and-forget — maintain this pattern everywhere.

### Anti-Pattern 2: Direct Supabase Calls from Mobile for Writes

**What people do:** Mobile calls Supabase PostgREST directly for writes (`supabase.from('feed_reactions').insert(...)`).
**Why it's wrong:** Bypasses CSRF middleware, rate limiting, and server-side validation enforced at the API layer.
**Do this instead:** All writes go through Next.js API routes. Reads can use either, but the existing pattern is API routes via `fetch`.

### Anti-Pattern 3: Onboarding Inside the Existing Owner Route Group

**What people do:** Add signup pages under `apps/web-admin/src/app/owner/` (which has an auth-checking layout).
**Why it's wrong:** `apps/web-admin/src/app/owner/layout.tsx` calls `/api/auth/staff/me` on mount and redirects to `/staff/login` if not authenticated — so unauthenticated users can never reach signup.
**Do this instead:** Use the separate `(onboard)/` route group with its own unauthenticated layout.

### Anti-Pattern 4: Scattering Notification Calls Without Dedup

**What people do:** Add `fetch('/functions/v1/send-push-notification', ...)` calls directly in multiple routes.
**Why it's wrong:** Same event (e.g., session complete) fires multiple paths simultaneously (achievement check, feed generator, challenge scorer) — member gets 3 push notifications for one workout.
**Do this instead:** Route all notifications through `dispatcher.ts` which enforces the 5-minute dedup window per `(profile_id, type)`.

### Anti-Pattern 5: CSV Import via Edge Function

**What people do:** Send large CSV to a Supabase Edge Function.
**Why it's wrong:** Edge Functions have a 50KB request body limit. A gym importing 500 members exceeds this.
**Do this instead:** `POST /api/owner/members/import` as a Next.js API route (configurable body size limit via `next.config.js`), with chunked processing server-side.

---

## Sources

- Direct file audit of `NEXERA_FULL_CODEBASE_AUDIT.md` (all sections)
- `apps/web-admin/middleware.ts` — CSRF exempt list and session middleware
- `apps/web-admin/src/app/api/agents/trigger/route.ts` — agent webhook pattern
- `apps/web-admin/src/app/api/billing/webhook/route.ts` — existing agent wiring examples
- `apps/web-admin/src/app/api/sessions/[sessionId]/complete/route.ts` — session complete cascade
- `supabase/functions/send-push-notification/index.ts` — push delivery + preference check
- `apps/mobile/app/_layout.tsx` — notification listener setup
- `apps/mobile/app/(tabs)/_layout.tsx` — tab bar structure
- `apps/mobile/src/lib/cacheManager.ts` — mobile caching pattern
- `apps/mobile/src/lib/offlineQueue.ts` — offline queue scope (writes only)
- `apps/mobile/src/lib/notificationService.ts` — deep link routing + token registration
- `apps/web-admin/src/lib/billing/stripeHelpers.ts` — Stripe checkout + webhook handling
- `apps/web-admin/src/lib/billing/tiers.ts` — tier-to-agent mapping
- `apps/web-admin/src/lib/auth/verifyStaff.ts` / `verifyMember.ts` — auth patterns
- `apps/web-admin/src/lib/feedGenerator.ts` — feed event generation pattern
- `apps/web-admin/src/app/owner/layout.tsx` — owner auth guard (explains why onboarding needs separate route group)
- `docs/DATA_MODEL.md` — table schemas and RLS helpers

---
*Architecture research for: SmartGym (NEXERA) Tier 1 Launch Blockers*
*Researched: 2026-06-03*

# Phase 6: Notification Orchestration Wiring — Research

**Researched:** 2026-07-20
**Domain:** Push notification dispatcher, inbox, preference enforcement, Expo receipt polling, deep link routing
**Confidence:** HIGH (grounded in direct file-by-file codebase reading: Edge Function, notificationService, schema migrations, type definitions, all API routes that currently insert to `notifications`)

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| NOTIF-01 | Central dispatcher enforces preferences, quiet hours, 5-min dedup, hourly rate cap | `notification_preferences` table has all needed columns (per-category booleans + quiet hours); `notification_log` has `(profile_id, type, created_at)` for dedup; Edge Function is the delivery layer — dispatcher wraps it |
| NOTIF-02 | All 24+ trigger types wired from their event sources | 22 trigger types enumerated in FEATURES.md map to specific existing routes; `sessions/[id]/complete`, `check-ins/reply`, `sendCheckIn.ts`, billing webhook, agent cron routes are the primary sources |
| NOTIF-03 | Every push deep-links to the right screen | `NotificationType` union currently has 4 values; `NOTIFICATION_ROUTES` in `notificationService.ts` maps them; both need expansion to all 24+ types |
| NOTIF-04 | Member controls notifications by category with quiet hours | `notification_preferences` schema already has per-category push booleans AND quiet-hour columns — schema gap is zero; gap is dispatcher enforcement + mobile settings UI |
| NOTIF-05 | Member has notification inbox with unread badge | `notifications` table exists with `read_at`, `status`, `member_id` columns; no mobile `/notifications` screen exists yet |
| NOTIF-06 | Stale tokens cleaned up via receipt polling; delivery rate visible to admin | `notification_log.expo_receipt_id` captures ticket IDs; no receipt-polling cron exists yet; `device_tokens.active` flag is the deactivation mechanism |
</phase_requirements>

---

## Summary

Phase 6 wires a push notification system that is largely pre-built in infrastructure but has zero trigger wiring and zero dispatcher logic implemented. The `send-push-notification` Edge Function is deployed and working; it sends to Expo, logs to `notification_log`, and does a single global enabled/disabled check against `notification_preferences`. The `notification_preferences` table already has per-category boolean columns (7 push categories) and quiet-hours columns — more than enough to enforce NOTIF-04 server-side. The `notifications` table (inbox store) exists in migration 001 with `read_at`, `status`, and indexes for unread queries. The `device_tokens` table exists with an `active` partial index. The mobile `notificationService.ts` is wired into `_layout.tsx` with a cold-start handler.

The gaps are surgical and known: (1) no `dispatcher.ts` exists — every trigger has to be invented; (2) `NotificationType` in `@nexera/types` has 4 values, needs 24+; (3) `NOTIFICATION_ROUTES` in `notificationService.ts` maps only those 4 types to 4 routes; (4) none of the 22 event sources call any push function (sessions/complete, check-in reply, coaching, billing all write to `notifications` table but never fire the Edge Function); (5) no mobile `/notifications` inbox screen exists; (6) no Expo receipt-polling cron exists to clean stale tokens.

**Primary recommendation:** Build dispatcher first, expand `NotificationType` second, wire triggers in value-order (session-complete cluster, coaching, social, operational), then preferences UI, inbox, and receipt-polling cron. The dispatcher is the dependency of everything else — no trigger wiring should begin until it exists.

---

## Standard Stack

### Core (already installed, no new deps)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Expo Notifications (`expo-notifications`) | SDK 52 compatible | Push token registration, response listeners, local notifications | Already wired in `notificationService.ts` and `_layout.tsx`; permission flow and cold-start handler in place |
| Supabase JS v2 (service role) | `@supabase/supabase-js@2` | Admin DB client for dispatcher (preference reads, dedup checks, log inserts) | Established pattern — all server routes use `createClient(URL, SERVICE_ROLE_KEY)` |
| Expo Push API (HTTP) | `https://exp.host/--/api/v2/push/send` | Deliver push messages to iOS/Android | Already used in `send-push-notification` Edge Function |
| Expo Push Receipts API | `https://exp.host/--/api/v2/push/getReceipts` | Poll delivery status and detect `DeviceNotRegistered` | Must be added in receipt-polling cron (NOTIF-06) |
| Zod | already in project | Dispatcher input validation schema | Established pattern across all routes |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@nexera/types` (local) | — | `NotificationType`, `NotificationPreferences`, `NotificationLog` | Expand `NotificationType` union here; planner must update the package |

### No New Dependencies Required
The full Phase 6 build requires no new npm packages. All primitives (fetch, Supabase, Expo API) are already available.

---

## Architecture Patterns

### Recommended File Structure

```
apps/web-admin/src/lib/notifications/
├── dispatcher.ts          NEW — central sendNotification() with all enforcement
└── __tests__/
    └── dispatcher.test.ts NEW — TDD: preference bypass, dedup, quiet hours, rate cap

apps/web-admin/src/app/api/
├── cron/
│   └── receipt-poll/
│       ├── route.ts       NEW — Expo receipt polling + token deactivation
│       └── __tests__/receipt-poll.test.ts
└── member/
    └── notifications/
        ├── route.ts       NEW — GET /api/member/notifications (inbox list)
        └── [notifId]/
            └── read/
                └── route.ts  NEW — POST /api/member/notifications/[id]/read

apps/mobile/app/
└── notifications/
    └── index.tsx          NEW — mobile inbox screen

packages/types/src/index.ts
└── NotificationType       MODIFY — expand from 4 to 24+ values

apps/mobile/src/lib/notificationService.ts
└── NOTIFICATION_ROUTES    MODIFY — expand from 4 to 24+ type→route mappings
```

### Pattern 1: Dispatcher with Layered Guards

The dispatcher is the single gateway. No route or event source calls the Edge Function directly. All enforcement lives here so there is no scattered duplication.

```typescript
// apps/web-admin/src/lib/notifications/dispatcher.ts
export async function sendNotification(input: {
  profile_id: string;       // auth.users.id
  member_id?: string;       // members.id for preference/dedup lookups
  gym_id: string;
  type: NotificationType;
  title: string;
  body: string;             // NEVER include PII or health data
  data?: Record<string, string>;
  is_agent_initiated?: boolean;  // when true: skip re-triggering agents (loop safety)
}): Promise<'sent' | 'skipped' | 'no_devices'> {

  // Guard 0: loop safety — agent-initiated payloads must never re-trigger agents
  // The dispatcher itself doesn't re-trigger agents, but this flag propagates
  // into the data payload so the mobile client or any consumer can inspect it.

  // Guard 1: global enabled check (fast path — matches Edge Function behavior)
  const prefs = await fetchPreferences(input.member_id ?? input.profile_id);
  if (prefs && prefs.push_enabled === false) return 'skipped';

  // Guard 2: per-category preference check
  const categoryColumn = CATEGORY_COLUMN_MAP[input.type];
  if (categoryColumn && prefs && prefs[categoryColumn] === false) return 'skipped';

  // Guard 3: quiet hours
  if (prefs?.quiet_hours_enabled && isInQuietHours(prefs.quiet_hours_start, prefs.quiet_hours_end)) return 'skipped';

  // Guard 4: 5-minute dedup per (profile_id, type)
  const recentCount = await countRecentLogs(input.profile_id, input.type, 5);
  if (recentCount > 0) return 'skipped';

  // Guard 5: hourly rate cap (10 pushes per member per hour)
  const hourlyCount = await countRecentLogs(input.profile_id, null, 60);
  if (hourlyCount >= 10) return 'skipped';

  // Deliver via Edge Function (fire-and-forget is wrong here — we need the receipt_id)
  const result = await callEdgeFunction(input);
  return result.sent > 0 ? 'sent' : 'no_devices';
}
```

**Key design choices (grounded in codebase):**

1. `profile_id` is `auth.users.id` — that is what `device_tokens.profile_id` references (migration 019). The existing Edge Function uses this. Preference table uses `member_id` (members table FK). Dispatcher must bridge both by accepting `member_id` optionally.
2. The `notification_preferences` table uses `member_id` (not `profile_id`) as its FK. When looking up preferences, the dispatcher needs to resolve `member_id` from `profile_id` or accept `member_id` as input.
3. The Edge Function `send-push-notification` already does a global `enabled` check — so the dispatcher's global check is belt-and-suspenders. Keep it. If the Edge Function's check fires, that means the dispatcher bypassed — which is wrong. Removing the Edge Function's check creates fragility. Keep both.
4. **Never include PII in push body.** The lock-screen shows `body` on all iOS/Android devices. Keep bodies to "You have a new check-in" style strings.

### Pattern 2: NotificationType Expansion and NOTIFICATION_ROUTES

The `NotificationType` union in `packages/types/src/index.ts` currently has 4 values. Expand to the full set. Keep the 4 existing values unchanged — they are used in `NOTIFICATION_ROUTES` already.

```typescript
// packages/types/src/index.ts — replace the 4-value union
export type NotificationType =
  // Activity (member events)
  | 'pr_achieved'
  | 'badge_unlocked'        // existing — keep
  | 'level_up'
  | 'streak_milestone'      // existing — keep
  | 'challenge_rank_change'
  | 'challenge_complete'
  // Social
  | 'feed_reaction'
  | 'feed_comment'
  // Coaching
  | 'coach_note'            // existing — keep
  | 'checkin_generated'
  | 'checkin_reply'
  | 'program_assigned'
  // Operational (owner-facing)
  | 'trial_ending'
  | 'payment_failed'
  | 'member_at_risk'
  | 'weekly_summary'
  // Agent-triggered
  | 'agent_dormant_alert'
  | 'agent_welcome'
  | 'leaderboard_rank';     // existing — keep
```

Corresponding `NOTIFICATION_ROUTES` in `notificationService.ts`:

```typescript
const NOTIFICATION_ROUTES: Record<NotificationType, (data: Record<string, string>) => string> = {
  // Existing 4 — unchanged
  coach_note:        (d) => d.note_id ? `/coach-notes/${d.note_id}` : '/(tabs)/profile',
  badge_unlocked:    () => '/(tabs)/profile',
  streak_milestone:  () => '/(tabs)/profile',
  leaderboard_rank:  () => '/leaderboard',
  // New
  pr_achieved:          () => '/(tabs)/progress',
  level_up:             () => '/(tabs)/profile',
  challenge_rank_change: (d) => d.challenge_id ? `/challenges/${d.challenge_id}` : '/(tabs)/feed',
  challenge_complete:    (d) => d.challenge_id ? `/challenges/${d.challenge_id}` : '/(tabs)/feed',
  feed_reaction:         (d) => '/(tabs)/feed',
  feed_comment:          (d) => '/(tabs)/feed',
  checkin_generated:     () => '/(tabs)/profile',
  checkin_reply:         () => '/(tabs)/profile',
  program_assigned:      () => '/program',
  trial_ending:          () => '/(tabs)/profile',
  payment_failed:        () => '/(tabs)/profile',
  member_at_risk:        () => '/(tabs)/profile',
  weekly_summary:        () => '/(tabs)/profile',
  agent_dormant_alert:   () => '/(tabs)/home',
  agent_welcome:         () => '/(tabs)/home',
};
```

### Pattern 3: Trigger Wiring Call Sites

Each event source calls `sendNotification()` fire-and-forget after its own DB operations complete.

| Event | File | Signal | Notification Type |
|-------|------|---------|-----------------|
| PR hit | `apps/web-admin/src/app/api/sessions/[sessionId]/complete/route.ts` | `prs.length > 0` in session result | `pr_achieved` |
| Badge unlocked | same session complete | `achievements.badgesUnlocked.length > 0` | `badge_unlocked` |
| Level up | same session complete | `achievements.leveledUp === true` | `level_up` |
| Streak milestone | same session complete | streak count in (7,14,30,100) | `streak_milestone` |
| Challenge rank change | same session complete (after challenge scoring) | rank entered top 3 | `challenge_rank_change` |
| Check-in generated | `apps/web-admin/src/lib/checkIn/sendCheckIn.ts` — `sendCheckInToMember()` | currently inserts to `notifications` in-app only | `checkin_generated` — add push call here |
| Check-in reply received | `apps/web-admin/src/app/api/member/[memberId]/check-ins/[checkInId]/reply/route.ts` | after reply update commits | `checkin_reply` to trainer |
| Coach note sent | `apps/web-admin/src/lib/checkIn/sendCheckIn.ts` + trainer copilot Edge Function | `status: 'sent'` | `coach_note` |
| Program assigned | `POST /api/programs/assign` (if exists) | on insert to `member_program_assignments` | `program_assigned` |
| Feed reaction | `POST /api/member/feed/react` | reaction created | `feed_reaction` to event owner |
| Feed comment | `POST /api/member/feed/comments` | comment created | `feed_comment` to event owner |
| Trial ending | billing webhook `customer.subscription.trial_will_end` | already fires agent; add push | `trial_ending` to owner |
| Payment failed | billing webhook `invoice.payment_failed` | already fires agent; add push | `payment_failed` to owner |
| Agent dormant | `agent-daily` cron | dormant member scan | `agent_dormant_alert` |
| Agent welcome | member creation / onboarding event | new member with `active` status | `agent_welcome` |

### Pattern 4: Notification Preferences Column Map

The `notification_preferences` table (migration 001) has these per-category push columns:

| Column | Maps To Types |
|--------|--------------|
| `push_prs` | `pr_achieved` |
| `push_achievements` | `badge_unlocked`, `level_up` |
| `push_level_up` | `level_up` (also covered by `push_achievements`) |
| `push_challenge_rank` | `challenge_rank_change`, `challenge_complete` |
| `push_new_program` | `program_assigned` |
| `push_trainer_note` | `coach_note`, `checkin_generated`, `checkin_reply` |
| `push_gym_feed` | `feed_reaction`, `feed_comment` |

**Schema note:** The `notification_preferences` table uses `member_id` (FK to `members.id`), NOT `profile_id`. The Edge Function uses `profile_id` (FK to `auth.users.id`). The dispatcher needs both. When an event source has `profile_id`, fetch `members.id` via `WHERE profile_id = $1 AND gym_id = $2`. The `notification_preferences` row is keyed on `member_id`.

The `NotificationPreferences` type in `packages/types/src/index.ts` currently only has `enabled: boolean`. It must be extended to include all the per-category columns and quiet-hour columns.

### Pattern 5: Receipt Polling Cron

Pattern follows `029_agent_dedup_and_cron.sql` (`net.http_post` via pg_cron) and the agent-daily/agent-weekly route auth pattern (dual header: `x-smartgym-internal-key` OR `Authorization: Bearer`).

```sql
-- Migration 031: push receipt polling cron (15 min)
SELECT cron.schedule(
  'nexera-receipt-poll',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.base_url', true) || '/api/cron/receipt-poll',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  )
  $$
);
```

Receipt poll route logic:
1. Query `notification_log WHERE expo_receipt_id IS NOT NULL AND status = 'sent' AND created_at > NOW() - INTERVAL '24 hours'` — batch up to 100
2. POST to `https://exp.host/--/api/v2/push/getReceipts` with collected receipt IDs
3. For each receipt: if `status = 'error'` and `details.error = 'DeviceNotRegistered'` → `UPDATE device_tokens SET active = false WHERE expo_push_token = $token`
4. Update `notification_log.status` to `'delivered'` (success) or `'failed'` (error)

**Schema gap:** `notification_log` does not have the `expo_push_token` stored alongside the receipt_id — the lookup goes `notification_log.expo_receipt_id` → Expo receipts API → returns `expo_push_token` in the error details. Migration 031 needs a `push_tokens_snapshot` column or query via join: `device_tokens WHERE profile_id = notification_log.profile_id AND active = true`.

### Pattern 6: Inbox API and Mobile Screen

The `notifications` table (migration 001) already has `read_at`, `status`, `member_id`, `notification_type`, `title`, `body`, `data`, and indexes for `(member_id, read_at)` and `(member_id, created_at DESC)`. No schema migration needed for the inbox.

```typescript
// GET /api/member/notifications — inbox list
// Cursor-based pagination on created_at DESC
// Returns: { notifications: InboxItem[], unread_count: number, next_cursor: string | null }

// POST /api/member/notifications/[id]/read — mark one read
// PATCH notifications SET read_at = now() WHERE id = $1 AND member_id = $memberRows.id
```

The unread badge on the home tab bell icon (already an `Ionicons 'notifications-outline'` button at `headerRight` in `_layout.tsx`) needs a hook analogous to `useUnreadFeedCount`. The bell routes to `/coach-notes` today — that changes to `/notifications` (new inbox screen) after Phase 6.

### Anti-Patterns to Avoid

- **PII in push body:** `body` is shown on the lock screen. Never include name, weight, health data. Use "You earned a new badge" not "Alice hit a PR of 185 lbs".
- **Calling Edge Function directly from routes:** Routes must call `dispatcher.ts`, not the Edge Function directly. Scattered direct calls bypass all enforcement.
- **Trusting `profile_id` as `member_id`:** They are different UUIDs. `device_tokens` and `notification_log` use `profile_id` (auth.users.id); `notification_preferences`, `notifications` use `member_id` (members.id).
- **Re-triggering agents from the dispatcher:** The dispatcher must check `is_agent_initiated === true` and short-circuit if so. This prevents the notification→agent→notification loop established by Phase 5's Pitfall 7.
- **Skipping quiet hours for "urgent" pushes:** Enforce quiet hours unconditionally at the dispatcher level — no exception path. A payment failure at 2am can wait until 7am.
- **Batching >100 in a single Expo push call:** Expo recommends ≤100 messages per batch. For gym-wide blasts, split into chunks of 100.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Push delivery to iOS/Android | Custom APNs/FCM integration | Expo Push API (`exp.host`) | Already integrated in Edge Function; handles both platforms; abstracts token management |
| Token expiry detection | Scheduled re-verification | Expo receipt API's `DeviceNotRegistered` error code | Expo returns this on first failed send; just poll receipts |
| Quiet-hours timezone math | Timezone library | Compare UTC times only (store quiet hours as UTC) | The `notification_preferences` schema stores `quiet_hours_start`/`quiet_hours_end` as Postgres `time` (timezone-naive); compare against `(NOW() AT TIME ZONE 'UTC')::time` |
| Dedup via in-memory Map | In-process cooldown state | `notification_log` DB query `WHERE created_at > NOW() - INTERVAL '5 minutes'` | In-memory state resets on deploy (existing rateLimit.ts LIMITATION); DB is authoritative |

**Key insight:** The Expo receipt polling pattern (tickets → receipts) is the only correct way to detect stale tokens. Every shortcut (checking `error` on the send response alone) misses deferred failures.

---

## Common Pitfalls

### Pitfall 1: Notification Preference Bypass (Pitfall 11 from PITFALLS.md)
**What goes wrong:** `push/send` route and individual trigger routes write to `notifications` table but never check per-category preferences. Current `sendCheckIn.ts` does `admin.from('notifications').insert(...)` with no preference check.
**Why it happens:** The notification_preferences table columns exist but no code reads them for push decisions.
**How to avoid:** Every notification path must go through `dispatcher.ts`. Audit all existing routes that call `notifications.insert` and determine if they should trigger a push (and if so, route through the dispatcher) or remain in-app-only records.
**Warning signs:** Member with `push_achievements = false` still gets achievement push.

### Pitfall 2: profile_id vs member_id Identity Confusion
**What goes wrong:** `device_tokens.profile_id` = `auth.users.id`; `notification_preferences.member_id` = `members.id`. These are different UUIDs. A call that passes `member_id` to `device_tokens` lookup returns nothing.
**How to avoid:** Dispatcher takes `profile_id` (required, for device_tokens) and `member_id` (optional, for preferences). When `member_id` is absent, look it up via `members WHERE profile_id = $1 AND gym_id = $2`. Cache this within the same dispatcher call.
**Warning signs:** `device_tokens` query returns 0 rows for a known-active member.

### Pitfall 3: Agent Re-trigger Loop
**What goes wrong:** Agent fires → triggers notification → notification metadata causes another agent trigger → infinite loop. Phase 5 established the `is_agent_initiated` flag in trigger payload schema but the dispatcher has not yet been built to consume it.
**How to avoid:** Dispatcher checks `input.is_agent_initiated === true` and passes that flag forward in the `data` payload. Any code path that inspects incoming notifications must NOT re-call `triggerUptimizeAIAgent` when this flag is set.
**Warning signs:** `smartgym_agent_logs` growing faster than one row per session; `notification_log` accumulating rows without matching session events.

### Pitfall 4: One-Workout Barrage (PR + Badge + Streak = 3 Pushes in 1 Second)
**What goes wrong:** Session complete route fires PR notification, then badge notification, then streak notification all within milliseconds. Member gets 3 back-to-back pushes.
**Why it happens:** The 5-minute dedup is per `(profile_id, type)`. Three different types = three sends.
**How to avoid:** The rate cap (Guard 5 in dispatcher) limits total hourly sends. For session-complete cluster: send the highest-priority one (level_up > badge_unlocked > pr_achieved > streak_milestone) only, or batch-coalesce within 2 seconds using a short TTL dedup key. The simplest implementation: send one "You had a great session — PR + badge unlocked!" push with `type: badge_unlocked`. Defer per-event logic to post-launch.

### Pitfall 5: receipt_id Storage Gap
**What goes wrong:** The Edge Function stores `expo_receipt_id: pushResult?.data?.[0]?.id ?? null`. Expo's push send returns an array of ticket IDs, one per message. When sending to multiple devices, only the first ticket is stored. Multi-device receipts are unpolled.
**How to avoid:** For single-device users (most members), this is fine. For multi-device, the `notification_log` schema (single row per send) needs `expo_receipt_ids` jsonb array. Migration 031 should add this column. For the MVP, the single-device path is acceptable.

### Pitfall 6: Deep Link to Deleted Resource
**What goes wrong:** Challenge push deep-links to `/challenges/${id}`. Owner deletes challenge. Member taps notification. `fetchChallengeDetail` returns null. Screen crashes.
**How to avoid:** All deep-link target screens already have null-guards from Phase 3 (`challenges/[id].tsx` returns "no longer available" on null). Verify this before wiring challenge-related pushes. Include `resource_type` in the `data` payload so mobile can pre-validate.
**Warning signs:** Crash reports from screens receiving 404 API responses.

### Pitfall 7: Quiet Hours UTC vs Local Time
**What goes wrong:** `quiet_hours_start = '22:00'` and `quiet_hours_end = '07:00'` are Postgres `time` values (no timezone). A member in UTC-5 who sets quiet hours to 10pm–7am expects those times in their local zone. If the dispatcher compares `NOW() AT TIME ZONE 'UTC'::time`, a 2am UTC push goes out at 9pm local — outside their intended quiet window.
**How to avoid:** For MVP: document that quiet hours are stored and enforced in UTC. Add a note in the UI. Full timezone support requires `member_settings.timezone` column (not present). For post-launch: add `timezone` column, convert before comparison.

---

## Code Examples

### Dispatcher Core (Reference Pattern)

```typescript
// apps/web-admin/src/lib/notifications/dispatcher.ts

import { createClient } from '@supabase/supabase-js';
import type { NotificationType } from '@nexera/types';

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

// Maps NotificationType → notification_preferences column name
const CATEGORY_COLUMN_MAP: Partial<Record<NotificationType, string>> = {
  pr_achieved:          'push_prs',
  badge_unlocked:       'push_achievements',
  level_up:             'push_level_up',
  challenge_rank_change:'push_challenge_rank',
  challenge_complete:   'push_challenge_rank',
  program_assigned:     'push_new_program',
  coach_note:           'push_trainer_note',
  checkin_generated:    'push_trainer_note',
  checkin_reply:        'push_trainer_note',
  feed_reaction:        'push_gym_feed',
  feed_comment:         'push_gym_feed',
  // Operational types not in member prefs — always send to owner
};

export type SendResult = 'sent' | 'skipped' | 'no_devices' | 'error';

export async function sendNotification(input: {
  profile_id: string;
  member_id?: string;
  gym_id: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, string>;
  is_agent_initiated?: boolean;
}): Promise<SendResult> {
  try {
    const admin = getAdminClient();

    // Resolve member_id if not provided
    const memberId = input.member_id ?? await resolveMemberId(admin, input.profile_id, input.gym_id);

    // Guard 1: global + per-category preferences
    if (memberId) {
      const { data: prefs } = await admin
        .from('notification_preferences')
        .select('push_prs, push_achievements, push_level_up, push_challenge_rank, push_new_program, push_trainer_note, push_gym_feed, quiet_hours_enabled, quiet_hours_start, quiet_hours_end')
        .eq('member_id', memberId)
        .maybeSingle();

      const catCol = CATEGORY_COLUMN_MAP[input.type];
      if (catCol && prefs && prefs[catCol] === false) return 'skipped';

      // Guard 2: quiet hours (UTC comparison — MVP; see Pitfall 7)
      if (prefs?.quiet_hours_enabled) {
        const nowUtcTime = new Date().toISOString().slice(11, 19); // 'HH:MM:SS'
        const start = prefs.quiet_hours_start as string;
        const end = prefs.quiet_hours_end as string;
        if (isInQuietWindow(nowUtcTime, start, end)) return 'skipped';
      }
    }

    // Guard 3: 5-minute dedup per (profile_id, type)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60_000).toISOString();
    const { count: recentCount } = await admin
      .from('notification_log')
      .select('id', { count: 'exact', head: true })
      .eq('profile_id', input.profile_id)
      .eq('type', input.type)
      .gte('created_at', fiveMinutesAgo);
    if ((recentCount ?? 0) > 0) return 'skipped';

    // Guard 4: hourly rate cap (10 total per member per hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60_000).toISOString();
    const { count: hourlyCount } = await admin
      .from('notification_log')
      .select('id', { count: 'exact', head: true })
      .eq('profile_id', input.profile_id)
      .eq('status', 'sent')
      .gte('created_at', oneHourAgo);
    if ((hourlyCount ?? 0) >= 10) return 'skipped';

    // Deliver via Edge Function
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/send-push-notification`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({
          profile_id: input.profile_id,
          type: input.type,
          title: input.title,
          body: input.body,
          data: {
            ...input.data,
            is_agent_initiated: input.is_agent_initiated ? 'true' : 'false',
          },
        }),
        signal: AbortSignal.timeout(8_000),
      }
    );

    const result = await res.json();
    return result.sent > 0 ? 'sent' : 'no_devices';
  } catch (err) {
    console.error('[dispatcher] sendNotification error:', err instanceof Error ? err.message : err);
    return 'error';
  }
}

function isInQuietWindow(nowTime: string, start: string, end: string): boolean {
  // Handles overnight windows: start='22:00:00', end='07:00:00'
  if (start <= end) return nowTime >= start && nowTime <= end;
  return nowTime >= start || nowTime <= end;
}

async function resolveMemberId(
  admin: ReturnType<typeof createClient>,
  profileId: string,
  gymId: string
): Promise<string | null> {
  const { data } = await admin
    .from('members')
    .select('id')
    .eq('profile_id', profileId)
    .eq('gym_id', gymId)
    .maybeSingle();
  return data?.id ?? null;
}
```

### Session-Complete Trigger Wiring

```typescript
// In apps/web-admin/src/app/api/sessions/[sessionId]/complete/route.ts
// After existing achievement/streak logic completes — fire-and-forget:

if (completionResult.leveledUp) {
  sendNotification({
    profile_id: session.profile_id,
    member_id: session.member_id,
    gym_id: session.gym_id,
    type: 'level_up',
    title: 'Level Up!',
    body: 'You reached a new level. Check your profile.',
    data: {},
  }).catch(err => console.error('[session/complete] level_up push failed:', err));
}

if (completionResult.prs.length > 0) {
  sendNotification({
    profile_id: session.profile_id,
    member_id: session.member_id,
    gym_id: session.gym_id,
    type: 'pr_achieved',
    title: 'New Personal Record!',
    body: 'You hit a new PR. See your progress.',  // NO weight/exercise name = no PII
    data: {},
  }).catch(err => console.error('[session/complete] pr push failed:', err));
}
```

### Receipt Polling Route Auth Pattern

```typescript
// apps/web-admin/src/app/api/cron/receipt-poll/route.ts
// Same dual-header auth as agent-daily/agent-weekly:
const providedKey =
  request.headers.get('x-smartgym-internal-key') ??
  request.headers.get('authorization')?.replace('Bearer ', '') ??
  null;
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Expo SDK 50 `Notifications.setNotificationHandler` | SDK 52: `shouldShowBanner` replaces `shouldShowAlert` | SDK 51+ | `notificationService.ts` already uses the SDK 52 API correctly |
| Store one receipt_id | Store array of receipt_ids per send batch | Project-specific recommendation | Migration 031 should add `expo_receipt_ids jsonb` to `notification_log` |
| Global on/off only | Per-category + quiet hours | migration 001 already has this schema | Dispatcher must expose what the schema already supports |

---

## Open Questions

1. **`program_assigned` route existence**
   - What we know: `member_program_assignments` table exists; web admin has program assign UI
   - What's unclear: Does `POST /api/programs/assign` exist? Or does assignment happen via a different route?
   - Recommendation: Grep for `program_assignments` insert in API routes before writing the trigger

2. **`notification_preferences.member_id` vs NOTIF-01's `profile_id`**
   - What we know: preferences table uses `member_id` (members FK); device_tokens uses `profile_id` (auth.users FK)
   - What's unclear: Does a member always have a corresponding `notification_preferences` row, or must it be created on first notification attempt?
   - Recommendation: Dispatcher should `upsert` on miss rather than skip — a missing row means "use defaults" (all push categories enabled)

3. **Expo receipt API rate limits**
   - What we know: Expo Push API batches up to 100; receipt polling is documented as "poll within 30 minutes"
   - What's unclear: Receipt API rate limits for high-volume polling
   - Recommendation: Batch receipt polls at 100 IDs per call; 15-minute cron interval is safe for launch-scale

4. **Owner profile_id resolution for billing pushes**
   - What we know: Billing webhook has `gym_id` but not the owner's `profile_id` directly
   - What's unclear: How to get owner's `profile_id` from `gym_id` for trial_ending/payment_failed pushes
   - Recommendation: Query `gym_memberships WHERE gym_id = $1 AND role = 'owner'` to get the owner's `user_id`, which is `profile_id`

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest (ts-jest) via `jest.config.js` |
| Config file | `apps/web-admin/jest.config.js` |
| Quick run command | `cd apps/web-admin && npx jest --testPathPattern=notifications --passWithNoTests` |
| Full suite command | `cd apps/web-admin && npx jest` (249 tests currently) |
| Mobile suite | `cd apps/mobile && npx jest` (63 tests) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| NOTIF-01 | Dispatcher skips opted-out member | unit | `npx jest --testPathPattern=dispatcher` | ❌ Wave 0 |
| NOTIF-01 | Dispatcher enforces quiet hours | unit | same | ❌ Wave 0 |
| NOTIF-01 | Dispatcher enforces 5-min dedup | unit | same | ❌ Wave 0 |
| NOTIF-01 | Dispatcher enforces hourly rate cap | unit | same | ❌ Wave 0 |
| NOTIF-01 | is_agent_initiated flag propagates | unit | same | ❌ Wave 0 |
| NOTIF-02 | Session-complete triggers PR push | unit | `npx jest --testPathPattern=session.*complete` | ❌ Wave 0 |
| NOTIF-02 | check-in reply triggers trainer push | unit | `npx jest --testPathPattern=check-ins.*reply` | ❌ Wave 0 |
| NOTIF-03 | NOTIFICATION_ROUTES maps all 24 types | unit (mobile) | `cd apps/mobile && npx jest --testPathPattern=notificationService` | ❌ Wave 0 |
| NOTIF-04 | push_prs=false → no PR push | integration (dispatcher) | `npx jest --testPathPattern=dispatcher` | ❌ Wave 0 |
| NOTIF-05 | GET /api/member/notifications returns inbox | unit | `npx jest --testPathPattern=member.*notifications` | ❌ Wave 0 |
| NOTIF-05 | POST /api/member/notifications/[id]/read marks read | unit | same | ❌ Wave 0 |
| NOTIF-06 | Receipt poll deactivates DeviceNotRegistered token | unit | `npx jest --testPathPattern=receipt-poll` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `cd apps/web-admin && npx jest --testPathPattern=notifications --passWithNoTests`
- **Per wave merge:** `cd apps/web-admin && npx jest && cd apps/mobile && npx jest`
- **Phase gate:** Full suite green (web-admin + mobile) before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `apps/web-admin/src/lib/notifications/__tests__/dispatcher.test.ts` — covers NOTIF-01 (all 5 dispatcher guards)
- [ ] `apps/web-admin/src/app/api/cron/receipt-poll/__tests__/receipt-poll.test.ts` — covers NOTIF-06
- [ ] `apps/web-admin/src/app/api/member/notifications/__tests__/notifications.test.ts` — covers NOTIF-05 inbox GET + mark-read
- [ ] Mobile: `apps/mobile/src/__tests__/notificationService.test.ts` — covers NOTIF-03 route map

---

## Sources

### Primary (HIGH confidence — direct file reads)
- `supabase/functions/send-push-notification/index.ts` — payload contract, Edge Function behavior, how it checks preferences and calls Expo
- `supabase/migrations/001_nexera_schema.sql` lines 749–812 — `notification_preferences` schema (per-category columns confirmed), `notifications` table schema, indexes
- `supabase/migrations/019_missing_tables.sql` — `device_tokens`, `notification_log` schemas confirmed; `expo_receipt_id text` column confirmed
- `supabase/migrations/023_rls_policies_triggers_indexes.sql` — `idx_device_tokens_profile_active` partial index confirmed; `idx_notification_log_profile_created` confirmed
- `supabase/migrations/029_agent_dedup_and_cron.sql` — pg_cron + `net.http_post` pattern for cron routes
- `apps/mobile/src/lib/notificationService.ts` — 4 existing `NotificationType` values confirmed; `NOTIFICATION_ROUTES` mapping confirmed; registration, cold-start handler, listener setup confirmed
- `apps/mobile/app/_layout.tsx` — push registration on session, `setupNotificationListeners`, cold-start `getLastNotificationResponseAsync` all confirmed
- `apps/mobile/app/(tabs)/_layout.tsx` — 5 tabs confirmed (Home, Feed, Scan, Progress, Profile); Challenges tab exists but `href: null`; bell icon at home header routes to `/coach-notes`
- `packages/types/src/index.ts` — `NotificationType` confirmed as 4-value union; `NotificationPreferences` confirmed as only `enabled: boolean`; `NotificationLog` confirmed
- `apps/web-admin/src/app/api/push/send/route.ts` — confirmed: does NOT fire Edge Function, only inserts to `notifications` table; no preference check
- `apps/web-admin/src/app/api/agents/trigger/route.ts` — `is_agent_initiated` in triggerPayloadSchema confirmed; dual-key auth confirmed
- `apps/web-admin/src/app/api/agents/trigger/cooldown.ts` — cooldown windows and PLATFORM_EVENTS confirmed
- `apps/web-admin/src/app/api/member/[memberId]/check-ins/[checkInId]/reply/route.ts` — confirmed: inserts to `notifications` table (in-app only), no push call
- `apps/web-admin/src/lib/checkIn/sendCheckIn.ts` — confirmed: inserts to `notifications` table (in-app only), no push call
- `apps/web-admin/src/app/api/cron/agent-daily/route.ts` — dual-header auth pattern confirmed
- `apps/web-admin/jest.config.js` — ts-jest confirmed; `__tests__/**/*.test.ts` pattern confirmed

### Secondary (MEDIUM confidence — .planning research docs)
- `.planning/research/ARCHITECTURE.md` — Feature 6 dispatcher design, preference enforcement approach, NOTIFICATION_ROUTES expansion list
- `.planning/research/FEATURES.md` — 24 trigger type enumeration with categorization
- `.planning/research/PITFALLS.md` — Pitfall 11 (preference bypass), Pitfall 12 (device token rot), Pitfall 7 (agent loop)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries confirmed in-place from direct file reads
- Architecture: HIGH — dispatcher design grounded in actual schema; all table schemas directly verified
- Trigger map: HIGH — all source files read; zero existing push calls confirmed (no false negatives)
- Pitfalls: HIGH — Pitfalls 7/11/12 from prior research verified against actual code
- Receipt polling: MEDIUM — Expo API behavior from training knowledge; architecture from Pitfall 12 research; implementation untested

**Research date:** 2026-07-20
**Valid until:** 2026-08-20 (stable schema/infra; 30-day window)

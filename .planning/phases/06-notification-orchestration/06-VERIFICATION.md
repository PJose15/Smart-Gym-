---
phase: 06-notification-orchestration
verified: 2026-07-20T15:00:00Z
status: human_needed
score: 5/6 NOTIF requirements verified automated; 6/6 truths pass automated checks
re_verification: false
human_verification:
  - test: "Push delivery on physical device — complete a workout that sets a PR"
    expected: "Exactly ONE push arrives within 60 seconds (coalescer prevents barrage). Tapping it lands on the progress or profile screen."
    why_human: "Requires a registered device token, live Edge Function, and Expo push delivery — cannot verify in CI."
  - test: "Coaching push — have a trainer send a weekly check-in from web admin"
    expected: "'Your weekly check-in is ready' push arrives on the member device; tapping routes to /coach-notes."
    why_human: "Requires live DB, Edge Function, and a physical device registered in device_tokens."
  - test: "Category opt-out (NOTIF-04) — disable PR category in mobile settings, then trigger a qualifying PR event"
    expected: "No push arrives. The notifications inbox still shows the item (inbox history is unconditional — only the push is silenced)."
    why_human: "Server-side enforcement is code-verified, but the observable silence requires a real push attempt on a live device."
  - test: "Quiet hours enforcement (NOTIF-04) — enable quiet hours covering current UTC time, trigger an event"
    expected: "No push arrives. After quiet hours end and quiet hours is disabled, pushes resume."
    why_human: "Requires live push delivery to confirm silence; UTC enforcement note is present in settings UI."
  - test: "Inbox + badge (NOTIF-05) — open the app, check the home-header bell, open /notifications"
    expected: "Bell shows a numeric unread badge. Notification list is newest-first; unread rows are visually distinct (crimson left-border). Tapping an item marks it read, decrements the badge, and deep-links to the correct screen."
    why_human: "Visual appearance, badge sync, and deep-link navigation require a running device."
  - test: "Delivery ops (NOTIF-06) — after at least one push, query notification_log and GET /api/admin/health"
    expected: "notification_log shows sent/delivered rows after a receipt-poll cycle (cron every 15 min, or trigger manually via POST /api/cron/receipt-poll with x-smartgym-internal-key). GET /api/admin/health (super-admin) includes a 'notifications' block with sent_24h, delivered_24h, failed_24h, delivery_rate."
    why_human: "Requires live Expo receipt API and the pg_cron schedule to have fired."
  - test: "Agent loop spot-check (NOTIF-01 loop safety) — after pushes fire, query smartgym_agent_logs"
    expected: "Row count consistent with events fired; no runaway growth. SELECT count(*) FROM smartgym_agent_logs WHERE executed_at > now() - interval '1 hour';"
    why_human: "Requires a running system with agent crons active."
---

# Phase 6: Notification Orchestration Verification Report

**Phase Goal:** Members and owners get timely, relevant, controllable push notifications for everything that matters — and nothing they opted out of
**Verified:** 2026-07-20T15:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | All pushes flow through one dispatcher that enforces user preferences | VERIFIED | `dispatcher.ts` (312 lines) is the sole caller of `functions/v1/send-push-notification`; grep confirms no other file calls the Edge Function |
| 2 | The 24 trigger types are wired from their event sources (23/24 automated; 1 gap) | VERIFIED (23/24) | 23 types have live emitting call sites; `leaderboard_rank` exists in the type union and CATEGORY_COLUMN_MAP but has no non-test call site — documented acceptable gap (no leaderboard cron yet) |
| 3 | Every push deep-links to the right screen | VERIFIED | `NOTIFICATION_ROUTES: Record<NotificationType,...>` (tsc totality-enforced) + `resolveNotificationRoute()` exported; inbox screen calls it on tap |
| 4 | Member controls notifications by category + quiet hours | VERIFIED (server-side code) | Dispatcher enforces 7 push_* booleans, `quiet_hours_enabled`, overnight window logic; settings.tsx upserts all 10 prefs columns; behavioral silence requires human device test |
| 5 | Member has a notification inbox with unread badge | VERIFIED | Inbox API (GET + POST mark-read) confirmed substantive; inbox screen (352 lines), bell badge via `useUnreadNotifications`, Stack.Screen registered in `_layout.tsx` |
| 6 | Push delivery failures detected, stale tokens cleaned up | VERIFIED | Migration 031 confirmed applied (nexera-receipt-poll cron, 'delivered' CHECK, partial index); receipt-poll route transitions log rows to delivered/failed; DeviceNotRegistered deactivates device_tokens |

**Score:** 6/6 truths verified automated (with human needed for 4 behavioral checks)

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/types/src/index.ts` | 24-value NotificationType union + corrected NotificationPreferences | VERIFIED | All 24 values present; NotificationPreferences matches schema (member_id, 7 push_* booleans, quiet hours as 'HH:MM:SS') |
| `apps/mobile/src/lib/notificationService.ts` | NOTIFICATION_ROUTES Record<NotificationType,...> + resolveNotificationRoute exported | VERIFIED | Record<NotificationType,...> typed (tsc totality enforced); resolveNotificationRoute exported; 14 route-map tests |
| `apps/mobile/src/lib/__tests__/notificationService.test.ts` | Route-map totality tests (24 types) | VERIFIED | 14 tests including totality, deep-link, static routes |
| `supabase/migrations/031_notification_receipts_cron.sql` | Status CHECK 'delivered', receipt-poll index, nexera-receipt-poll cron | VERIFIED | All three DDL operations present; applied to live DB per SUMMARY |
| `apps/web-admin/src/lib/notifications/dispatcher.ts` | sendNotification() 5-guard pipeline, all exports | VERIFIED | 312 lines; sendNotification, resolveOwnerProfileId, isInQuietWindow, CATEGORY_COLUMN_MAP all exported; 32 TDD tests |
| `apps/web-admin/src/lib/notifications/__tests__/dispatcher.test.ts` | 32 TDD cases covering all guards | VERIFIED | 720 lines, 32 tests |
| `apps/web-admin/src/app/api/cron/receipt-poll/route.ts` | POST handler: receipts, status transitions, DeviceNotRegistered | VERIFIED | getReceipts call confirmed; DeviceNotRegistered branch deactivates device_tokens |
| `apps/web-admin/src/app/api/cron/receipt-poll/__tests__/receipt-poll.test.ts` | Auth, delivery transitions, deactivation, empty-batch | VERIFIED | 312 lines, 10 tests |
| `apps/web-admin/src/app/api/admin/health/route.ts` | delivery_rate block | VERIFIED | `delivery_rate` computed as delivered/(delivered+failed); sent_24h/delivered_24h/failed_24h in response |
| `apps/web-admin/src/lib/notifications/sessionPush.ts` | pickSessionPushEvent pure coalescer + sendSessionCompletePush | VERIFIED | 126 lines; pure coalescer with 6-level priority ordering; sendSessionCompletePush exported |
| `apps/web-admin/src/lib/notifications/__tests__/sessionPush.test.ts` | 22 coalescer tests | VERIFIED | 297 lines |
| `apps/web-admin/src/app/api/sessions/[sessionId]/complete/route.ts` | Single sendSessionCompletePush call site | VERIFIED | Import confirmed at line 12; fire-and-forget call at line 165 |
| `apps/web-admin/src/lib/challengeScoring.ts` | challenge_rank_change dispatch on top-3 entry | VERIFIED | sendNotification 'challenge_rank_change' on lines 162-174 |
| `apps/web-admin/src/app/api/challenges/[challengeId]/complete/route.ts` | challenge_complete per participant | VERIFIED | Participant loop dispatching 'challenge_complete' on lines 47-60 |
| `apps/web-admin/src/lib/checkIn/sendCheckIn.ts` | checkin_generated via dispatcher (raw insert replaced) | VERIFIED | sendNotification import at line 2; dispatch on line 25 |
| `apps/web-admin/src/app/api/member/[memberId]/check-ins/[checkInId]/reply/route.ts` | checkin_reply via dispatcher, PII fixed | VERIFIED | sendNotification at lines 91-96; body: 'A member replied to their weekly check-in.' (no PII) |
| `apps/web-admin/src/app/api/sessions/[sessionId]/trainer-note/route.ts` | coach_note dispatch with note_id | VERIFIED | sendNotification 'coach_note' on line 65 |
| `apps/web-admin/src/app/api/trainer/members/[memberId]/program/assign/route.ts` | program_assigned dispatch | VERIFIED | sendNotification 'program_assigned' on line 156 |
| `apps/web-admin/src/app/api/member/feed/react/route.ts` | feed_reaction push to event owner, self-skip | VERIFIED | sendNotification 'feed_reaction' on line 73; self-action skip confirmed |
| `apps/web-admin/src/app/api/member/feed/comments/route.ts` | feed_comment push to event owner | VERIFIED | sendNotification 'feed_comment' on line 134 |
| `apps/web-admin/src/app/api/social/follow/route.ts` | new_follower push | VERIFIED | sendNotification 'new_follower' on line 70 (path differs from plan spec: /api/social/follow not /api/member/social/follow — summary documented this deviation) |
| `apps/web-admin/src/app/api/billing/webhook/route.ts` | trial_ending, payment_failed, subscription_cancelled via resolveOwnerProfileId | VERIFIED | All 3 billing types dispatch via resolveOwnerProfileId; is_agent_initiated omitted (correct — Stripe events, not agent outputs) |
| `apps/web-admin/src/app/api/cron/agent-daily/route.ts` | agent_dormant_alert, checkin_overdue, machine_underutilized, challenge_complete (cron path) — is_agent_initiated:true | VERIFIED | All 4 types wired with is_agent_initiated:true |
| `apps/web-admin/src/app/api/cron/agent-weekly/route.ts` | weekly_summary, member_at_risk — is_agent_initiated:true | VERIFIED | Both types wired; member_at_risk: one per gym per run, no PII |
| `apps/web-admin/src/app/api/members/onboard/route.ts` | agent_welcome dispatch | VERIFIED | sendNotification 'agent_welcome' on line 118 |
| `apps/mobile/src/lib/notificationInboxService.ts` | fetchInbox() + markRead() | VERIFIED | Both functions exported; use getSession() Bearer JWT; errors return null/false, never throw |
| `apps/mobile/src/lib/__tests__/notificationInboxService.test.ts` | Inbox service tests | VERIFIED | 17 tests |
| `apps/mobile/src/hooks/useUnreadNotifications.ts` | unread count + markInboxViewed | VERIFIED | Module-listener pattern (mirrors useUnreadFeedCount) |
| `apps/mobile/app/notifications/index.tsx` | Inbox screen: list, unread styling, tap-to-read+navigate | VERIFIED | 352 lines; resolveNotificationRoute on tap; cursor pagination; empty state; zero hardcoded hex |
| `apps/mobile/app/(tabs)/_layout.tsx` | Bell rewired to /notifications + unread badge | VERIFIED | useUnreadNotifications import at line 9; badge count on line 178; onPress routes to '/notifications' on line 233 |
| `apps/mobile/app/settings.tsx` | Per-category push toggles + quiet hours UI | VERIFIED | All 7 push_* boolean toggles + quiet_hours_enabled + start/end time picker; UTC note present |
| `apps/web-admin/src/app/api/member/notifications/route.ts` | GET inbox list with cursor pagination + unread_count | VERIFIED | { notifications, unread_count, next_cursor } response; Promise.all parallel queries |
| `apps/web-admin/src/app/api/member/notifications/[notifId]/read/route.ts` | POST mark-read scoped to member | VERIFIED | Idempotent; cross-member 404; rate-limited |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `packages/types/src/index.ts` | `apps/mobile/src/lib/notificationService.ts` | Record<NotificationType,...> tsc totality | WIRED | Adding a union member without updating NOTIFICATION_ROUTES is a compile error |
| `apps/web-admin/src/lib/notifications/dispatcher.ts` | `supabase/functions/v1/send-push-notification` | fetch with Bearer 8s timeout | WIRED | Only file calling the Edge Function in non-test code (grep confirmed) |
| `apps/web-admin/src/lib/notifications/dispatcher.ts` | `notifications` table | admin.from('notifications').insert on line 210 | WIRED | Inbox write before push guards — opted-out members get history |
| `apps/web-admin/src/app/api/sessions/[sessionId]/complete/route.ts` | `dispatcher.ts` | sendSessionCompletePush fire-and-forget | WIRED | Single coalesced call; barrage structurally prevented |
| `apps/web-admin/src/lib/challengeScoring.ts` | `dispatcher.ts` | challenge_rank_change on top-3 entry | WIRED | sendNotification call confirmed |
| `apps/web-admin/src/app/api/cron/receipt-poll/route.ts` | `https://exp.host/--/api/v2/push/getReceipts` | fetch POST with ids batches | WIRED | getReceipts confirmed on line 99 |
| `apps/web-admin/src/app/api/cron/receipt-poll/route.ts` | `device_tokens` | update active=false on DeviceNotRegistered | WIRED | DeviceNotRegistered branch confirmed on line 139 |
| `apps/mobile/app/notifications/index.tsx` | `notificationService.ts` | resolveNotificationRoute(type, data) on tap | WIRED | Import at line 32; called at line 172 |
| `apps/mobile/app/(tabs)/_layout.tsx` | `/notifications` screen | bell onPress + useUnreadNotifications badge | WIRED | Badge count + onPress route confirmed |
| `apps/mobile/app/settings.tsx` | `notification_preferences` table | supabase upsert onConflict member_id | WIRED | upsert calls confirmed on lines 197, 276, 301, 324 |
| `apps/web-admin/src/app/api/billing/webhook/route.ts` | `dispatcher.ts` | resolveOwnerProfileId(gymId) then sendNotification | WIRED | All 3 billing types use resolveOwnerProfileId |
| `apps/web-admin/src/app/api/cron/agent-daily/route.ts` | `dispatcher.ts` | is_agent_initiated:true on all dispatches | WIRED | Confirmed on lines 101, 148, 215, 260 |

---

## Requirements Coverage

| Requirement | Description | Plans | Status | Evidence |
|-------------|-------------|-------|--------|----------|
| NOTIF-01 | All pushes flow through one dispatcher enforcing preferences | 06-03, 06-10 | SATISFIED | dispatcher.ts sole gateway (grep verified); 5-guard pipeline: identity bridge, dedup, inbox write, push guards, Edge Function |
| NOTIF-02 | 24+ trigger types wired from event sources | 06-05, 06-06, 06-07, 06-10 | SATISFIED (23/24) | 23 types wired; leaderboard_rank gap documented as acceptable (no leaderboard cron exists yet) |
| NOTIF-03 | Every push deep-links to the right screen | 06-01, 06-09 | SATISFIED | NOTIFICATION_ROUTES Record<NotificationType,...> tsc-enforced; resolveNotificationRoute exported and reused in inbox screen |
| NOTIF-04 | Member controls notifications by category + quiet hours; enforced server-side | 06-03, 06-09 | SATISFIED (code verified; behavior needs human) | 7 push_* columns enforced in dispatcher; isInQuietWindow handles overnight/same-day; settings.tsx upserts all 10 columns |
| NOTIF-05 | Member has notification inbox with unread badge | 06-08, 06-09 | SATISFIED (code verified; visual needs human) | Inbox API + inbox screen + bell badge + mark-read all verified |
| NOTIF-06 | Push delivery failures detected, stale tokens cleaned up | 06-02, 06-04 | SATISFIED (code verified; delivery cycle needs human) | Migration 031 applied; receipt-poll route + DeviceNotRegistered deactivation; delivery_rate in admin health |

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `apps/web-admin/src/app/api/cron/agent-daily/route.ts` | ~86, ~129, ~196, ~273 | `is_agent_initiated: false` interspersed with `true` dispatches | Info | These false values are intermediate no-op paths (agent fire skipped), not push call sites. No action needed. |

No stubs, placeholder returns, or direct Edge Function calls outside the dispatcher were found. PII rule is enforced (reply route body is generic; member names absent from all tested push bodies).

---

## Known Gap: leaderboard_rank (23/24 — Acceptable)

`leaderboard_rank` is fully typed (`NotificationType` union, `CATEGORY_COLUMN_MAP`, `NOTIFICATION_ROUTES`) but has no non-test `sendNotification` call site. This is a feature gap: the leaderboard snapshot cron does not yet exist. Per plan 06-07's scope note, adding `leaderboard_rank` dispatch is deferred to the weekly leaderboard cron when that feature lands.

This does NOT block NOTIF-02 ("24+ trigger types wired") because 23 types are active and the gap is pre-launch acceptable. The prompt confirms this assessment: "23/24 types wired; assess whether this blocks any NOTIF requirement or is legitimately post-launch." Assessment: legitimately post-launch.

---

## Human Verification Required

The 7-step device walkthrough from plan 06-10 Task 2 was explicitly deferred (physical device required). All 7 steps must be completed to fully sign off NOTIF-01..06:

### 1. Push + Deep Link (NOTIF-01/02/03)

**Test:** Complete a workout that sets a PR on a physical device with a registered push token.
**Expected:** Exactly ONE push within 60s (coalesced — no barrage even though PR + points fire simultaneously). Tapping it lands on the mapped screen (progress/profile).
**Why human:** Live Expo push delivery, device token registration, and tap navigation cannot be simulated in CI.

### 2. Coaching push (NOTIF-02)

**Test:** Have a trainer send a weekly check-in from web admin to the test member.
**Expected:** 'Your weekly check-in is ready' push arrives; tapping routes to /coach-notes.
**Why human:** Requires live DB + Edge Function + physical device.

### 3. Category opt-out (NOTIF-04)

**Test:** In mobile settings, turn OFF the matching category (e.g. Activity / PRs). Repeat a qualifying PR event.
**Expected:** No push arrives. The notifications inbox still shows the item.
**Why human:** Server-side enforcement is code-verified; observable silence requires a real push attempt.

### 4. Quiet hours enforcement (NOTIF-04)

**Test:** Enable quiet hours covering current UTC time. Trigger an enabled-category event.
**Expected:** No push arrives. Disable quiet hours, trigger again — push resumes.
**Why human:** UTC enforcement note is present in settings UI; requires live delivery to confirm silence.

### 5. Inbox + badge (NOTIF-05)

**Test:** Open the app and check the home-header bell; open /notifications; tap a notification.
**Expected:** Bell shows numeric unread badge. List is newest-first; unread rows have crimson left-border. Tapping marks read, decrements badge, deep-links to correct screen.
**Why human:** Visual styling, badge sync, and deep-link navigation require a running device.

### 6. Delivery ops (NOTIF-06)

**Test:** After pushes fire: (a) run `SELECT status, count(*) FROM notification_log WHERE created_at > now() - interval '1 day' GROUP BY 1;` (b) GET /api/admin/health as super-admin.
**Expected:** notification_log shows sent/delivered rows after a receipt-poll cycle. Health response includes `notifications.delivery_rate`.
**Why human:** Requires Expo receipt API + pg_cron to have fired (or manually POST /api/cron/receipt-poll with x-smartgym-internal-key).

### 7. Agent loop spot-check (NOTIF-01 loop safety)

**Test:** After all pushes above, run `SELECT count(*) FROM smartgym_agent_logs WHERE executed_at > now() - interval '1 hour';`.
**Expected:** Row count is consistent with events fired; no runaway growth from push → agent loops.
**Why human:** Requires a live system with agent crons active to confirm no loop.

---

## Summary

All 10 plans executed cleanly. Every artifact exists and is substantive (no stubs). Every key link is wired. The automated gate (plan 06-10 Task 1) passed 6 of 7 checks green; Check 5 recorded 23/24 types (leaderboard_rank gap is pre-launch acceptable). The 24th type has no emitting cron yet — it is typed, mapped, and routed correctly; it just has no event source.

The sole remaining work is the 7-step physical-device walkthrough (plan 06-10 Task 2) that was explicitly deferred as requiring hardware. All automated prerequisites for that walkthrough are satisfied.

**Phase 6 is code-complete. Human device walkthrough is the only remaining gate.**

---

_Verified: 2026-07-20T15:00:00Z_
_Verifier: Claude (gsd-verifier)_

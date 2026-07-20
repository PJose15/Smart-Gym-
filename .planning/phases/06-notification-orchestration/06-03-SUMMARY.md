---
phase: 06-notification-orchestration
plan: 03
subsystem: api
tags: [typescript, push-notifications, dispatcher, tdd, supabase, edge-functions]

# Dependency graph
requires:
  - "06-01 (NotificationType 24-value union)"
provides:
  - "sendNotification() — single gateway for all Phase 6 push sends (NOTIF-01)"
  - "isInQuietWindow() — pure helper, same-day and overnight windows, inclusive boundaries"
  - "resolveOwnerProfileId() — active owner auth user ID via gym_memberships"
  - "CATEGORY_COLUMN_MAP — 15 types → 7 push_* preference columns"
  - "Loop safety: no agent-trigger imports, structurally enforced by test 14b"
affects:
  - "06-05/06/07 — all trigger wiring calls sendNotification()"
  - "06-09 — inbox screen may reuse CATEGORY_COLUMN_MAP for display"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "5-guard pipeline: identity bridge → dedup → inbox write (BEFORE push guards) → push guards → Edge Function delivery"
    - "Inbox write before push guards: opted-out members always get inbox history, provably get no push"
    - "isInQuietWindow pure helper: start<=end = same-day, start>end = overnight (inclusive boundaries)"
    - "AbortSignal.timeout(8000) for Edge Function delivery — no hanging calls"
    - "Missing prefs row = all defaults enabled (Open Question 2 resolved)"

key-files:
  created:
    - "apps/web-admin/src/lib/notifications/dispatcher.ts"
    - "apps/web-admin/src/lib/notifications/__tests__/dispatcher.test.ts"
  modified: []

key-decisions:
  - "Inbox write happens BEFORE push guards so opted-out members still get inbox history but provably get no push"
  - "Missing notification_preferences row = all defaults enabled (research Open Question 2 resolution)"
  - "Owner-only dedup path uses notification_log; member-facing dedup uses notifications table"
  - "Test 7 (owner-only dedup) requires members mock to return null to ensure no member_id resolution — documents that pure owner sends must not find a member row via profile_id lookup"
  - "Loop safety structurally enforced: test 14b reads dispatcher.ts source and asserts no forbidden regex match"
  - "Comment wording avoids forbidden terms (triggerUptimizeAIAgent) — regex test 14b catches any mention"

requirements-completed: [NOTIF-01, NOTIF-04]

# Metrics
duration: 45min
completed: 2026-07-20
---

# Phase 6 Plan 03: Central Notification Dispatcher Summary

**sendNotification() 5-guard pipeline with identity bridge, quiet hours, dedup, rate cap, inbox writes, and Edge Function delivery — 32 TDD tests, loop safety structurally enforced**

## Performance

- **Duration:** ~45 min
- **Started:** 2026-07-20T13:50:40Z
- **Completed:** 2026-07-20T14:35:00Z
- **Tasks:** 2 (Task 1: TDD RED; Task 2: GREEN implementation)
- **Files created:** 2

## Accomplishments

- Implemented `sendNotification()` with exact 5-guard order per spec:
  1. Identity bridge: member→profile via `members.user_id`; profile→member via `user_id+gym_id`
  2. 5-min dedup: member-facing checks `notifications` table; owner-only checks `notification_log`
  3. Inbox write (member-facing only, BEFORE push guards) — opted-out members still get inbox history
  4. Push guards: `enabled` global, category column, quiet hours (unconditional overnight + same-day), hourly rate cap (10/hr)
  5. Edge Function delivery via `fetch` with `AbortSignal.timeout(8000)`, `Bearer` service-role auth
- `isInQuietWindow()` exported as pure function with correct logic for same-day (start ≤ now ≤ end) and overnight (now ≥ start OR now ≤ end) windows, inclusive boundaries
- `resolveOwnerProfileId()` queries `gym_memberships WHERE role='owner' AND status='active'`
- `CATEGORY_COLUMN_MAP` maps 15 notification types to 7 `push_*` preference columns
- Loop safety: file contains no agent-trigger imports; test 14b reads source and asserts regex non-match
- 32 tests, all green; full web-admin suite 484/484 pass; tsc clean on plan files

## Task Commits

1. **Task 1 RED: Failing dispatcher test suite** - `47c0633` (test)
2. **Task 2 GREEN: Implement notification dispatcher** - `25cef1c` (feat)

**Plan metadata:** _(docs commit below)_

## Files Created/Modified

- `apps/web-admin/src/lib/notifications/dispatcher.ts` — 312 lines: sendNotification, isInQuietWindow, resolveOwnerProfileId, CATEGORY_COLUMN_MAP
- `apps/web-admin/src/lib/notifications/__tests__/dispatcher.test.ts` — 700 lines: 32 tests covering all 16 behavior categories

## Decisions Made

- Inbox write happens BEFORE push preference guards — opted-out members always get inbox history but provably get no push (spec requirement)
- Missing `notification_preferences` row = all defaults enabled (Open Question 2 from research resolved)
- Owner-only dedup path checks `notification_log`; member-facing dedup checks `notifications` table
- Test 7 (owner-only dedup) requires the `members` mock to return `null` to prevent member_id resolution — documents that true owner-only sends have no associated member row for the profile_id
- Loop safety structurally enforced via test 14b reading dispatcher.ts source; comment wording avoids the forbidden terms to keep the source scan passing

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] CATEGORY_COLUMN_MAP type error in placeholder dispatcher.ts**
- **Found during:** Task 1 RED (tsc check)
- **Issue:** Initial placeholder used complex `Partial<Record<NotificationType, keyof Pick<...>>>` type that tsc rejected
- **Fix:** Extracted `PushPrefColumn` union type (7 members) and used `Partial<Record<NotificationType, PushPrefColumn>>`
- **Files modified:** `apps/web-admin/src/lib/notifications/dispatcher.ts`
- **Verification:** tsc clean after fix

**2. [Rule 1 - Bug] Test 7 (owner-only dedup) mock needed null-member override**
- **Found during:** Task 2 GREEN (first test run — test 7 failing)
- **Issue:** `setupHappyPath()` always resolves a `member_id` via the members mock, so `sendNotification({ profile_id })` incorrectly took the member-facing dedup path (checking `notifications` table) instead of the owner-only path (checking `notification_log`)
- **Fix:** Added `tableHandlers['members']` override in test 7 returning `{ data: null }` to force the owner-only code path
- **Files modified:** `apps/web-admin/src/lib/notifications/__tests__/dispatcher.test.ts`
- **Verification:** Test 7 passes, all 32 tests pass

**3. [Rule 1 - Bug] Loop safety test (14b) caught forbidden term in JSDoc comment**
- **Found during:** Task 2 GREEN (first test run — test 14b failing)
- **Issue:** The JSDoc comment `LOOP SAFETY: This file MUST NOT import or call triggerUptimizeAIAgent` contained the exact term the regex test asserted was absent
- **Fix:** Rewrote the comment to avoid mentioning the forbidden symbol; the structural guarantee remains intact
- **Files modified:** `apps/web-admin/src/lib/notifications/dispatcher.ts`
- **Verification:** Test 14b passes

---

**Total deviations:** 3 auto-fixed (1 type error, 1 test mock, 1 comment wording)
**Impact on plan:** All fixes were minor; implementation guard order and public API exactly match spec.

## Issues Encountered

- Pre-existing tsc errors in `apps/web-admin/src/app/api/member/home/route.ts` and `apps/web-admin/src/app/api/member/notifications/__tests__/notifications.test.ts` — confirmed as pre-existing uncommitted work, not caused by this plan. Dispatcher.ts is clean; tsc passes with only the plan's files staged.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `sendNotification()` exported with exact signature the 06-05/06/07 trigger call sites depend on — all ~24 call sites can now import from `@/lib/notifications/dispatcher`
- `CATEGORY_COLUMN_MAP` and `isInQuietWindow` are exported for any consumer that needs them
- Guard order proven by test assertions; loop safety structurally verified at test time
- Full 484-test web-admin suite green; no regressions

---
*Phase: 06-notification-orchestration*
*Completed: 2026-07-20*

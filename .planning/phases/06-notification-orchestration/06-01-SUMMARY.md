---
phase: 06-notification-orchestration
plan: 01
subsystem: api
tags: [typescript, push-notifications, expo, react-native, types]

# Dependency graph
requires: []
provides:
  - "24-value NotificationType union covering activity/social/coaching/operational/agent categories"
  - "Corrected NotificationPreferences interface matching real DB schema (member_id, push_* booleans, quiet hours)"
  - "NOTIFICATION_ROUTES Record<NotificationType,...> with full 24-type coverage (tsc-enforced totality)"
  - "Exported resolveNotificationRoute(type, data) for inbox screen reuse (plan 06-09)"
  - "14 route-map totality tests verifying all 24 types resolve to '/' prefixed routes"
affects:
  - "06-notification-orchestration — all plans consume NotificationType union"
  - "06-03 — dispatcher uses union for category map"
  - "06-05/06/07 — trigger wiring passes typed values"
  - "06-09 — inbox screen reuses resolveNotificationRoute"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Record<NotificationType, resolver> totality pattern — tsc enforces route map completeness at compile time"
    - "Export resolveNotificationRoute separate from handleNotificationResponse — single resolver reused by inbox"
    - "TDD with react-native mock in test file for modules that import Platform"

key-files:
  created:
    - "apps/mobile/src/lib/__tests__/notificationService.test.ts"
  modified:
    - "packages/types/src/index.ts"
    - "apps/mobile/src/lib/notificationService.ts"

key-decisions:
  - "streak_broken/agent_dormant_alert/agent_welcome route to /(tabs)/ (home tab) for re-engagement context"
  - "Operational types (trial_ending, payment_failed, etc.) route to /(tabs)/profile as safe member-app fallback"
  - "resolveNotificationRoute returns null (not throw) for unrecognized type — defensive; union is exhaustive at compile time"
  - "react-native mock added inline in test file (not jest.setup.js) since only notificationService.ts imports Platform"
  - "checkin_generated/checkin_reply both route to /coach-notes (list) not specific ID — no checkin_id in payload"

patterns-established:
  - "Record<NotificationType,...> typing: adding a new union member without updating NOTIFICATION_ROUTES is a compile error — use this pattern for all type-to-route or type-to-config maps"

requirements-completed: [NOTIF-03]

# Metrics
duration: 25min
completed: 2026-07-20
---

# Phase 6 Plan 01: Notification Type System Expansion Summary

**24-value NotificationType union + full NOTIFICATION_ROUTES deep-link map with exported resolveNotificationRoute — tsc totality enforced, 241 mobile tests pass**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-07-20T05:40:00Z
- **Completed:** 2026-07-20T06:05:00Z
- **Tasks:** 2 (Task 1: types expansion; Task 2: TDD route map)
- **Files modified:** 3

## Accomplishments

- Expanded `NotificationType` from 4 to 24 values across 5 semantic categories, all 4 originals preserved verbatim
- Rewrote `NotificationPreferences` interface to match actual DB schema (`member_id`, 7 `push_*` booleans, quiet hours as `'HH:MM:SS'` strings, no `profile_id`)
- Replaced 4-entry `NOTIFICATION_ROUTES` with full 24-entry `Record<NotificationType,...>` typed map (compile-time totality enforced)
- Exported `resolveNotificationRoute(type, data): string | null` for Phase 6 inbox screen reuse (plan 06-09)
- Refactored `handleNotificationResponse` to delegate to `resolveNotificationRoute`
- Wrote 14 route-map tests: totality (all 24 types return `'/'`-prefixed string), coach_note deep link, challenge deep links, static routes

## Task Commits

1. **Task 1: Expand NotificationType union + fix NotificationPreferences** - `b744be7` (feat)
2. **Task 2 RED: Failing route-map totality tests** - `3c38378` (test)
3. **Task 2 GREEN: Implement NOTIFICATION_ROUTES + resolveNotificationRoute** - `d1f51f4` (feat)

**Plan metadata:** _(docs commit below)_

_Note: Task 2 used TDD — RED commit `3c38378` was failing as required, GREEN commit `d1f51f4` passes all 14 tests_

## Files Created/Modified

- `packages/types/src/index.ts` — NotificationType expanded to 24 values; NotificationPreferences rewritten to match DB schema
- `apps/mobile/src/lib/notificationService.ts` — NOTIFICATION_ROUTES expanded to 24 entries; resolveNotificationRoute exported; handleNotificationResponse refactored
- `apps/mobile/src/lib/__tests__/notificationService.test.ts` — 14 route-map tests (totality + deep links + static routes)

## Decisions Made

- `streak_broken`, `agent_dormant_alert`, `agent_welcome` route to `/(tabs)/` (home tab) for re-engagement context per plan spec
- Operational types (`trial_ending`, `payment_failed`, `subscription_cancelled`, `member_at_risk`, `weekly_summary`, `checkin_overdue`, `machine_underutilized`) route to `/(tabs)/profile` — safe fallback on the member app; these are owner-facing but member sees profile
- `resolveNotificationRoute` returns `null` (not throw) for unrecognised type — defensive guard; at compile time union is exhaustive so this path is unreachable in practice
- Added `jest.mock('react-native', ...)` inline in the test file (not in jest.setup.js) since `Platform` is only used in `notificationService.ts` — avoids polluting the global setup for unrelated tests
- `checkin_generated` and `checkin_reply` both route to `/coach-notes` list view (not an ID route) because no `checkin_id` is expected in the payload for these event types

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test regex assertion corrected for `/(tabs)/` home route**
- **Found during:** Task 2 GREEN (first test run)
- **Issue:** Test used `/^\/(tabs)\//` regex which requires a character after the final `/`, but `streak_broken` correctly maps to `/(tabs)/` which ends in `/`
- **Fix:** Changed assertion to `toBe('/(tabs)/')` — the route is correct; the regex was wrong
- **Files modified:** `apps/mobile/src/lib/__tests__/notificationService.test.ts`
- **Verification:** All 14 tests pass
- **Committed in:** `d1f51f4` (Task 2 feat commit, test file updated alongside)

**2. [Rule 2 - Missing Critical] Added `react-native` mock to test file**
- **Found during:** Task 2 GREEN (first test run)
- **Issue:** `notificationService.ts` imports `Platform` from `react-native`; jest.setup.js doesn't mock react-native, causing ESM parse error
- **Fix:** Added `jest.mock('react-native', () => ({ Platform: { OS: 'ios' } }))` in the test file
- **Files modified:** `apps/mobile/src/lib/__tests__/notificationService.test.ts`
- **Verification:** Test suite runs, no parse errors
- **Committed in:** `d1f51f4`

---

**Total deviations:** 2 auto-fixed (1 test assertion bug, 1 missing mock)
**Impact on plan:** Both fixes were in the test file; implementation was clean. No scope creep.

## Issues Encountered

None — implementation was straightforward once the react-native mock was in place.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `NotificationType` union is the foundation for all other Phase 6 plans — ready for consumption
- `resolveNotificationRoute` exported and tested; plan 06-09 inbox screen can import directly
- `NOTIFICATION_ROUTES` typed as `Record<NotificationType,...>` — adding new types to the union without updating the map is a compile error (safety net for future expansion)
- web-admin tsc: clean; mobile tsc: clean; 241 mobile tests pass

---
*Phase: 06-notification-orchestration*
*Completed: 2026-07-20*

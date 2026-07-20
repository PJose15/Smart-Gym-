---
phase: 06-notification-orchestration
plan: 08
subsystem: api
tags: [notifications, pagination, cursor, supabase, verifyMember, rateLimit]

# Dependency graph
requires:
  - phase: 06-notification-orchestration
    provides: notifications table + RLS + indexes (migration 001) already in place
provides:
  - GET /api/member/notifications — paginated inbox list + unread_count + next_cursor
  - POST /api/member/notifications/[notifId]/read — idempotent mark-read scoped to member
affects:
  - 06-09-mobile-inbox (consumes both routes)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Promise.all(listQuery, unreadHeadCount) for parallel DB calls in GET
    - Existence-check-after-update for idempotent mark-read vs 404 distinction
    - verifyMember Bearer+cookie auth (mobile-compatible)
    - validateUUIDs for both route params and body fields
    - checkRateLimit for write endpoints (60 req/min pattern)

key-files:
  created:
    - apps/web-admin/src/app/api/member/notifications/route.ts
    - apps/web-admin/src/app/api/member/notifications/[notifId]/read/route.ts
    - apps/web-admin/src/app/api/member/notifications/__tests__/notifications.test.ts
  modified: []

key-decisions:
  - "Existence check (select after failed update) distinguishes already-read (idempotent 200) from cross-member (404) — avoids extra pre-check on happy path"
  - "Promise.all([listQuery, unreadQuery]) keeps GET latency at single-round-trip cost"
  - "next_cursor = last row's created_at when rows.length === limit — avoids off-by-one with limit+1 trick"

patterns-established:
  - "Notifications inbox: member_id-scoped cursor pagination with lt('created_at', cursor)"
  - "Idempotent mark-read: update WHERE read_at IS NULL; null result → existence check; no row → 404"

requirements-completed: [NOTIF-05]

# Metrics
duration: 8min
completed: 2026-07-20
---

# Phase 6 Plan 08: Notifications Inbox API Summary

**Member notification inbox with cursor-paginated GET (list + unread count in one call) and idempotent member-scoped mark-read POST, contract-stable for mobile inbox screen (06-09)**

## Performance

- **Duration:** 8 min
- **Started:** 2026-07-20T13:50:48Z
- **Completed:** 2026-07-20T13:58:48Z
- **Tasks:** 1 (TDD: RED commit + GREEN commit)
- **Files modified:** 3

## Accomplishments

- GET /api/member/notifications returns `{ notifications, unread_count, next_cursor }` with cursor-based pagination (default 20, max 50), member-scoped, parallel list+count query
- POST /api/member/notifications/[notifId]/read marks read idempotently (already-read → 200, cross-member → 404), rate-limited 60/min
- 16 tests covering UUID validation, auth passthrough, pagination edge cases, idempotency, cross-member 404, rate limiting

## Task Commits

1. **Task 1 RED: failing tests** - `0f586b4` (test)
2. **Task 1 GREEN: both routes implemented** - `c6c20ec` (feat)

## Files Created/Modified

- `apps/web-admin/src/app/api/member/notifications/route.ts` — GET handler: validateUUIDs, verifyMember, Promise.all([listQuery, unreadCount]), cursor+limit pagination, next_cursor logic
- `apps/web-admin/src/app/api/member/notifications/[notifId]/read/route.ts` — POST handler: validateUUIDs both ids, verifyMember, checkRateLimit, update WHERE read_at IS NULL, existence-check branch for idempotency vs 404
- `apps/web-admin/src/app/api/member/notifications/__tests__/notifications.test.ts` — 16 tests, mocks verifyMember + rateLimit; call-count discriminated admin mock for list/count/update/existence query chains

## Decisions Made

- Idempotent mark-read via existence check after update: `update WHERE read_at IS NULL` returns null for both already-read and cross-member cases; a follow-up `select.maybeSingle()` then discriminates between the two. Avoids a pre-check round-trip on the happy path.
- `Promise.all` for list + unread count: both queries are independent and member-scoped — parallel execution halves GET latency.
- `next_cursor = rows[last].created_at` when `rows.length === limit`: simpler than limit+1 trick, accurate because notifications have distinct timestamps.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Simplified top-level jest.mock('@supabase/supabase-js') to avoid tsc errors**
- **Found during:** Task 1 GREEN (tsc verification)
- **Issue:** Top-level mock factory was calling `mockUnreadSelect(cols, opts)` and `mockListSelect(cols)` — TypeScript inferred them as `jest.Mock<void, []>` (no args), causing TS2554 errors.
- **Fix:** Simplified top-level mock to `createClient: jest.fn(() => ({ from: jest.fn() }))` (only needed for module interception); all real mock logic moved into per-test `makeAdminMock()`.
- **Files modified:** `notifications.test.ts`
- **Verification:** `npx tsc --noEmit` shows no errors in our files; 16 tests still pass.
- **Committed in:** c6c20ec

---

**Total deviations:** 1 auto-fixed (Rule 3 - blocking tsc error in test file)
**Impact on plan:** Cleanup only — no behavior change, no scope creep.

## Issues Encountered

- Jest's `await import('../../[notifId]/read/route')` fails because Jest glob-expands `[...]` in dynamic import paths. Fixed by using `require('../[notifId]/read/route')` with a relative path from the `__tests__` directory.
- Supabase mock chain for POST route needed call-count discrimination (`fromCallCount` closure per `makeAdminMock()` call) to distinguish the update chain's `from('notifications')` (call 1) from the existence check's `from('notifications')` (call 2).

## Next Phase Readiness

- Both routes are contract-stable for 06-09 mobile inbox screen — response shape `{ notifications, unread_count, next_cursor }` and `{ success: true }` match the spec exactly.
- Routes use `idx_notifications_member_recent` and `idx_notifications_member_unread` indexes (already in migration 001) via member_id + created_at ordering.

---
*Phase: 06-notification-orchestration*
*Completed: 2026-07-20*

---
phase: 06-notification-orchestration
plan: 09
subsystem: mobile
tags: [notifications, inbox, unread-badge, push-preferences, quiet-hours, settings]

# Dependency graph
requires:
  - phase: 06-notification-orchestration
    provides: GET /api/member/notifications + POST mark-read (06-08)
  - phase: 06-notification-orchestration
    provides: resolveNotificationRoute deep-link map (06-01)
provides:
  - Notification inbox screen at /notifications (newest-first, unread styling, tap-to-read+nav)
  - useUnreadNotifications hook + markInboxViewed() for bell badge
  - Bell rewired from /coach-notes to /notifications with unread count badge
  - Per-category push toggles (7) + quiet hours UI in settings
affects:
  - 06-10-e2e-verification (consumes inbox screen + badge)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Module-listener pattern for multi-instance badge reset (mirrors useUnreadFeedCount)
    - Cursor-based pagination via onEndReached + next_cursor ref
    - Optimistic mark-read with rollback-on-error (mirrors handleToggleNotifications)
    - Alert-based hour picker for time selection (no new deps)
    - as-any cast for router.push('/notifications') — typed-routes stale (Expo convention)

key-files:
  created:
    - apps/mobile/src/lib/notificationInboxService.ts
    - apps/mobile/src/lib/__tests__/notificationInboxService.test.ts
    - apps/mobile/src/hooks/useUnreadNotifications.ts
    - apps/mobile/app/notifications/index.tsx
  modified:
    - apps/mobile/app/_layout.tsx
    - apps/mobile/app/(tabs)/_layout.tsx
    - apps/mobile/app/settings.tsx

key-decisions:
  - "useUnreadNotifications: no Realtime subscription — notifications table not in realtime publication; poll-on-focus sufficient for v1"
  - "markInboxViewed() zeroes badge immediately via module listener; server is truth on next refresh"
  - "Quiet hours time picker uses Alert (no new deps) with 2-hour increments; times stored as HH:MM:SS UTC"
  - "router.push('/notifications' as any) — Expo typed-routes stale, as-any cast consistent with prior OverviewTab/ProfileHeader precedent"
  - "Category section dimmed via opacity:0.5 when global Off — disabled prop on TouchableOpacity prevents taps"

requirements-completed: [NOTIF-04, NOTIF-05]

# Metrics
duration: 12min
completed: 2026-07-20
---

# Phase 6 Plan 09: Mobile Inbox + Notification Preferences Summary

**Notification inbox screen (FlatList, unread styling, tap-to-read, cursor pagination), bell rewired with useUnreadNotifications badge, per-category push toggles (7) + quiet hours UI in settings — consuming the 06-08 API**

## Performance

- **Duration:** 12 min
- **Started:** 2026-07-20T14:05:42Z
- **Completed:** 2026-07-20T14:17:44Z
- **Tasks:** 3 (Task 1 TDD, Tasks 2-3 auto)
- **Files modified:** 7

## Accomplishments

- `notificationInboxService.ts`: `fetchInbox(cursor?)` returns `InboxResult | null`; `markRead(id)` returns `boolean`; both use `getSession()` Bearer JWT + `getMemberId()`; all errors return null/false, never throw
- `useUnreadNotifications.ts`: unread count from `fetchInbox().unread_count` on mount/refresh; `markInboxViewed()` zeroes all mounted badge instances via module-level listener (mirrors `useUnreadFeedCount`); no Realtime (table not in publication — poll-on-focus for v1)
- `app/notifications/index.tsx`: FlatList inbox; newest-first; unread rows = crimson left-border accent + `colors.text` title (vs `colors.textSecondary` for read); tap = optimistic flip + `markRead` + `markInboxViewed` + `resolveNotificationRoute` deep-link; cursor pagination via `next_cursor` ref + `onEndReached`; pull-to-refresh; skeleton (5 rows); empty state "No notifications yet — go crush a workout!"; a11y labels on all rows; zero hardcoded hex
- `app/_layout.tsx`: Stack.Screen for `notifications/index` registered
- `app/(tabs)/_layout.tsx`: bell `onPress` changed from `/coach-notes` to `/notifications`; `useUnreadNotifications` badge shown (numeric, `99+` cap) with a11y label announcing count; badge visual matches feed tab badge pattern
- `app/settings.tsx`: Extended notification prefs fetch to select all 10 columns; Activity group (push_prs, push_achievements, push_level_up, push_challenge_rank), Coaching group (push_trainer_note, push_new_program), Social group (push_gym_feed); category section dimmed when global Off; Quiet hours: enable toggle + Alert-based start/end hour picker (2-hr steps, UTC note "Quiet hours use UTC for now"); all 7 toggles + quiet hours upsert optimistically with rollback-on-error
- 17 new tests (Task 1 TDD); 258 total mobile tests pass (was 241)

## Task Commits

1. **Task 1 RED: failing tests** — `6ccd347` (test)
2. **Task 1 GREEN: service + hook** — `313f938` (feat)
3. **Task 2: inbox screen + bell rewire** — `4249ec7` (feat)
4. **Task 3: notification preferences UI** — `d9d577e` (feat)

## Files Created/Modified

- `apps/mobile/src/lib/notificationInboxService.ts` — fetchInbox + markRead, Bearer JWT, getMemberId, null-on-error convention
- `apps/mobile/src/lib/__tests__/notificationInboxService.test.ts` — 17 tests: auth guard, member-id guard, query params, cursor, 4xx/5xx/network null, markRead success/failure
- `apps/mobile/src/hooks/useUnreadNotifications.ts` — unread count hook + markInboxViewed() module listener
- `apps/mobile/app/notifications/index.tsx` — Inbox screen: FlatList, unread styling, optimistic tap-mark-read, deep-link, pagination, pull-to-refresh, skeleton, empty state
- `apps/mobile/app/_layout.tsx` — Stack.Screen notifications/index registered
- `apps/mobile/app/(tabs)/_layout.tsx` — Bell rewired to /notifications with unread badge
- `apps/mobile/app/settings.tsx` — 7 push-category toggles + quiet hours UI

## Decisions Made

- `useUnreadNotifications` has no Realtime subscription — `notifications` table is not in the Supabase realtime publication. Poll-on-focus is sufficient for v1; a comment documents this for future reference.
- `markInboxViewed()` uses the module-listener pattern (same as `markFeedViewed`) — zero state is immediate, server truth restored on next refresh. No AsyncStorage needed.
- Quiet hours time picker uses `Alert.alert` with action buttons (no new packages). 2-hour increments keep the list short. "Quiet hours use UTC for now" note satisfies Pitfall 7 documentation requirement.
- Bell `router.push('/notifications' as any)` — Expo typed-routes are stale (`.expo/types` gitignored). `as any` cast consistent with `OverviewTab.tsx`, `ProfileHeader.tsx` precedents noted in STATE.md.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] TextColor type does not include 'textMuted'**
- **Found during:** Task 2 (tsc check)
- **Issue:** `Text` component's `TextColor` union has 5 values: `default | textSecondary | error | white | primary`. `'textMuted'` is not included.
- **Fix:** Used `style={{ color: colors.textMuted }}` inline for the timestamp and "Loading more..." text instead of the `color` prop.
- **Files modified:** `app/notifications/index.tsx`
- **Commit:** `4249ec7` (inline with Task 2)

**2. [Rule 1 - Bug] accessibilityElementsHidden on custom Text component**
- **Found during:** Task 2 (tsc check)
- **Issue:** Custom `Text` component's `TextProps` interface doesn't expose `accessibilityElementsHidden`.
- **Fix:** Wrapped the emoji icon in a `<View accessibilityElementsHidden>` instead.
- **Files modified:** `app/notifications/index.tsx`
- **Commit:** `4249ec7` (inline with Task 2)

---

**Total deviations:** 2 auto-fixed (Rule 1 - type mismatches in custom component)
**Impact on plan:** Cosmetic fixes only — no behavior change, no scope creep.

## Self-Check: PASSED

- `apps/mobile/src/lib/notificationInboxService.ts` — FOUND
- `apps/mobile/src/lib/__tests__/notificationInboxService.test.ts` — FOUND
- `apps/mobile/src/hooks/useUnreadNotifications.ts` — FOUND
- `apps/mobile/app/notifications/index.tsx` — FOUND
- Commit `6ccd347` (test RED) — FOUND
- Commit `313f938` (feat GREEN) — FOUND
- Commit `4249ec7` (Task 2) — FOUND
- Commit `d9d577e` (Task 3) — FOUND

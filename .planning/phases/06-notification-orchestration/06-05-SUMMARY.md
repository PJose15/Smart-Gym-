---
phase: 06-notification-orchestration
plan: 05
subsystem: api
tags: [typescript, push-notifications, coalescer, tdd, session-complete, challenges]

# Dependency graph
requires:
  - "06-01 (NotificationType union)"
  - "06-03 (sendNotification dispatcher)"
provides:
  - "pickSessionPushEvent() — pure coalescer (no I/O), priority: level_up > badge_unlocked > pr_achieved > streak_milestone > streak_broken > null"
  - "sendSessionCompletePush() — fire-and-forget wrapper over coalescer + dispatcher"
  - "challenge_rank_change dispatch on top-3 entry in challengeScoring"
  - "challenge_complete dispatch per participant on owner challenge completion"
affects:
  - "session-complete route: single coalesced push call after achievements/streak"
  - "challengeScoring: rank-change push added to per-challenge re-ranking loop"
  - "challenges/[challengeId]/complete route: participant push loop after deactivation"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure coalescer (no I/O): pickSessionPushEvent takes {leveledUp, badgesUnlocked, isPersonalBest, streak, previousStreak} → one event or null"
    - "STREAK_MILESTONES = Set{7,14,30,50,100} — O(1) milestone check"
    - "Barrage prevention: single sendSessionCompletePush call in route; coalescer is structural guard; dispatcher 5-min dedup + 10/hr cap are backstops"
    - "challenge_rank_change: reads current_rank before update; dispatches only when oldRank null/undefined/>3 AND newRank<=3"
    - "challenge_complete: sequential loop over participants; dispatcher per-member dedup handles cron overlap from 06-07"
    - "All push bodies PII-free: no names, weights, exercise names"

key-files:
  created:
    - "apps/web-admin/src/lib/notifications/sessionPush.ts"
    - "apps/web-admin/src/lib/notifications/__tests__/sessionPush.test.ts"
    - "apps/web-admin/src/app/api/sessions/[sessionId]/complete/__tests__/complete-push.test.ts"
  modified:
    - "apps/web-admin/src/app/api/sessions/[sessionId]/complete/route.ts"
    - "apps/web-admin/src/lib/challengeScoring.ts"
    - "apps/web-admin/src/app/api/challenges/[challengeId]/complete/route.ts"

key-decisions:
  - "pickSessionPushEvent is pure (no I/O) — enables deterministic testing without mocking dispatcher"
  - "sendSessionCompletePush is the only push call site in session-complete route — no per-event calls, coalescer is the barrage guard"
  - "challenge_rank_change oldRank null/undefined treated as >3 (effectively unranked) — first scorer into top 3 gets the push"
  - "challenge_complete sequential loop is acceptable at launch scale; dispatcher's per-member dedup absorbs cron auto-expiry overlap (plan 06-07)"

requirements-completed: [NOTIF-02]

# Metrics
duration: ~12min
completed: 2026-07-20
---

# Phase 6 Plan 05: Session-Complete + Challenge Push Triggers Summary

**Pure session-event coalescer (barrage prevention) + challenge_rank_change (top-3 entry) + challenge_complete (owner completion) — 22 sessionPush tests + 7 complete-push integration tests, tsc clean**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-07-20T14:04:26Z
- **Completed:** 2026-07-20T14:16:15Z
- **Tasks:** 3 (Task 1: TDD RED+GREEN coalescer; Task 2: TDD RED+GREEN route integration; Task 3: challenge triggers)
- **Files created:** 3
- **Files modified:** 3

## Accomplishments

- Implemented `pickSessionPushEvent()` as a pure function with total priority ordering:
  `level_up > badge_unlocked > pr_achieved > streak_milestone ({7,14,30,50,100}) > streak_broken (previousStreak>1 && streak===1) > null`
- `sendSessionCompletePush()` fire-and-forget wrapper calls dispatcher once (or zero times) per session
- Wired `session-complete` route: single `sendSessionCompletePush` call after achievements/streak block; dispatcher 5-min dedup and 10/hr cap are backstops
- `challengeScoring.updateChallengeScores`: reads `current_rank` before update, dispatches `challenge_rank_change` (title: 'Leaderboard update', body: 'You moved into the top 3 of a challenge') fire-and-forget when member enters top 3 from outside
- `challenges/[challengeId]/complete` route: fetches all participants after deactivation, dispatches `challenge_complete` per participant fire-and-forget; dispatcher 5-min dedup absorbs overlap when cron auto-expiry (06-07) also fires
- All push bodies PII-free (no names, weights, exercise names per lock-screen rule)
- Existing `complete-agents` suite (10 tests) remains green unchanged

## Task Commits

1. **Task 1 RED: Failing sessionPush test suite** - `5b28cf5` (test)
2. **Task 1 GREEN: Implement sessionPush coalescer** - `16159b4` (feat)
3. **Task 2: Wire session-complete route + complete-push tests** - `8c3d0bc` (feat)
4. **Task 3: Challenge triggers** - `eb6d18d` (feat)

## Files Created/Modified

- `apps/web-admin/src/lib/notifications/sessionPush.ts` — 126 lines: `pickSessionPushEvent` pure coalescer, `sendSessionCompletePush` wrapper
- `apps/web-admin/src/lib/notifications/__tests__/sessionPush.test.ts` — 297 lines: 22 tests (priority ordering, milestone edge cases, PII-free bodies, wrapper fire-and-forget)
- `apps/web-admin/src/app/api/sessions/[sessionId]/complete/__tests__/complete-push.test.ts` — 337 lines: 7 integration tests (1 call for level_up, 0 calls for plain session, barrage prevention, route resilience)
- `apps/web-admin/src/app/api/sessions/[sessionId]/complete/route.ts` — Added `sendSessionCompletePush` import + single fire-and-forget call
- `apps/web-admin/src/lib/challengeScoring.ts` — Added `sendNotification` import, `current_rank` to participation select, `challenge_rank_change` dispatch block
- `apps/web-admin/src/app/api/challenges/[challengeId]/complete/route.ts` — Added `sendNotification` import + participant fetch + `challenge_complete` dispatch loop

## Decisions Made

- `pickSessionPushEvent` is pure (no I/O) — enables deterministic unit testing without mocking dispatcher; `sendSessionCompletePush` is the thin async wrapper
- Only one `sendSessionCompletePush` call site in the session route — coalescer is structural barrage prevention, not just documentation
- `challenge_rank_change` treats `current_rank` null/undefined as "unranked" (>3) so a member's first score that places them in top 3 triggers the push
- `challenge_complete` uses a sequential loop at launch scale; dispatcher's 5-min (member, type) dedup is the cron overlap guard (no additional logic needed)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test type mismatch in complete-push test (newAchievements)**
- **Found during:** Task 3 (tsc --noEmit)
- **Issue:** `newAchievements: ['badge-1']` in the barrage-prevention test used a string where `AchievementResult['newAchievements']` requires `{ code: string; title: string; points: number }[]`
- **Fix:** Changed to `[{ code: 'badge-1', title: 'First Badge', points: 100 }]`
- **Files modified:** `complete-push.test.ts`
- **Commit:** included in `8c3d0bc` (re-committed with fix in `eb6d18d`)

---

**Total deviations:** 1 auto-fixed (minor type correction in test)
**Impact on plan:** None — implementation guard logic and public API exactly match spec.

## Out-of-Scope Pre-existing Issues

- `ProgressPage.test.tsx` — 2 failing tests in working tree (pre-existing modified file, not caused by this plan). Logged to deferred items.
- Worker process force-exit warning in complete test suite — pre-existing from DayCompleteRitual async timer, not from this plan.

## Self-Check: PASSED

- FOUND: `apps/web-admin/src/lib/notifications/sessionPush.ts`
- FOUND: `apps/web-admin/src/lib/notifications/__tests__/sessionPush.test.ts`
- FOUND: `apps/web-admin/src/app/api/sessions/[sessionId]/complete/__tests__/complete-push.test.ts`
- FOUND: commit `5b28cf5` (test RED)
- FOUND: commit `16159b4` (feat GREEN coalescer)
- FOUND: commit `8c3d0bc` (feat route wire + complete-push tests)
- FOUND: commit `eb6d18d` (feat challenge triggers)

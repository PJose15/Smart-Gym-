---
phase: 05-uptimizeai-agent-connection
plan: 03
subsystem: api
tags: [agents, session-complete, challenge-complete, level-up, streak-broken, leaderboard-updated, challenge-ended, tdd]

# Dependency graph
requires:
  - phase: 05-uptimizeai-agent-connection
    provides: "Hardened trigger route with cooldown dedup (05-02)"
provides:
  - "3 engagement-agent call sites in session-complete: level-up, streak-broken, leaderboard-updated"
  - "1 growth-agent call site in challenge-complete: challenge-ended with dedup_key"
  - "TDD coverage for all 4 call sites including streak-broken edge cases (9+6=15 tests)"
affects: [05-04, 05-05, 05-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "previousStreak capture before member update: read current_streak from DB before overwriting"
    - "streak-broken condition: previousStreak > 1 && streak === 1 (never fires for first-ever sessions)"
    - "dedup_key = challengeId: cross-path deduplication when both owner-complete and cron-expiry fire"
    - "TDD RED-first: failing test committed before implementation (two separate RED commits)"

key-files:
  created:
    - apps/web-admin/src/app/api/sessions/[sessionId]/complete/__tests__/complete-agents.test.ts
    - apps/web-admin/src/app/api/challenges/[challengeId]/complete/__tests__/complete.test.ts
  modified:
    - apps/web-admin/src/app/api/sessions/[sessionId]/complete/route.ts
    - apps/web-admin/src/app/api/challenges/[challengeId]/complete/route.ts

key-decisions:
  - "previousStreak captured from current_streak column BEFORE the members UPDATE runs — fetching after would always return the new value"
  - "streak-broken condition is previousStreak > 1 && streak === 1: never fires for first-ever sessions where previousStreak=0; never fires for continuing streaks"
  - "leaderboard-updated fires unconditionally after updateChallengeScores — cooldown in trigger route caps flooding; rank-aware firing is Phase 6+ enhancement"
  - "dedup_key = challengeId on challenge-ended: prevents double-fire when owner-complete and cron-expiry both run; dedup_key lookup in trigger route guarantees once-per-challenge"
  - "challenge-ended does NOT fire on 404 path (challenge not found or already inactive)"

# Metrics
duration: 64min
completed: 2026-07-20
---

# Phase 05 Plan 03: Session + Challenge Agent Wiring Summary

**3 engagement-agent call sites (level-up, streak-broken, leaderboard-updated) + 1 growth-agent call site (challenge-ended) wired fire-and-forget via deduped trigger route**

## Performance

- **Duration:** 64 min
- **Started:** 2026-07-20T03:40:24Z
- **Completed:** 2026-07-20T04:45:12Z
- **Tasks:** 2 (both TDD RED-then-GREEN)
- **Files modified:** 4 (2 routes + 2 test files)

## Accomplishments

- `sessions/[sessionId]/complete/route.ts` hardened with 3 agent call sites:
  - `engagement-agent` `level-up` when `achievements.leveledUp === true`
  - `engagement-agent` `streak-broken` when `previousStreak > 1 && streak === 1`
  - `engagement-agent` `leaderboard-updated` unconditionally after every session complete
- `challenges/[challengeId]/complete/route.ts` hardened with 1 agent call site:
  - `growth-agent` `challenge-ended` after deactivation, `dedup_key = challengeId`
- All 4 call sites: fire-and-forget (no `await`), `.catch(console.error)`, `is_agent_initiated: false`
- 15 new tests: 9 session-complete + 6 challenge-complete
- Full suite: 426/426 green, tsc clean

## Task Commits

Each task was committed atomically (TDD: RED then GREEN):

1. **Task 1 RED: Failing tests for session-complete** - `ada5fff` — 9 tests, 3 failing
2. **Task 1 GREEN: Session-complete wiring** - `599bcba` — 9/9 green, route + test file
3. **Task 2 RED: Failing tests for challenge-complete** - `06a9aed` — 6 tests, 2 failing
4. **Task 2 GREEN: Challenge-complete wiring** - `f7e3972` — 6/6 green, route + test file

## Files Created/Modified

- `apps/web-admin/src/app/api/sessions/[sessionId]/complete/route.ts` — Added `current_streak` to SELECT, `previousStreak` capture, 3 fire-and-forget agent calls
- `apps/web-admin/src/app/api/sessions/[sessionId]/complete/__tests__/complete-agents.test.ts` — 9 tests covering all 3 call sites + streak-broken edge cases + response contract + fire-and-forget rejection safety
- `apps/web-admin/src/app/api/challenges/[challengeId]/complete/route.ts` — Added import + growth-agent call with dedup_key after deactivation
- `apps/web-admin/src/app/api/challenges/[challengeId]/complete/__tests__/complete.test.ts` — 6 tests covering challenge-ended payload, 404 paths, no-winner case, response contract

## Decisions Made

- **previousStreak capture timing:** `current_streak` is read from the DB SELECT that runs before the `members.update()`. Capturing after the update would always return the new streak value — making streak-broken detection impossible.
- **streak-broken exact condition:** `previousStreak > 1 && streak === 1`. This is the only condition that represents a genuine streak break. `previousStreak === 0` means a first-ever session (no streak to break). `streak > 1` means the streak is continuing or growing. The `> 1` boundary ensures we never fire on a member who had only 1 session before.
- **leaderboard-updated unconditional:** Open Question 2 from RESEARCH.md resolved — fire after every session complete. The 24h/member cooldown in the trigger route (plan 05-02) caps flooding without requiring rank-change data from `challengeScoring.ts`.
- **dedup_key = challengeId for challenge-ended:** Both the owner-complete route (plan 05-03) and the cron auto-expiry path (plan 05-05) will fire `challenge-ended`. The `dedup_key` + 24h window in the trigger route ensures only the first fire goes through — satisfying Pitfall 6 documented in RESEARCH.md.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test UUID validation failure**
- **Found during:** Task 1 (RED run): mock member_id `'member-uuid-111'` failed `z.string().uuid()` in `completeSchema.safeParse` → route returned 400 instead of 200
- **Issue:** Test constants used non-UUID strings; the route validates `member_id` format via Zod before proceeding
- **Fix:** Replaced all test constants with valid UUIDs (`a1b2c3d4-e5f6-7890-abcd-ef1234567890` pattern)
- **Files modified:** `complete-agents.test.ts`
- **Verification:** Tests went from `Expected: 200, Received: 400` to correct RED state (3 failing on missing agent calls)
- **Committed in:** `ada5fff` (RED commit, refined before merge)

**2. [Rule 1 - Bug] TypeScript errors in test mocks**
- **Found during:** Task 1 (tsc check): `VerifyResult` requires `member_id` field; `newLevel` type requires `{ level, name, color }` not just `{ level }`
- **Issue:** Mock `verifyMember` return missing `member_id`; mock `newLevel` missing `name` and `color` fields
- **Fix:** Added `member_id: MEMBER_ID` to all `mockVerifyMember.mockResolvedValue()` calls; added `name` + `color` to all `newLevel` mock objects; used `as unknown as` cast for type-incompatible mock shapes
- **Files modified:** `complete-agents.test.ts`
- **Verification:** tsc --noEmit exits 0
- **Committed in:** `599bcba` (GREEN commit)

---

**Total deviations:** 2 auto-fixed (Rule 1 — test correctness bugs)
**Impact on plan:** Both fixes were in test code only. Production route implementations match plan exactly.

## Issues Encountered

None in production code. Two test-side type/validation fixes described above.

## User Setup Required

None.

## Next Phase Readiness

- Plans 05-01 through 05-03 complete: foundation (dedup + forwarding) + 4 event-driven call sites wired
- Remaining AGENT-03 call sites: `at-risk` per-member wiring (already built in at-risk route per plan 05-02 via separate commit), `upgrade-opportunity` (feature gate), `new-gym-onboarded` (onboard/register route)
- Plan 05-04 can begin: `agent-daily` cron route (dormant-members, machine-underutilization, checkin-SLA-overdue, challenge auto-expiry)

## Self-Check: PASSED

- `complete-agents.test.ts`: FOUND at `apps/web-admin/src/app/api/sessions/[sessionId]/complete/__tests__/complete-agents.test.ts`
- `complete.test.ts`: FOUND at `apps/web-admin/src/app/api/challenges/[challengeId]/complete/__tests__/complete.test.ts`
- `sessions complete route.ts`: FOUND (updated with 3 call sites)
- `challenges complete route.ts`: FOUND (updated with growth-agent call)
- Commit `ada5fff` (Task 1 RED): FOUND
- Commit `599bcba` (Task 1 GREEN): FOUND
- Commit `06a9aed` (Task 2 RED): FOUND
- Commit `f7e3972` (Task 2 GREEN): FOUND
- 426/426 tests: PASSED
- tsc --noEmit: CLEAN
- No `await triggerUptimizeAIAgent` in either route: CONFIRMED

---
*Phase: 05-uptimizeai-agent-connection*
*Completed: 2026-07-20*

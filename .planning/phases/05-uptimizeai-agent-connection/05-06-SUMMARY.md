---
phase: 05-uptimizeai-agent-connection
plan: 06
subsystem: api
tags: [agents, retention, operations, cron, weekly, at-risk, shared-helper, tdd]

# Dependency graph
requires:
  - phase: 05-uptimizeai-agent-connection
    provides: "Migration 029 (pg_cron agent-weekly schedule), trigger route with cooldown dedup from 05-02"
provides:
  - "fetchGymAtRiskMembers(admin, gymId) shared scan helper — single source of truth for both route and cron"
  - "owner at-risk route fires retention-agent 'member-at-risk' per at-risk member with member_id set (Pitfall 4)"
  - "agent-weekly cron fires operations-agent 'weekly-summary' per active gym + retention-agent early-warning per at-risk member"
  - "Zero-member gym suppression for weekly-summary"
  - "7-day dedup (cooldown in trigger route) absorbs repeated owner-route visits and cron-vs-route double fires"
affects: [06-notification-orchestration-wiring]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Shared scan helper pattern: extract DB logic + computeAtRiskMembers call to lib/agents/atRiskScan.ts — used by both owner route and weekly cron"
    - "Fire-and-forget per-member agent trigger with .catch(console.error) in owner route"
    - "Batched Promise.allSettled per gym in weekly cron — one gym failure never aborts others"
    - "Head count query: .select('id', { head: true, count: 'exact' }) for scalar counts without row data"
    - "TDD RED-first: two RED commits before GREEN implementations"

key-files:
  created:
    - apps/web-admin/src/lib/agents/atRiskScan.ts
    - apps/web-admin/src/lib/agents/__tests__/atRiskScan.test.ts
    - apps/web-admin/src/app/api/cron/agent-weekly/route.ts
    - apps/web-admin/src/app/api/cron/agent-weekly/__tests__/agent-weekly.test.ts
    - apps/web-admin/src/app/api/owner/at-risk/__tests__/at-risk.test.ts
  modified:
    - apps/web-admin/src/app/api/owner/at-risk/route.ts

key-decisions:
  - "Single shared helper (atRiskScan.ts) for at-risk detection: eliminates logic duplication between owner route and weekly cron"
  - "Per-member trigger in owner route: forEach + fire-and-forget; response returns AtRiskMember[] unchanged"
  - "Zero-member gym suppression: activeMembers === 0 → skip gym entirely (no weekly-summary, no at-risk scan)"
  - "7-day cooldown in trigger route absorbs both owner-visit fires and weekly cron early-warning fires — idempotent by design"
  - "gyms_scanned counter tracks gyms with active members (not total gym count)"

requirements-completed: [AGENT-03, AGENT-04]

# Metrics
duration: 28min
completed: 2026-07-20
---

# Phase 05 Plan 06: At-Risk Retention + Weekly Cron Summary

**Shared atRiskScan helper + owner at-risk route per-member retention triggers + agent-weekly cron (weekly-summary + at-risk early-warning scans)**

## Performance

- **Duration:** 28 min
- **Started:** 2026-07-20T03:40:00Z
- **Completed:** 2026-07-20T04:08:00Z
- **Tasks:** 2 (both TDD — RED then GREEN)
- **Files created:** 5
- **Files modified:** 1

## Accomplishments

- `lib/agents/atRiskScan.ts`: `fetchGymAtRiskMembers(admin, gymId)` — moves the members+sessions DB queries and `computeAtRiskMembers` call out of the route into a single shared module; 30-day session window bounds query; both the owner route and the weekly cron import from here
- `owner/at-risk/route.ts` rewired: calls shared helper, then `forEach` fires `retention-agent` `member-at-risk` per at-risk member (fire-and-forget + `.catch(console.error)`); `member_id = m.profileId` always set (Pitfall 4 — never null); response body unchanged (AtRiskMember[] contract preserved)
- `cron/agent-weekly/route.ts`: dual-header auth (x-smartgym-internal-key OR Authorization Bearer); fetches non-cancelled gyms; per gym — counts active members (skip if 0), counts sessions_7d, fires `operations-agent` `weekly-summary`; then calls `fetchGymAtRiskMembers` + fires `retention-agent` `member-at-risk` per result; processes gyms in batches of 10 via `Promise.allSettled`; returns `{ summaries_triggered, at_risk_triggered, gyms_scanned }`
- 15 new tests (6 Task 1 + 9 Task 2) — full suite 420/420 green; tsc clean

## Task Commits

Each task was committed atomically (TDD: RED then GREEN):

1. **Task 1 RED: Failing tests** - `4395da6` — atRiskScan.test.ts (2 tests) + at-risk.test.ts (4 tests), all failing (modules missing)
2. **Task 1 GREEN: Implementation** - `f90ec76` — atRiskScan.ts (new), at-risk/route.ts (rewired), both test files (tsc fixes); 6 pass
3. **Task 2 RED: Failing tests** - `d6ac3be` — agent-weekly.test.ts (9 tests), all failing (route missing)
4. **Task 2 GREEN: Implementation** - `90e847e` — agent-weekly/route.ts (new) + test file; 9 pass; full suite 420/420

## Files Created/Modified

- `apps/web-admin/src/lib/agents/atRiskScan.ts` — Shared helper: fetchGymAtRiskMembers, 30-day session window, computeAtRiskMembers
- `apps/web-admin/src/lib/agents/__tests__/atRiskScan.test.ts` — 2 tests: at-risk only returns / empty gym returns []
- `apps/web-admin/src/app/api/owner/at-risk/route.ts` — Rewired to use shared helper; per-member agent fires; response contract unchanged
- `apps/web-admin/src/app/api/owner/at-risk/__tests__/at-risk.test.ts` — 4 tests: per-member fires (never null member_id), 0-risk skips, unchanged response, trigger rejection resilience
- `apps/web-admin/src/app/api/cron/agent-weekly/route.ts` — Weekly cron: auth, gym loop, zero-member suppression, weekly-summary, at-risk early-warning
- `apps/web-admin/src/app/api/cron/agent-weekly/__tests__/agent-weekly.test.ts` — 9 tests: auth (4), weekly-summary (2), at-risk (1), counters (1), allSettled resilience (1)

## Decisions Made

- **Shared helper pattern:** Both the owner route and the weekly cron need the same DB queries + `computeAtRiskMembers` call. Extracting to `lib/agents/atRiskScan.ts` ensures a single source of truth and makes the "one shared module" plan requirement concrete.
- **Per-member fire-and-forget in owner route:** `forEach` + `.catch(console.error)` — response returns immediately with the scan results; agent fires are idempotent via 7-day cooldown.
- **Zero-member gym suppression:** `activeMembers === 0` → skip `sessions_7d` query + `weekly-summary` fire + at-risk scan entirely. Empty gyms generate no actionable insights.
- **gyms_scanned tracks active gyms only:** Counts only gyms that passed the `activeMembers > 0` check, giving the operator a useful metric of gyms actually processed.
- **7-day cooldown dedup is sufficient:** The trigger route's per-(gym, agent, event, member) 7-day window absorbs both owner-dashboard visits and the weekly cron scan — no additional dedup logic needed at the call sites.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] next/server mock required in at-risk.test.ts**
- **Found during:** Task 1 GREEN run — `ReferenceError: Request is not defined`
- **Issue:** jsdom test environment does not define `Request`/`Response` globals that `next/server` requires at import time. The route imports `NextResponse` from `next/server`, which crashes when the test module loads it.
- **Fix:** Added `jest.mock('next/server', ...)` factory (same pattern as `onboarding-status.test.ts` in the codebase) before other imports so babel-jest hoisting intercepts the `next/server` import before the crash.
- **Files modified:** `apps/web-admin/src/app/api/owner/at-risk/__tests__/at-risk.test.ts`
- **Committed in:** `f90ec76`

**2. [Rule 1 - Bug] TypeScript `as` cast required for mock SupabaseClient in test files**
- **Found during:** Task 1 tsc check — `TS2352: Conversion of type '{ from: Mock... }' to 'SupabaseClient'`
- **Issue:** The mock admin object literal doesn't overlap sufficiently with `SupabaseClient` type for a single `as` cast.
- **Fix:** Used `as unknown as SupabaseClient` double-cast (standard pattern for partial test mocks).
- **Files modified:** `atRiskScan.test.ts` (2 cast sites), `at-risk.test.ts` (1 cast site with `as unknown as Awaited<...>`)
- **Committed in:** `f90ec76`

---

**Total deviations:** 2 auto-fixed (both Rule 1 — bugs in test code patterns)
**Impact on plan:** Both fixes were in test files only. Production implementation matches plan exactly.

## Issues Encountered

Pre-existing: `complete-agents.test.ts` (untracked, from plan 05-03 RED commit) was already failing before this plan. Confirmed by `git stash` check — those failures pre-date plan 05-06 entirely. Out of scope per SCOPE BOUNDARY rule.

## Next Phase Readiness

- AGENT-03 complete: owner at-risk dashboard fires retention-agent per member (not once per page load)
- AGENT-04 weekly early-warning complete: cron scans every active gym for at-risk members weekly
- AGENT-04 weekly-summary complete: operations-agent fired per active gym with member + session counts
- The 7-day cooldown window makes owner-route fires and cron early-warning fires idempotent across the same member within any rolling 7-day window
- Plan 05-07 (final Wave 2 wiring) can begin immediately

## Self-Check: PASSED

- `atRiskScan.ts`: FOUND
- `atRiskScan.test.ts`: FOUND
- `owner/at-risk/route.ts`: FOUND (updated)
- `owner/at-risk/__tests__/at-risk.test.ts`: FOUND
- `cron/agent-weekly/route.ts`: FOUND
- `cron/agent-weekly/__tests__/agent-weekly.test.ts`: FOUND
- Commit `4395da6` (Task 1 RED): FOUND
- Commit `f90ec76` (Task 1 GREEN): FOUND
- Commit `d6ac3be` (Task 2 RED): FOUND
- Commit `90e847e` (Task 2 GREEN): FOUND
- Both routes import fetchGymAtRiskMembers: CONFIRMED (grep shows 4 import sites)
- 420/420 tests: PASSED
- tsc --noEmit exit 0: CLEAN

---
*Phase: 05-uptimizeai-agent-connection*
*Completed: 2026-07-20*

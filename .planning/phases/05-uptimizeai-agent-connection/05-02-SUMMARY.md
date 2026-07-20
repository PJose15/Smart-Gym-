---
phase: 05-uptimizeai-agent-connection
plan: 02
subsystem: api
tags: [agents, webhook, cooldown, dedup, uptimize, loop-safety, zod]

# Dependency graph
requires:
  - phase: 05-uptimizeai-agent-connection
    provides: "Migration 029 (dedup index on smartgym_agent_logs), echo receiver, env vars contract from plan 05-01"
provides:
  - "Hardened /api/agents/trigger: cooldown dedup per (gym, agent, event[, member][, dedup_key])"
  - "UPTIMIZE_WEBHOOK_URL fire-and-forget forwarding with failure recording (status=failed)"
  - "is_agent_initiated + dedup_key in trigger payload schema (Phase 6 loop-safety contract)"
  - "PLATFORM_EVENTS tier-bypass: new-gym-onboarded + upgrade-opportunity bypass checkAgentAccess"
  - "Pure cooldown.ts module with COOLDOWN_MINUTES map + getCooldownWindowStart + isPlatformEvent"
affects: [05-03, 05-04, 05-05, 05-06, 06-notification-orchestration-wiring]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Adjacent cooldown.ts module: route files export only HTTP handlers; pure functions extracted to sibling modules"
    - "any-typed dynamic Supabase query chain for conditional .eq()/.is() filter building"
    - "Fire-and-forget fetch with AbortSignal.timeout(10_000) + .catch() failure recording pattern"
    - "TDD RED-first: test file committed before implementation"

key-files:
  created:
    - apps/web-admin/src/app/api/agents/trigger/cooldown.ts
    - apps/web-admin/src/app/api/agents/trigger/__tests__/trigger.test.ts
  modified:
    - apps/web-admin/src/app/api/agents/trigger/route.ts

key-decisions:
  - "PLATFORM_EVENTS bypass checkAgentAccess: new-gym-onboarded + upgrade-opportunity fire for gyms that by definition lack required tier; strictly tier-gating them produces dead code"
  - "Cooldown keyed by trigger_event (not by agent_name): each event type has distinct semantic meaning and different acceptable fire rates"
  - "UPTIMIZE_WEBHOOK_URL absent = no forwarding (staging-ready decision): forwarding is optional so local dev and plans without the env configured never break"
  - "Skipped rows do NOT extend the cooldown: only status=sent rows count as the window reference; a skipped fire leaves the window open for a legitimate retry"
  - "any-typed dedup query chain accepted: Supabase query builder types do not fully express conditional chaining; any is the idiomatic codebase pattern for dynamic filter building"

patterns-established:
  - "Pure module extraction: all non-HTTP logic extracted to cooldown.ts sibling; route.ts stays a thin HTTP handler"
  - "TDD RED-then-GREEN: failing test committed before implementation; GREEN test + impl committed together"

requirements-completed: [AGENT-01, AGENT-02]

# Metrics
duration: 22min
completed: 2026-07-19
---

# Phase 05 Plan 02: Trigger Route Hardening Summary

**Cooldown dedup per (gym, agent, event[, member][, dedup_key]) + UPTIMIZE fire-and-forget forwarding with failure recording + is_agent_initiated loop-safety schema + PLATFORM_EVENTS tier bypass**

## Performance

- **Duration:** 22 min
- **Started:** 2026-07-20T03:08:50Z
- **Completed:** 2026-07-20T03:30:00Z
- **Tasks:** 2 (both TDD — RED then GREEN)
- **Files modified:** 3

## Accomplishments

- `cooldown.ts` pure module: 14-event COOLDOWN_MINUTES map, PLATFORM_EVENTS, `getCooldownWindowStart` (deterministic with injectable `now`), `isPlatformEvent`
- `route.ts` hardened: tier-gating bypass for platform events, cooldown dedup (member-scoped, dedup_key-scoped), `status: 'sent'` insert now captures log id, UPTIMIZE fire-and-forget with AbortSignal.timeout(10_000) + `.catch()` failure recording to `status: 'failed'`
- `is_agent_initiated` + `dedup_key` accepted in payload schema — Phase 6 loop-safety contract established before any call site goes live
- 19 new tests covering all AGENT-01 + AGENT-02 behaviors; full suite 366/366 green; tsc clean

## Task Commits

Each task was committed atomically (TDD: RED then GREEN):

1. **Task 1+2 RED: Failing tests** - `c989fe4` (test) — trigger.test.ts with 19 tests all failing (cooldown.ts missing, route.ts without new logic)
2. **Task 1+2 GREEN: Implementation** - `d7aef9c` (feat) — cooldown.ts (new), route.ts (hardened), trigger.test.ts (mock chain fix + tsc fix); all 19 pass

## Files Created/Modified

- `apps/web-admin/src/app/api/agents/trigger/cooldown.ts` — Pure cooldown module: COOLDOWN_MINUTES, PLATFORM_EVENTS, getCooldownWindowStart, isPlatformEvent
- `apps/web-admin/src/app/api/agents/trigger/route.ts` — Hardened: platform bypass, cooldown dedup, log_id capture, UPTIMIZE forwarding + failure recording, is_agent_initiated + dedup_key schema
- `apps/web-admin/src/app/api/agents/trigger/__tests__/trigger.test.ts` — 19 tests: 7 pure cooldown, 7 dedup route, 4 forwarding (AGENT-01 + AGENT-02 full coverage)

## Decisions Made

- **PLATFORM_EVENTS bypass:** `new-gym-onboarded` and `upgrade-opportunity` bypass `checkAgentAccess` because they are platform-growth events about the gym, not services to members. Under strict tier gating both would be permanently dead code (new gyms are always starter; upgrade-opportunity fires on access denial).
- **Cooldown keyed by event:** Each trigger_event has its own semantic window (level-up=24h, member-at-risk=7d, weekly-summary=6d). Using agent_name as the key (as in the research Pattern 2) would conflate distinct events with different urgency profiles.
- **Skipped rows don't extend window:** Only `status='sent'` rows count for the dedup filter. A skipped fire (e.g. a race condition retry) leaves the original window open for the next legitimate trigger.
- **any-typed query chain:** Supabase's TypeScript types don't fully express conditional `.eq()/.is()` chaining after `.gte()`. Using `any` with an eslint-disable comment is the idiomatic codebase pattern (same as existing routes).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed mock chain structure in test file**
- **Found during:** Task 1 (GREEN run): `mockDedupIs` returned `{ limit }` only, missing `eq` for dedup_key chaining
- **Issue:** Tests for dedup_key-present case and is_agent_initiated case failed because after `.is('member_id', null)` the mock chain had no `.eq()` for the subsequent `payload->>dedup_key` filter
- **Fix:** Updated `mockDedupIs` to return `{ eq: mockDedupEq5, limit: mockDedupLimit }` so chaining after `.is()` works for both branches (dedup_key present or absent)
- **Files modified:** `apps/web-admin/src/app/api/agents/trigger/__tests__/trigger.test.ts`
- **Verification:** All 19 tests green
- **Committed in:** `d7aef9c`

**2. [Rule 1 - Bug] Fixed TypeScript error in test: Tuple type `[]` of length 0**
- **Found during:** Task 1 (tsc check): `mock.calls` typed as `[][]` (empty tuple), `.filter((c) => c[0]?.status)` error TS2493
- **Fix:** Cast `mock.calls` as `unknown as Array<[Record<string, unknown>]>` for the `sentCalls` filter line
- **Files modified:** `apps/web-admin/src/app/api/agents/trigger/__tests__/trigger.test.ts`
- **Verification:** tsc --noEmit produces no errors
- **Committed in:** `d7aef9c`

---

**Total deviations:** 2 auto-fixed (both Rule 1 — bugs in test code)
**Impact on plan:** Both fixes were in the test file mock chain, not in production code. No scope creep. Production implementation matches plan exactly.

## Issues Encountered

None in production code. Two test-mock fixes described above.

## User Setup Required

None — env vars (`UPTIMIZE_WEBHOOK_URL`, `UPTIMIZE_API_KEY`) were handled in plan 05-01.

## Next Phase Readiness

- Dedup guard is live at the chokepoint before any Wave 2 call sites land (AGENT-02 requirement satisfied)
- UPTIMIZE forwarding active — the echo receiver from 05-01 will receive forwarded calls when `UPTIMIZE_WEBHOOK_URL=http://localhost:3000/api/dev/agent-echo`
- `is_agent_initiated` in schema — Phase 6 dispatcher can read this flag immediately on any payload
- Plan 05-03 (session complete + challenge-ended + at-risk wiring) can begin immediately

## Self-Check: PASSED

- `cooldown.ts`: FOUND
- `route.ts`: FOUND (updated)
- `trigger.test.ts`: FOUND
- Commit `c989fe4` (RED): FOUND
- Commit `d7aef9c` (GREEN): FOUND
- 366/366 tests: PASSED
- tsc --noEmit: CLEAN

---
*Phase: 05-uptimizeai-agent-connection*
*Completed: 2026-07-19*

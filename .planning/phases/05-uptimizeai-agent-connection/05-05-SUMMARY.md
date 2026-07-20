---
phase: 05-uptimizeai-agent-connection
plan: 05
subsystem: api
tags: [agents, cron, retention, operations, growth, daily-scan, batch, tdd]

# Dependency graph
requires:
  - phase: 05-uptimizeai-agent-connection
    provides: "Migration 029 (dedup index on smartgym_agent_logs), from plan 05-01"
  - phase: 05-uptimizeai-agent-connection
    provides: "Hardened /api/agents/trigger with cooldown dedup + UPTIMIZE forwarding, from plan 05-02"
provides:
  - "/api/cron/agent-daily: 4 daily scans covering AGENT-04 scheduled automations #3/#10/#11/#12"
  - "Dormant member scan: retention-agent member-inactive-14d per member with 14-day DATE filter"
  - "Check-in SLA scan: operations-agent checkin-sla-overdue per pending check-in with dedup_key"
  - "Machine underutilization scan: operations-agent machine-underutilized for zero-scan machines in 7d"
  - "Challenge auto-expiry: gym_challenges deactivated + growth-agent challenge-ended (Pitfall 6 safety net)"
affects: [05-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Per-gym machine scan events query with in-memory Set diff for O(n) underutilization detection"
    - "Promise.allSettled batches of 10 for serverless timeout prevention (dna-recompute pattern)"
    - "DATE string comparison via .toISOString().slice(0,10) for end_date (DATE column, not timestamptz)"
    - "Challenge auto-expiry: update is_active=false then fire agent inside Promise.allSettled batch"
    - "Dual-header auth: x-smartgym-internal-key OR Authorization Bearer (pg_cron pattern)"
    - "TDD RED-first: test file committed before implementation"

key-files:
  created:
    - apps/web-admin/src/app/api/cron/agent-daily/route.ts
    - apps/web-admin/src/app/api/cron/agent-daily/__tests__/agent-daily.test.ts

key-decisions:
  - "machines.is_active filter applied (confirmed in migration 001) — only active machines scanned for underutilization"
  - "machine_scan_events queried per-gym (gym_id filter) with in-memory Set diff — avoids SDK IN-array limitation and handles multi-gym installations correctly"
  - "challenge end_date compared as DATE string (YYYY-MM-DD) matching the DATE column type — not timestamptz"
  - "challenge auto-expiry dedup_key = challenge.id matches the owner-complete path (plan 05-03) — trigger route's 24h challenge-ended cooldown deduplicates across both code paths (Pitfall 6)"
  - "dormant_triggered counter counts fulfilled Promise.allSettled results — rejected triggers (e.g. cooldown skip returned as non-success) don't inflate the count"

requirements-completed: [AGENT-04]

# Metrics
duration: 21min
completed: 2026-07-20
---

# Phase 05 Plan 05: Agent Daily Cron Route Summary

**Daily cron covering 4 scheduled automations: dormant-member retention, check-in SLA operations, machine underutilization operations, and challenge auto-expiry growth (Pitfall 6 safety net)**

## Performance

- **Duration:** 21 min
- **Started:** 2026-07-20T03:41:51Z
- **Completed:** 2026-07-20T04:02:31Z
- **Tasks:** 2 (both TDD — Task 1 + Task 2 combined into RED/GREEN pair)
- **Files created:** 2

## Accomplishments

- `route.ts` implements all 4 daily scans with dual-header auth matching the dna-recompute pattern (x-smartgym-internal-key OR Authorization Bearer for pg_cron)
- Scan 1 (dormant members): queries `members.last_session_date < 14d ago` → retention-agent `member-inactive-14d` per member in batches of 10
- Scan 2 (check-in SLA): same overdue filter as checkin-deadline cron → operations-agent `checkin-sla-overdue` with `dedup_key = checkin.id`
- Scan 3 (machine underutilization): fetches all active machines, queries `machine_scan_events` per-gym for the last 7 days, Set-diffs in-memory → operations-agent `machine-underutilized` per zero-scan machine with `dedup_key = machine.id` and `machine_id` in payload
- Scan 4 (challenge auto-expiry): queries `gym_challenges where is_active=true and end_date < today` → updates `is_active=false` then fires growth-agent `challenge-ended` with `auto_expired: true` and `dedup_key = challenge.id`
- Pitfall 6 resolved: challenges that expire by date without owner action are now auto-deactivated AND fire the agent; the 24h cooldown in the trigger route deduplicates against the owner-complete path
- 11 tests covering all auth forms, all 4 scan types, empty-scan zero-counters, and batching resilience
- Full web-admin suite: 406 passed, 5 failing tests are pre-existing RED tests from plans 05-03/05-06 (unimplemented implementations — expected)

## Task Commits

1. **RED: Failing tests** — `812ce57` (test) — agent-daily.test.ts with 11 tests all failing (route does not exist)
2. **GREEN: Implementation** — `143d67b` (feat) — route.ts (new) + test file mock fix; all 11 tests pass

## Files Created

- `apps/web-admin/src/app/api/cron/agent-daily/route.ts` — Daily cron: dual-header auth, 4 scan types, batched Promise.allSettled, JSON counters response
- `apps/web-admin/src/app/api/cron/agent-daily/__tests__/agent-daily.test.ts` — 11 tests: auth (4), dormant scan (1), checkin SLA scan (1), empty scans (1), batching resilience (1), machine underutilization (1), challenge expiry (2)

## Decisions Made

- **machines.is_active filter:** Migration 001 confirms `machines.is_active boolean NOT NULL DEFAULT true` — only active machines are candidates for underutilization alerts
- **Per-gym machine scan events query:** The Supabase SDK doesn't support `IN` array filters for large sets. Per-gym queries collect scan events into a unified Set, which handles multi-gym installations correctly
- **DATE string comparison:** `end_date` is a `DATE` column (not `timestamptz`) — compared with `.toISOString().slice(0,10)` to get a `YYYY-MM-DD` string, avoiding timezone-related mismatch
- **Challenge dedup via dedup_key:** `dedup_key = challenge.id` in both the cron auto-expiry path and the owner-complete path (plan 05-03) — the trigger route's 24h `challenge-ended` cooldown ensures once-per-challenge firing regardless of which path ran first

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed machine_scan_events query to use per-gym loop instead of global fetch**
- **Found during:** Task 1/2 GREEN — TypeScript and test mock compatibility issue with chaining `.gte()` directly after `.select()`
- **Issue:** Initial implementation attempted to cast `admin.from(...).select(...)` to an intermediate type to access `.gte()` directly. The Supabase SDK types do not support this; the mock chain also required `.eq().gte()` structure
- **Fix:** Updated route to iterate unique gym_ids from the machines query and issue one `machine_scan_events` query per gym (`.select().eq(gym_id).gte(scanned_at)`). Results are merged into a single Set before the in-memory diff. This is semantically correct AND more efficient (gym-scoped queries use the `idx_scan_events_gym_time` index)
- **Files modified:** `apps/web-admin/src/app/api/cron/agent-daily/route.ts`
- **Verification:** All 11 tests green
- **Committed in:** `143d67b`

---

**Total deviations:** 1 auto-fixed (Rule 1 — query pattern bug; production correctness improved)

## Issues Encountered

None in production logic. One query-pattern fix as documented above.

## Next Phase Readiness

- All 4 AGENT-04 daily scan automations live: #3 (dormant), #10 (machine underuse), #11 (checkin SLA), #12 (challenge expiry safety net)
- The pg_cron schedule `nexera-agent-daily` from migration 029 points at this route and will fire it at 06:00 UTC daily
- Plan 05-06 (staging verification against demo environment) can begin immediately

## Self-Check: PASSED

- `apps/web-admin/src/app/api/cron/agent-daily/route.ts`: FOUND
- `apps/web-admin/src/app/api/cron/agent-daily/__tests__/agent-daily.test.ts`: FOUND
- Commit `812ce57` (RED): FOUND
- Commit `143d67b` (GREEN): FOUND
- 11 agent-daily tests: PASSED
- tsc --noEmit (agent-daily files): CLEAN (0 errors in new files; 3 pre-existing errors in other test files)
- Full web-admin suite: 406/411 passed (5 pre-existing RED tests in 05-03/05-06 plans)

---
*Phase: 05-uptimizeai-agent-connection*
*Completed: 2026-07-20*

---
phase: 05-uptimizeai-agent-connection
plan: 01
subsystem: agent-infra
tags: [migration, pg-cron, dedup-index, echo-receiver, env-contract, staging]
dependency_graph:
  requires: []
  provides: [idx_agent_logs_dedup, idx_agent_logs_member_dedup, nexera-agent-daily, nexera-agent-weekly, agent-echo-route, UPTIMIZE_WEBHOOK_URL-contract]
  affects: [smartgym_agent_logs, supabase/migrations, apps/web-admin/.env.example, DEMO_SETUP.md]
tech_stack:
  added: []
  patterns: [pg-cron-net-http-post, partial-index-where-status, DEMO_ECHO_AGENTS-gate, action_taken-record-pattern]
key_files:
  created:
    - supabase/migrations/029_agent_dedup_and_cron.sql
    - apps/web-admin/src/app/api/dev/agent-echo/route.ts
  modified:
    - apps/web-admin/.env.example
    - DEMO_SETUP.md
decisions:
  - "Echo receiver records reception via action_taken='echo-received' (never status column — CHECK constraint allows only sent/failed/pending/skipped)"
  - "DEMO_ECHO_AGENTS=true is the hard gate; echo route returns 404 in any other environment"
  - "pg_cron jobs 404 harmlessly until plans 05-04/05-05 deploy the cron routes — by design"
  - "is_agent_initiated lives in payload jsonb — no column migration needed; schema enforced at application layer"
metrics:
  duration_seconds: 581
  completed_date: "2026-07-20"
  tasks_completed: 2
  tasks_total: 3
  files_created: 2
  files_modified: 2
  commits: 2
---

# Phase 05 Plan 01: Agent Foundation — Migration 029 + Echo Receiver Summary

**One-liner:** Migration 029 adds two partial dedup indexes on smartgym_agent_logs + two pg_cron schedules (agent-daily/agent-weekly via net.http_post); echo receiver route provides DEMO_ECHO_AGENTS-gated staging verification target for the UptimizeAI forwarding chain.

## What Was Built

### Task 1 — Migration 029 (commit `0373341`)

`supabase/migrations/029_agent_dedup_and_cron.sql` adds:

1. **`idx_agent_logs_dedup`** — partial index on `smartgym_agent_logs(gym_id, agent_name, trigger_event, executed_at DESC) WHERE status = 'sent'`. Backs the cooldown dedup query added in plan 05-02: one index range scan instead of a sequential scan on the full log table.

2. **`idx_agent_logs_member_dedup`** — partial index on `(gym_id, agent_name, member_id, executed_at DESC) WHERE member_id IS NOT NULL AND status = 'sent'`. Used by per-member dedup scenarios (at-risk, dormant retention).

3. **`nexera-agent-daily`** — `cron.schedule` at `0 6 * * *`, POSTs to `/api/cron/agent-daily` via `net.http_post` with `Authorization: Bearer <service_role_key>`. Route built in plan 05-04.

4. **`nexera-agent-weekly`** — `cron.schedule` at `0 5 * * 0` (Sunday), POSTs to `/api/cron/agent-weekly`. Route built in plan 05-05.

### Task 2 — Echo receiver + env contract (commit `e5aa7b0`)

**`apps/web-admin/src/app/api/dev/agent-echo/route.ts`**
- Hard-gated by `DEMO_ECHO_AGENTS !== 'true'` (returns 404 otherwise — never active in production)
- Parses JSON body; returns 400 on invalid JSON
- Logs `[agent-echo] received: <body>` to console for immediate visual confirmation
- If `body.log_id` is a string: updates the matching `smartgym_agent_logs` row with `action_taken = 'echo-received'` via admin client. Does NOT touch `status` (CHECK constraint enforced)
- Returns `{ echoed: true, agent_name, log_id }`
- Exports `POST` handler + `dynamic` const only (repo route file convention)

**`apps/web-admin/.env.example`** — appended after `INTERNAL_WEBHOOK_KEY`:
```
UPTIMIZE_WEBHOOK_URL=
UPTIMIZE_API_KEY=
DEMO_ECHO_AGENTS=false
```
With inline comments explaining staging path (point at echo receiver) and live path (set real URL — no code changes required).

**`DEMO_SETUP.md`** — new Section 8 "Agent Staging Verification":
- One-time setup: 3 env lines + restart
- How to fire a trigger (curl example included)
- Two confirmation methods: console log + SQL query for `action_taken='echo-received'`
- Going-live checklist (3 env changes, no code changes)

## Deviations from Plan

None — plan executed exactly as written.

The two pre-existing tsc errors in `trigger.test.ts` (tuple type errors at line 202) were present before this plan in commit `c989fe4` (TDD RED phase of plan 05-02). They are intentional RED-phase placeholder errors in an adjacent plan's test file. Out of scope per deviation boundary rule.

## Checkpoint State — Task 3

Task 3 is `type="checkpoint:human-action"` (blocking). Migration 029 was written in Task 1 but has NOT been applied to the live Supabase project (aztppxuapbgmadfigtys). Awaiting human approval and `db push`.

**Verification queries after applying:**
```sql
SELECT indexname FROM pg_indexes WHERE tablename = 'smartgym_agent_logs';
-- Expected: idx_agent_logs_dedup, idx_agent_logs_member_dedup (among others)

SELECT jobname FROM cron.job WHERE jobname LIKE 'nexera-agent-%';
-- Expected: nexera-agent-daily, nexera-agent-weekly
```

## Self-Check: PASSED

- `supabase/migrations/029_agent_dedup_and_cron.sql` — FOUND
- `apps/web-admin/src/app/api/dev/agent-echo/route.ts` — FOUND
- commit `0373341` — FOUND (chore(05-01): add migration 029)
- commit `e5aa7b0` — FOUND (feat(05-01): echo receiver route + UptimizeAI env contract)

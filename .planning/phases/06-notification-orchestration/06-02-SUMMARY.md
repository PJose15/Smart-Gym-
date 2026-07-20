---
phase: 06-notification-orchestration
plan: 02
subsystem: database
tags: [postgres, pg_cron, supabase, migrations, notification_log]

requires:
  - phase: 05-uptimizeai-agent-connection
    provides: "pg_cron + net.http_post dual-header cron pattern (migration 029)"
  - phase: 06-notification-orchestration
    provides: "notification_log table with status CHECK (migration 019), plan 06-01 dispatcher"
provides:
  - "notification_log.status accepts 'delivered' (DB aligned with TS type)"
  - "Partial index idx_notification_log_receipt_pending for O(pending) receipt-poll queries"
  - "nexera-receipt-poll pg_cron job firing every 15 minutes"
affects:
  - "06-04 (receipt-poll route — the cron target)"
  - "06-03 (stale-token cleanup — reads notification_log status)"

tech-stack:
  added: []
  patterns:
    - "pg_cron + net.http_post schedule-before-route: cron harmlessly 404s until the route lands (from migration 029)"
    - "Drop-if-exists + re-add CHECK: idempotent constraint swap for Postgres auto-named constraints"
    - "Partial index on (status, expo_receipt_id) columns: bounds index size to the pending subset only"

key-files:
  created:
    - supabase/migrations/031_notification_receipts_cron.sql
  modified: []

key-decisions:
  - "No expo_receipt_ids array column: Edge Function stores only the first ticket ID per send; multi-device receipt coverage is post-launch (06-RESEARCH.md Pitfall 5)"
  - "Drop-if-exists then re-add approach for notification_log_status_check: migration 019 used Postgres auto-naming, making the constraint name predictable but the drop must be conditional"
  - "nexera-receipt-poll schedule '*/15 * * * *': every 15 minutes balances Expo receipt API latency (receipts available ~5-30 min after send) against staleness"

patterns-established:
  - "Schedule-before-route: pg_cron jobs can be installed before the target route exists — 404s are harmless and self-heal when the route deploys"

requirements-completed: [NOTIF-06]

duration: 10min
completed: 2026-07-20
---

# Phase 6 Plan 02: Notification Receipts Cron Summary

**Migration 031 extends notification_log status CHECK to 'delivered', adds a receipt-poll partial index, and schedules the nexera-receipt-poll pg_cron job every 15 minutes — DB side complete, awaiting human apply.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-07-20T05:35:00Z
- **Completed:** 2026-07-20T05:45:00Z (Task 1 only — Task 2 is human checkpoint)
- **Tasks:** 1 of 2 automated tasks complete (Task 2 = human-action checkpoint)
- **Files modified:** 1

## Accomplishments

- Wrote migration 031 with three coordinated DDL operations: CHECK swap, partial index, cron schedule
- Automated verify script (`node -e ...`) passed all five assertions (constraint name, 'delivered', index name, job name, net.http_post pattern)
- Followed migration 029 net.http_post dual-header pattern exactly per plan interfaces block

## Task Commits

1. **Task 1: Write migration 031** - `72cec9d` (chore)

**Task 2 (human-action checkpoint):** Migration 031 not yet applied to live DB — awaiting user.

## Files Created/Modified

- `supabase/migrations/031_notification_receipts_cron.sql` — status CHECK extension ('delivered'), partial receipt-poll index, nexera-receipt-poll cron schedule

## Decisions Made

- No expo_receipt_ids array column (plan decision, 06-RESEARCH.md Pitfall 5 — single-receipt MVP)
- Drop-if-exists pattern for the auto-named Postgres CHECK constraint (idempotent)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

**Task 2 (blocking checkpoint):** Apply migration 031 to the live Supabase project (aztppxuapbgmadfigtys).

Steps:
1. Review `supabase/migrations/031_notification_receipts_cron.sql`
2. Apply via Supabase MCP `apply_migration` or `supabase db push`
3. Confirm: `SELECT jobname FROM cron.job WHERE jobname = 'nexera-receipt-poll';` returns one row
4. Confirm: `SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'notification_log_status_check';` includes 'delivered'

The cron job will 404 harmlessly until plan 06-04 deploys `/api/cron/receipt-poll` (same as migration 029 pattern).

## Next Phase Readiness

- Migration 031 file is committed and ready to apply
- After human applies migration: plan 06-03 (stale-token cleanup) can read 'delivered' rows; plan 06-04 (receipt-poll route) has its cron trigger waiting
- No blockers beyond the human-action checkpoint

---
*Phase: 06-notification-orchestration*
*Completed: 2026-07-20*

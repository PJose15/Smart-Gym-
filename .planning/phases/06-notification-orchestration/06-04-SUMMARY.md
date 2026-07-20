---
phase: 06-notification-orchestration
plan: "04"
subsystem: notification-receipts
tags: [cron, expo-receipts, push-delivery, device-tokens, health-endpoint]
dependency_graph:
  requires: ["06-02"]
  provides: ["receipt-polling", "device-token-cleanup", "delivery-rate-visibility"]
  affects: ["notification_log", "device_tokens", "admin-health"]
tech_stack:
  added: []
  patterns: ["tdd-red-green", "dual-header-cron-auth", "expo-receipts-api", "deactivate-on-dnr"]
key_files:
  created:
    - apps/web-admin/src/app/api/cron/receipt-poll/route.ts
    - apps/web-admin/src/app/api/cron/receipt-poll/__tests__/receipt-poll.test.ts
  modified:
    - apps/web-admin/src/app/api/admin/health/route.ts
decisions:
  - "Dual-key auth: SMARTGYM_INTERNAL_KEY (x-smartgym-internal-key header) OR SUPABASE_SERVICE_ROLE_KEY (Bearer) — both valid for pg_cron and internal callers"
  - "30-min floor on receipt poll window prevents too-early Expo API calls; 24h ceiling drops stale tickets"
  - "DeviceNotRegistered deactivates all active device_tokens for profile_id (single-device MVP; receipt doesn't reliably echo specific token)"
  - "delivery_rate is over resolved receipts only (delivered / (delivered + failed)); null when denominator 0"
  - "Pre-existing dispatcher/notifications test failures (TDD RED for plans 06-03/06-08) are out of scope"
metrics:
  duration_minutes: 5
  completed_date: "2026-07-20"
  tasks_completed: 2
  files_created: 2
  files_modified: 1
---

# Phase 06 Plan 04: Receipt Poll Cron + Health Delivery Rate Summary

**One-liner:** Expo receipt-polling cron route that transitions notification_log rows to delivered/failed and deactivates DeviceNotRegistered device_tokens, plus 24h delivery_rate block in admin health.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 (TDD RED) | Failing receipt-poll tests | 313603c | receipt-poll.test.ts (312 lines, 10 tests) |
| 1 (TDD GREEN) | Receipt-poll cron route | d438062 | receipt-poll/route.ts |
| 2 | Admin health delivery-rate block | c406e60 | admin/health/route.ts |

## What Was Built

### Task 1: POST /api/cron/receipt-poll (TDD)

**Route:** `apps/web-admin/src/app/api/cron/receipt-poll/route.ts`

- Dual-header auth: accepts `x-smartgym-internal-key` OR `Authorization: Bearer <service-role-key>`; returns 401 on mismatch with no DB queries
- Queries `notification_log` for rows with `status='sent'`, `expo_receipt_id IS NOT NULL`, within 24h window but older than 30 minutes (Expo polling floor), ordered ASC, limit 100 — backed by `idx_notification_log_receipt_pending` (migration 031)
- Single Expo `getReceipts` POST call with all collected IDs, `AbortSignal.timeout(10_000)`
- Per-receipt processing:
  - `ok` → update log row to `status='delivered'`
  - `error` (non-DNR) → update log row to `status='failed'`; `device_tokens` untouched
  - `error` with `details.error === 'DeviceNotRegistered'` → `status='failed'` AND `device_tokens UPDATE active=false WHERE profile_id = row.profile_id AND active = true`
  - Receipt ID absent from Expo response → row left untouched (still pending)
- Returns `{ polled, delivered, failed, tokens_deactivated }`
- Wrapped in try/catch → 500 with `console.error` detail

**Tests (10 passing):**
- Test 1 (x2): no/wrong auth → 401, no DB queries
- Test 3-4: valid internal-key and Bearer → 200
- Test 2: empty pending rows → 200 `{ polled: 0 }`, Expo fetch not called
- Test 5: ok receipt → `delivered` counter incremented, no device_tokens touch
- Test 6: error (non-DNR) → `failed` counter, device_tokens untouched
- Test 7: DeviceNotRegistered → `failed` + `tokens_deactivated`, device_tokens.active=false
- Test 8: missing receipt ID → no update, `delivered=0 failed=0`
- Test 9: response shape includes all four fields

### Task 2: Admin Health Notifications Block

**Route:** `apps/web-admin/src/app/api/admin/health/route.ts`

- Extended existing `Promise.all` with three `notification_log` count queries (sent/delivered/failed, 24h window)
- Computes `delivery_rate = delivered / (delivered + failed)` rounded to 3dp; `null` when denominator is 0
- Response now includes:
  ```json
  "notifications": {
    "sent_24h": 12,
    "delivered_24h": 45,
    "failed_24h": 2,
    "delivery_rate": 0.957
  }
  ```
- `sent_24h` = tickets accepted but receipt not yet polled (pending); noted in comment
- No new test infrastructure created (no existing `__tests__` dir for this route; receipt-poll suite covers log semantics)

## Deviations from Plan

None — plan executed exactly as written.

Pre-existing test failures in `dispatcher.test.ts` and `notifications.test.ts` (TDD RED tests for plans 06-03 and 06-08, routes not yet implemented) are documented as out-of-scope per deviation rules. These existed before this plan's execution.

## Self-Check: PASSED

Files exist:
- `apps/web-admin/src/app/api/cron/receipt-poll/route.ts` — FOUND
- `apps/web-admin/src/app/api/cron/receipt-poll/__tests__/receipt-poll.test.ts` — FOUND
- `apps/web-admin/src/app/api/admin/health/route.ts` (modified) — FOUND

Commits:
- 313603c — TDD RED tests
- d438062 — receipt-poll route
- c406e60 — health notifications block

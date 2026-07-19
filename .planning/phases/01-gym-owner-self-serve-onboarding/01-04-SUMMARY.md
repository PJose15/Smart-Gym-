---
phase: 01-gym-owner-self-serve-onboarding
plan: "04"
subsystem: owner-dashboard
tags: [onboarding, checklist, trial, billing, dashboard]
dependency_graph:
  requires: []
  provides: [onboarding-status-api, setup-checklist-ui, trial-countdown-ui]
  affects: [owner-dashboard]
tech_stack:
  added: []
  patterns: [count-exact-head-query, computeDaysRemaining-injectable-now, mountedRef-abort-controller]
key_files:
  created:
    - apps/web-admin/src/app/api/owner/onboarding-status/route.ts
    - apps/web-admin/src/app/api/owner/__tests__/onboarding-status.test.ts
    - apps/web-admin/src/components/owner/SetupChecklist.tsx
    - apps/web-admin/src/components/owner/TrialCountdownBanner.tsx
  modified:
    - apps/web-admin/src/app/owner/dashboard/page.tsx
decisions:
  - "Export computeDaysRemaining as a pure injectable helper (now param) so tests hit the calc with fixed timestamps without time-travel mocks"
  - "has_shared_qr derived from machine_scan_events count — proxy for 'QR has been used at least once'"
  - "SetupChecklist returns null (not hidden) when all 3 items complete — avoids layout gap"
  - "TrialCountdownBanner uses color-mix(in srgb, var(--accent) ...) for accent-tinted bg, no ad-hoc hex"
  - "Silent failure on onboarding-status fetch — console.error only, never blocks dashboard"
metrics:
  duration_minutes: 6
  completed_date: "2026-07-19"
  tasks_completed: 2
  tasks_total: 2
  files_created: 4
  files_modified: 1
  tests_added: 9
  tests_total: 300
---

# Phase 01 Plan 04: Setup Checklist + Trial Countdown Summary

**One-liner:** Live-DB checklist (machines/members/scans counts) and trial countdown banner wired into the owner dashboard with a pure `computeDaysRemaining` helper (ceil, clamped, injectable timestamp).

## What Was Built

### Task 1: GET /api/owner/onboarding-status

New route at `apps/web-admin/src/app/api/owner/onboarding-status/route.ts`:

- `verifyStaff('owner')` guard with 401/403 passthrough
- 4 parallel queries via admin client: `machines` count, `members` count, `machine_scan_events` count, `gym_billing` billing row
- Exported pure helper `computeDaysRemaining(trialEndsAt, now?)` — Math.ceil, clamped ≥0, injectable `now` param for deterministic tests
- Response shape: `{ checklist: { has_machine, has_members, has_shared_qr }, trial: { is_trialing, trial_ends_at, days_remaining } }`
- 9 tests: 4 unit tests on the pure helper, 5 integration tests covering the 5 specified behaviors

### Task 2: SetupChecklist + TrialCountdownBanner + dashboard wiring

**SetupChecklist** (`components/owner/SetupChecklist.tsx`, 167 lines):
- Card with DOC_03 tokens (`var(--color-bg-raised)`, `var(--color-border-default)`)
- 3 rows: machine link `/machines`, members link `/setup/import`, QR download `/api/machines/qr-pdf`
- Completed rows: strikethrough + muted text + check SVG in `var(--color-green)`; pending: hollow circle in `var(--color-border-default)`
- Progress caption "N of 3 complete" with `var(--color-blue)` accent
- Returns null when all three items are complete

**TrialCountdownBanner** (`components/owner/TrialCountdownBanner.tsx`, 64 lines):
- Slim banner with `color-mix(in srgb, var(--accent) 10%, ...)` background, `var(--accent)` border
- "X days left in your free trial" / "Your trial ends today" (0-day case)
- "Upgrade now" Link button to `/owner/billing` in `var(--accent)` background
- `role="status"` + `aria-live="polite"` for a11y

**Dashboard wiring** (`app/owner/dashboard/page.tsx`):
- New `onboardingStatus` state + one-shot `useEffect` fetch
- Follows existing `mountedRef` + `AbortController` pattern
- `TrialCountdownBanner` rendered when `is_trialing && days_remaining !== null`
- `SetupChecklist` rendered when `onboardingStatus` is non-null (null before fetch resolves)
- Silent failure: catches errors, logs to console, never blocks dashboard render

## Deviations from Plan

None — plan executed exactly as written.

## Verification

- tsc: clean (0 errors)
- Test suite: 300 tests pass (23 suites) — up from 269 baseline (+ 9 new tests for this plan + existing suite grew from prior sessions)
- Key behaviors verified:
  - `computeDaysRemaining(null)` → `null`
  - `computeDaysRemaining(10.5 days out)` → `11` (ceil)
  - `computeDaysRemaining(past)` → `0` (clamped)
  - Route T1: non-owner → 403 passthrough
  - Route T2: 1 machine, 0 members, 0 scans → correct booleans
  - Route T3/T4: trialing status with future/past trial_ends_at
  - Route T5: active subscription → is_trialing=false, days_remaining=null

## Self-Check: PASSED

Files created:
- apps/web-admin/src/app/api/owner/onboarding-status/route.ts: FOUND
- apps/web-admin/src/app/api/owner/__tests__/onboarding-status.test.ts: FOUND
- apps/web-admin/src/components/owner/SetupChecklist.tsx: FOUND
- apps/web-admin/src/components/owner/TrialCountdownBanner.tsx: FOUND

Commits:
- e0dc180: feat(01-04): add GET /api/owner/onboarding-status route
- b833409: feat(01-04): add SetupChecklist + TrialCountdownBanner wired to owner dashboard

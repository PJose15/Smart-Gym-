---
phase: 01-gym-owner-self-serve-onboarding
plan: "01"
subsystem: database
tags: [postgres, plpgsql, rpc, stripe, csv, react-hook-form, zod, supabase]

requires: []
provides:
  - stripe_events_processed table for Stripe webhook idempotency (service_role only)
  - "'invited' value added to members.onboarding_status CHECK constraint"
  - complete_gym_onboarding RPC — atomic gym+membership+settings+billing creation
  - bulk_import_members RPC — CSV batch member insert with duplicate skip
  - react-hook-form, @hookform/resolvers, csv-parse installed in web-admin
affects:
  - 01-02-PLAN (wizard uses complete_gym_onboarding RPC + react-hook-form)
  - 01-03-PLAN (Stripe webhook handler uses stripe_events_processed)
  - 01-05-PLAN (CSV import uses bulk_import_members RPC + csv-parse)
  - 01-06-PLAN (invited status enables phone-OTP member claim flow)

tech-stack:
  added:
    - react-hook-form@^7.82.0 (multi-step wizard forms)
    - "@hookform/resolvers@^3.10.0 (zod v4 integration)"
    - csv-parse@^5.6.0 (server-side CSV parsing)
  patterns:
    - Postgres SECURITY DEFINER RPC with REVOKE/GRANT for service_role isolation
    - Slug-collision retry loop (up to 3 attempts with random 4-char hex suffix)
    - Duplicate-skip pattern in bulk insert RPC (email + phone dedup per gym)

key-files:
  created:
    - supabase/migrations/027_owner_onboarding.sql
  modified:
    - apps/web-admin/package.json
    - pnpm-lock.yaml

key-decisions:
  - "RPCs use SECURITY DEFINER + REVOKE FROM PUBLIC + GRANT TO service_role — no authenticated/anon access"
  - "complete_gym_onboarding uses a loop-with-exception-catch pattern for slug uniqueness (up to 3 retries)"
  - "bulk_import_members skips duplicates (not errors) — validate-then-import two-phase flow handles bad data before this runs"
  - "stripe_events_processed has no RLS policies (service_role bypasses RLS entirely)"

patterns-established:
  - "Pattern: Atomic multi-table insert via plpgsql RPC with SECURITY DEFINER — all Phase 1 multi-row writes use this pattern"
  - "Pattern: REVOKE EXECUTE FROM PUBLIC, anon, authenticated; GRANT TO service_role — standard for admin-only functions"

requirements-completed: [ONBD-02, ONBD-05, ONBD-06]

duration: 22min
completed: 2026-07-19
---

# Phase 01 Plan 01: Owner Onboarding Foundation Summary

**Migration 027 creates stripe idempotency table, 'invited' status, complete_gym_onboarding and bulk_import_members RPCs; react-hook-form + @hookform/resolvers + csv-parse installed in web-admin**

## Performance

- **Duration:** 22 min
- **Started:** 2026-07-19T16:37:11Z
- **Completed:** 2026-07-19T17:00:00Z
- **Tasks:** 1 of 2 (Task 2 is a human-action checkpoint — DB push pending approval)
- **Files modified:** 3

## Accomplishments

- Migration 027 written (217 lines): stripe_events_processed table, 'invited' onboarding status, complete_gym_onboarding RPC (atomic 4-table creation with slug collision retry), bulk_import_members RPC (duplicate-skip per email/phone, all service_role gated)
- All 3 frontend dependencies installed and verified in apps/web-admin/package.json
- 269 existing web-admin tests confirmed green; pre-existing 2-suite failure (stripeHelpers + onboarding-status test mocks) is unchanged from baseline

## Task Commits

1. **Task 1: Write migration 027 + install frontend dependencies** — `b7b5bb2` (feat)

**Plan metadata:** pending final commit after Task 2 (DB push)

## Files Created/Modified

- `supabase/migrations/027_owner_onboarding.sql` — 4-section migration: idempotency table, CHECK constraint update, complete_gym_onboarding RPC, bulk_import_members RPC
- `apps/web-admin/package.json` — react-hook-form, @hookform/resolvers, csv-parse added to dependencies
- `pnpm-lock.yaml` — lockfile updated

## Decisions Made

- Used loop-with-exception-catch in complete_gym_onboarding for slug uniqueness (appends `-XXXX` random hex on collision, up to 3 retries) per plan spec and RESEARCH Pitfall 8
- bulk_import_members uses JSONB array parameter rather than temp table — simpler, avoids DDL inside function
- 'invited' added as the 7th value to members.onboarding_status CHECK — no data migration needed (existing rows are unaffected)
- Both RPCs: REVOKE FROM PUBLIC, anon, authenticated; GRANT TO service_role — consistent with SECURITY DEFINER pattern used by is_gym_owner and owned_gym_ids in migration 001

## Deviations from Plan

None — plan executed exactly as written. Migration sections, RPC signatures, SECURITY DEFINER pattern, and package versions all match the plan spec.

## Issues Encountered

Two pre-existing test suite failures (`stripeHelpers.test.ts` — out-of-scope jest.mock variable reference; `onboarding-status.test.ts` — Request not defined in jsdom) confirmed unchanged from baseline (verified by stashing changes and running tests). These are tracked in the repo as Wave 0 test gaps noted in 01-RESEARCH.md, not regressions from this plan.

## User Setup Required

**Task 2 is a human-action checkpoint.** After reviewing `supabase/migrations/027_owner_onboarding.sql`, reply "approved" to trigger `npx supabase db push --linked` against Supabase project `aztppxuapbgmadfigtys`. Claude will then run the push and verify:

- `SELECT to_regclass('public.stripe_events_processed')` — must be non-null
- `SELECT proname FROM pg_proc WHERE proname IN ('complete_gym_onboarding','bulk_import_members')` — must return 2 rows
- `SELECT conname FROM pg_constraint WHERE conname = 'members_onboarding_status_check'` — must include 'invited'

## Next Phase Readiness

- Migration 027 is written and committed — pending DB push approval (Task 2)
- Once Task 2 completes: Plans 01-02 through 01-07 can proceed (all depend on migration 027 objects)
- Frontend deps installed: wizard (01-02), CSV import (01-05) can use react-hook-form and csv-parse immediately

---
*Phase: 01-gym-owner-self-serve-onboarding*
*Completed: 2026-07-19*

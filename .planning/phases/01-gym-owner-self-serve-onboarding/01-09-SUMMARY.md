---
phase: 01-gym-owner-self-serve-onboarding
plan: 09
subsystem: testing
tags: [jest, eslint, typescript, next.js, tsc, verification, e2e]

# Dependency graph
requires:
  - phase: 01-gym-owner-self-serve-onboarding
    provides: All 8 prior plans — signup, billing webhook, machine wizard, CSV import
provides:
  - Verified automated gate: tsc strict clean, ESLint 0 errors, 876 tests green, next build passes
  - Awaiting human E2E walkthrough (9 steps: signup → checkout → machine wizard → CSV → member claim → dashboard)
affects: [phase-2, phase-3, phase-4, phase-5, phase-6]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Route files must only export HTTP method handlers (GET/POST/etc.) — test utilities and types must live in adjacent modules"
    - "prices/cache.ts pattern: module-level state + reset helper extracted from route file for testability without violating Next.js route constraints"

key-files:
  created:
    - apps/web-admin/src/app/api/billing/prices/cache.ts
    - apps/web-admin/src/app/api/owner/onboarding-status/types.ts
  modified:
    - apps/web-admin/src/app/api/billing/prices/route.ts
    - apps/web-admin/src/app/api/owner/onboarding-status/route.ts
    - apps/web-admin/src/app/owner/dashboard/page.tsx
    - apps/web-admin/src/app/(onboard)/subscribe/page.tsx
    - apps/web-admin/src/app/api/owner/__tests__/onboarding-status.test.ts
    - apps/web-admin/src/app/api/billing/__tests__/checkout-context.test.ts
    - apps/web-admin/src/lib/import/parseMembersCsv.ts
    - apps/web-admin/src/lib/import/__tests__/parseMembersCsv.test.ts

key-decisions:
  - "Non-HTTP exports in Next.js route files are a build error — extracted to adjacent cache.ts/types.ts modules"
  - "Literal BOM (U+FEFF) in regex replaced with \\uFEFF escape to satisfy no-irregular-whitespace"
  - "eslint-disable-next-line comments for plugins not in .eslintrc.json are errors — removed"

patterns-established:
  - "Pattern: Route-level test helpers (cache reset, pure functions) go in adjacent files, never exported from route.ts"

requirements-completed: [ONBD-01, ONBD-02, ONBD-03, ONBD-04, ONBD-05, ONBD-06, ONBD-07]

# Metrics
duration: 55min
completed: 2026-07-19
---

# Phase 01 Plan 09: Verification Gate Summary

**876 tests green + tsc strict clean + next build passes + ESLint 0 errors; E2E walkthrough awaiting human verification**

## Performance

- **Duration:** ~55 min
- **Started:** 2026-07-19T13:20:00Z
- **Completed:** 2026-07-19T14:20:00Z
- **Tasks:** 1 complete (automated gate), 1 awaiting human verification
- **Files modified:** 9

## Accomplishments

- All 3 test suites green: 342 web-admin + 135 mobile + 399 ai-assist = 876 total (baseline 803)
- TypeScript strict clean across web-admin (tsc --noEmit)
- ESLint: 0 errors (5 errors auto-fixed in phase-shipped files)
- Next.js build passes cleanly (`next build` exit 0)
- Auto-fixed 7 issues found during gate execution (2 commits: `f12372c`, `b4577f2`)
- 9-step E2E walkthrough presented to user for manual verification

## Task Commits

1. **Task 1: Full automated gate (lint fixes)** - `f12372c` (fix)
2. **Task 1: Full automated gate (route exports + build fix)** - `b4577f2` (fix)
3. **Task 2: E2E walkthrough** - awaiting human verification

**Plan metadata:** (to be committed with SUMMARY.md)

## Files Created/Modified

- `apps/web-admin/src/app/api/billing/prices/cache.ts` — Extracted module-level cache state + _resetPricesCache helper (was in route.ts)
- `apps/web-admin/src/app/api/owner/onboarding-status/types.ts` — Extracted OnboardingStatusResponse + computeDaysRemaining (was in route.ts)
- `apps/web-admin/src/app/api/billing/prices/route.ts` — Removed non-HTTP exports, fixed optional request param
- `apps/web-admin/src/app/api/owner/onboarding-status/route.ts` — Removed non-HTTP exports, imports from types.ts
- `apps/web-admin/src/app/owner/dashboard/page.tsx` — Updated import to onboarding-status/types
- `apps/web-admin/src/app/(onboard)/subscribe/page.tsx` — Removed invalid eslint-disable comment
- `apps/web-admin/src/app/api/owner/__tests__/onboarding-status.test.ts` — Updated import path + fixed Function type
- `apps/web-admin/src/app/api/billing/__tests__/checkout-context.test.ts` — Updated import + pass Request to GET()
- `apps/web-admin/src/lib/import/parseMembersCsv.ts` — Replace literal BOM with \\uFEFF in regex
- `apps/web-admin/src/lib/import/__tests__/parseMembersCsv.test.ts` — Fix BOM in comment

## Decisions Made

- Route files that export non-HTTP handlers (utility functions, types, test helpers) cause `next build` to fail via Next.js route type constraints — moved to adjacent modules as a pattern
- `GET(request?: Request)` optional param is invalid in Next.js route type system; made required and updated tests to pass `new Request()`
- The CI lint script does NOT use `--max-warnings=0`; only errors (not warnings) are blockers

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] 5 ESLint errors in phase-shipped files**
- **Found during:** Task 1 (automated gate run)
- **Issue:** (a) `subscribe/page.tsx` had `eslint-disable-next-line react-hooks/exhaustive-deps` but `eslint-plugin-react-hooks` is not in `.eslintrc.json` — produces "Definition for rule not found" error. (b) `onboarding-status.test.ts` used `Function` type (banned by `@typescript-eslint/ban-types`). (c) `parseMembersCsv.ts` lines 28 and 130 had literal U+FEFF BOM character in regex (flagged by `no-irregular-whitespace`). (d) Same in test file comment line 9.
- **Fix:** Removed invalid disable comment; replaced `Function` with explicit function type; replaced literal BOM with `﻿` unicode escape
- **Files modified:** subscribe/page.tsx, parseMembersCsv.ts, parseMembersCsv.test.ts, onboarding-status.test.ts
- **Verification:** ESLint 0 errors, tsc clean, 342 tests pass
- **Committed in:** `f12372c`

**2. [Rule 1 - Bug] Non-HTTP exports in route files blocking `next build`**
- **Found during:** Task 1 (next build check before checkpoint)
- **Issue:** `prices/route.ts` exported `_resetPricesCache` (test helper) and `onboarding-status/route.ts` exported `computeDaysRemaining` (pure function) + `OnboardingStatusResponse` (type). Next.js route type checker rejects any exports that aren't HTTP method handlers, causing `next build` to fail with "Type error: ...does not satisfy constraint".
- **Fix:** Extracted `_resetPricesCache` + cache state to `prices/cache.ts`; extracted `computeDaysRemaining` + `OnboardingStatusResponse` to `onboarding-status/types.ts`. Updated all consumers (test files, dashboard page). Also fixed `GET(request?: Request)` optional param → required.
- **Files modified:** prices/route.ts, prices/cache.ts (new), onboarding-status/route.ts, onboarding-status/types.ts (new), checkout-context.test.ts, onboarding-status.test.ts, owner/dashboard/page.tsx
- **Verification:** `next build` passes, 342 tests pass, tsc clean
- **Committed in:** `b4577f2`

---

**Total deviations:** 2 auto-fixed (2x Rule 1 - Bug)
**Impact on plan:** Both fixes necessary for correctness. Patterns extracted improve codebase quality. No scope creep.

## Issues Encountered

None beyond the auto-fixed deviations above. All gate failures were caused by the phase's newly-shipped code and resolved automatically.

## Task 2: E2E Walkthrough — AWAITING HUMAN VERIFICATION

Task 2 is a `checkpoint:human-verify` that requires manual execution. The automated environment is ready:
- Dev server starts cleanly (`pnpm dev` from apps/web-admin)
- All automated gates confirmed green
- User needs: Stripe CLI installed, test-mode webhook forwarding, real email, real phone for OTP

See the checkpoint message below for the 9-step walkthrough.

## User Setup Required

For E2E walkthrough verification:
- **Stripe CLI** installed and logged in (`stripe login`)
- **`stripe listen`** running in a second terminal to get the `whsec_...` webhook secret
- **`.env.local`** must have `STRIPE_WEBHOOK_SECRET` set to the whsec_ printed at stripe listen startup

## Next Phase Readiness

- Phase 1 automated gates: COMPLETE AND GREEN
- E2E walkthrough (9 steps) required before Phase 1 can be marked fully complete
- If any steps fail, gaps should be converted to `/gsd:plan-phase 1 --gaps`
- Phase 2 (Mobile Social Feed) is already complete (pre-roadmap, commits cba42c0 + af69753)
- Next new build: Phase 3 (Mobile Challenges) or address Phase 1 gaps if found

---
*Phase: 01-gym-owner-self-serve-onboarding*
*Completed: 2026-07-19 (Task 1); Task 2 awaiting human verification*

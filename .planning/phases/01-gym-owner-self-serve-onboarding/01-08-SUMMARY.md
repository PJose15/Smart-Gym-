---
phase: 01-gym-owner-self-serve-onboarding
plan: "08"
subsystem: api
tags: [csv, import, members, bulk, phone-otp, claim, onboarding]

requires:
  - phase: 01-01
    provides: "bulk_import_members RPC, 'invited' onboarding_status, member schema"
  - phase: 01-05
    provides: "(onboard)/ route group, WizardProgress component, verifyStaff auth"

provides:
  - "parseMembersCsv pure library: BOM-safe CSV parse, header alias normalization, E.164 phone normalization, in-file dedup, row-level validation"
  - "POST /api/owner/members/import: two-phase validate-then-import, 1 MB cap, 500-row cap, mode=validate is write-free"
  - "/setup/import page: drag-drop upload, per-row preview with chips, collapsible error list, client-side error CSV download, confirm → results"
  - "Claim path fix: invited members transition to 'in_progress' on first phone OTP login"

affects:
  - mobile onboarding (claim path uses verify/route.ts)
  - 01-09 (real-device OTP claim checkpoint uses this claim logic)
  - member management (import is the bulk onboarding path)

tech-stack:
  added: ["csv-parse/sync (already installed)", "ts-jest (switched from babel-jest — fixes 59-suite Babel 7.29 parse failure)"]
  patterns:
    - "Two-phase validate-then-import: validate returns parse preview with zero DB writes; import confirms and calls RPC"
    - "Phone normalization to E.164 at import boundary ensures phone-match claim always succeeds"
    - "jest.mock() factory bodies must not use TypeScript type annotations (Babel 7.29 hoisting limitation) — use typed params in helper functions outside mocks"
    - "Claim-path TDD: mock reflects actual update() payload so test fails if implementation sends wrong status"

key-files:
  created:
    - apps/web-admin/src/lib/import/parseMembersCsv.ts
    - apps/web-admin/src/lib/import/__tests__/parseMembersCsv.test.ts
    - apps/web-admin/src/app/api/owner/members/import/route.ts
    - apps/web-admin/src/app/api/owner/members/__tests__/import.test.ts
    - apps/web-admin/src/app/(onboard)/setup/import/page.tsx
    - apps/web-admin/src/app/api/auth/__tests__/verify-claim.test.ts
  modified:
    - apps/web-admin/src/app/api/auth/verify/route.ts
    - apps/web-admin/src/lib/auth/verifyStaff.ts
    - apps/web-admin/jest.config.js

key-decisions:
  - "Switch jest.config.js from babel-jest to ts-jest — pre-existing bug: Babel 7.29 cannot parse TypeScript inside jest.mock() factory bodies (all 59 suites failed before this fix)"
  - "Claim email sending deferred (no transactional email provider); claim works via phone OTP per spec; phone-less imported rows get warning 'not claimable until phone added'"
  - "Import route imports only valid rows (not all-or-nothing); owner confirms after seeing per-row validation report"
  - "StaffVerifyResult exported from verifyStaff.ts so import route can use its type"

patterns-established:
  - "TDD: mock captures and reflects update() payload args — test fails when implementation sends wrong value"
  - "Two-phase import: POST mode=validate (no DB), POST mode=import (confirms valid rows)"

requirements-completed: [ONBD-05, ONBD-06]

duration: 26min
completed: "2026-07-19"
---

# Phase 1 Plan 08: Member CSV Import + Claim Path Summary

**BOM-safe CSV import with validate-then-preview, 500-row cap, and phone-OTP claim linking 'invited' rows to mobile users**

## Performance

- **Duration:** ~26 min
- **Started:** 2026-07-19T17:31:37Z
- **Completed:** 2026-07-19T17:57:37Z
- **Tasks:** 3
- **Files modified:** 9

## Accomplishments

- parseMembersCsv pure library: handles UTF-8 BOM, 9 header aliases (Email Address/E-mail, Full Name/Member Name/Name, Phone Number/Mobile/Cell, First/Last Name), E.164 phone normalization (10-digit US → +1 prefix), in-file email+phone dedup (case-insensitive), no-phone warning, 14 tests
- POST /api/owner/members/import: two-phase validate-then-import, mode=validate is provably write-free, mode=import calls bulk_import_members RPC with only valid rows, invalid_count in response, 4 route tests
- /setup/import page: drag-drop zone, validate-on-select, green/red/amber summary chips, 10-row preview table, collapsible error list, client-side error CSV download (URL.createObjectURL, no round-trip), import button disabled when valid=0, full results state with mobile-claim note
- Claim path fix: findOrCreateMember now treats 'invited' same as 'pending' → 'in_progress' on first OTP login, 3 TDD tests
- Pre-existing blocker fixed: switched jest.config.js from babel-jest to ts-jest — Babel 7.29.0 cannot parse TypeScript inside jest.mock() factory functions (all 59 existing suites were failing)

## Task Commits

1. **Task 1 (RED):** `85263e9` (test) — failing tests for parseMembersCsv lib + import route
2. **Task 1 (GREEN):** `4247631` (feat) — parseMembersCsv lib + POST /api/owner/members/import route
3. **Task 2:** `96789d3` (feat) — /setup/import page (upload → preview → confirm → results)
4. **Task 3 (RED):** `458785a` (test) — failing claim-path test for 'invited' → 'in_progress'
5. **Task 3 (GREEN):** `ae8fd9d` (feat) — fix claim path, invited → in_progress on OTP

## Files Created/Modified

- `apps/web-admin/src/lib/import/parseMembersCsv.ts` — Pure CSV parser with header normalization and E.164 phone normalization
- `apps/web-admin/src/lib/import/__tests__/parseMembersCsv.test.ts` — 14 behaviors
- `apps/web-admin/src/app/api/owner/members/import/route.ts` — Two-phase import endpoint
- `apps/web-admin/src/app/api/owner/members/__tests__/import.test.ts` — 4 route tests
- `apps/web-admin/src/app/(onboard)/setup/import/page.tsx` — Upload→preview→confirm→results UI
- `apps/web-admin/src/app/api/auth/__tests__/verify-claim.test.ts` — 3 claim-path tests
- `apps/web-admin/src/app/api/auth/verify/route.ts` — One-line fix: 'invited' → 'in_progress'
- `apps/web-admin/src/lib/auth/verifyStaff.ts` — Export StaffVerifyResult interface
- `apps/web-admin/jest.config.js` — Switch to ts-jest transformer

## Decisions Made

- **Babel → ts-jest**: All 59 suites were failing due to Babel 7.29.0 breaking change (TypeScript syntax in jest.mock() factory bodies). Switched to ts-jest 29.4.9. Tests went from 0 passing to 342 passing (21 new tests from this plan added).
- **Claim email deferred**: No transactional email provider exists. Claim works via phone OTP (the spec's acceptance path). Rows without phone get a warning: "no phone — member cannot claim via mobile OTP".
- **Import valid-only**: Importing only valid rows (not all-or-nothing). Owner sees per-row validation report and confirms knowing which rows will be skipped.
- **StaffVerifyResult exported**: The type was private — exported to allow import route to type-narrow the auth result without casting.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Pre-existing jest.config.js Babel incompatibility**
- **Found during:** Task 1 (RED — running tests)
- **Issue:** All 59 web-admin test suites failed with Babel parse errors. Babel 7.29.0 raises `SyntaxError: Unexpected token` when encountering TypeScript annotations inside `jest.mock()` factory functions (hoisted code, TypeScript stripping runs too late). This was pre-existing before plan 01-08.
- **Fix:** Replaced `babel-jest` transform in jest.config.js with `ts-jest` (already available in node_modules)
- **Files modified:** `apps/web-admin/jest.config.js`
- **Verification:** 31 suites, 342 tests pass; tsc clean
- **Committed in:** `85263e9` (Task 1 RED commit — bundled with test files)

---

**Total deviations:** 1 auto-fixed (Rule 3 — blocking)
**Impact on plan:** Necessary infrastructure fix. No scope creep. All task tests pass.

## Issues Encountered

- Test for T1 (invited claim path) initially passed as a false positive because the mock returned `in_progress` regardless. Restructured mock to reflect the actual `update()` payload, which correctly showed the current implementation was wrong, then applied the fix. Both RED/GREEN phases accurate.

## User Setup Required

None — no external service configuration required. CSV import uses existing bulk_import_members RPC and standard staff auth.

## Next Phase Readiness

- CSV import fully functional; owners can upload member lists on the /setup/import page
- Phone-OTP claim link is complete; imported members enter normal onboarding funnel on first sign-in
- Plan 01-09 can proceed with real-device OTP claim verification checkpoint
- 342 tests passing, tsc clean, ts-jest infrastructure fixed for all future plans

---
*Phase: 01-gym-owner-self-serve-onboarding*
*Completed: 2026-07-19*

---
phase: 01-gym-owner-self-serve-onboarding
plan: "05"
subsystem: auth
tags: [next.js, supabase, react-hook-form, zod, typescript]

# Dependency graph
requires:
  - phase: 01-gym-owner-self-serve-onboarding/01-01
    provides: complete_gym_onboarding RPC + migration 027 schema
provides:
  - Public registration endpoint (POST /api/onboard/register) with atomic gym creation + rollback
  - GET /api/onboard/status for wizard resume state
  - (onboard)/ route group shell (unauthenticated, brand layout)
  - WizardProgress shared 4-step component
  - /signup form (Step 1) — react-hook-form + zod
  - /verify-email holding page (Step 2) — resend with 60s cooldown
affects: [01-06, 01-07, 01-08, 01-09]

# Tech tracking
tech-stack:
  added: ["@testing-library/jest-dom (wired via jest.setup.ts)"]
  patterns:
    - "Anon server client for signUp (sends email), admin client for DB writes + rollback"
    - "identities.length === 0 to detect duplicate email from Supabase signUp"
    - "deleteUser rollback pattern wrapping any post-signUp DB failure"
    - "jest.setup.ts + setupFilesAfterEnv for jest-dom matchers in web-admin"

key-files:
  created:
    - apps/web-admin/src/lib/validation/onboard.ts
    - apps/web-admin/src/app/api/onboard/register/route.ts
    - apps/web-admin/src/app/api/onboard/status/route.ts
    - apps/web-admin/src/app/api/onboard/__tests__/register.test.ts
    - apps/web-admin/src/app/api/onboard/__tests__/status.test.ts
    - apps/web-admin/src/app/(onboard)/layout.tsx
    - apps/web-admin/src/app/(onboard)/components/WizardProgress.tsx
    - apps/web-admin/src/app/(onboard)/components/__tests__/WizardProgress.test.tsx
    - apps/web-admin/src/app/(onboard)/signup/page.tsx
    - apps/web-admin/src/app/(onboard)/verify-email/page.tsx
    - apps/web-admin/jest.setup.ts
  modified:
    - apps/web-admin/middleware.ts
    - apps/web-admin/jest.config.js
    - apps/web-admin/tsconfig.json

key-decisions:
  - "anon server client (cookie-bound) handles signUp so confirmation email fires automatically; admin client handles all post-signup DB work"
  - "identities[] empty array is the Supabase-specific duplicate email signal — return 409 before touching DB"
  - "deleteUser rollback wraps both users-insert failure and RPC failure; wrapped in try/catch itself to prevent double-error masking"
  - "jest.setup.ts + setupFilesAfterEnv added (deviation Rule 3) — required by WizardProgress component tests"
  - "/api/onboard/ added to CSRF_EXEMPT — public registration must bypass CSRF since no session cookie exists at signup time"

patterns-established:
  - "Wizard route group (onboard)/ is fully unauthenticated — no auth gate in layout"
  - "WizardProgress props currentStep: 1|2|3|4 — reused by steps 3+4 in later plans"
  - "Component test files use @testing-library/react + jest-dom (now wired)"

requirements-completed: [ONBD-01, ONBD-02]

# Metrics
duration: 35min
completed: 2026-07-19
---

# Phase 1 Plan 05: (Onboard) Route Group + Registration API + Wizard Steps 1-2 Summary

**Public signup-to-email-verify flow with atomic gym creation (complete_gym_onboarding RPC), deleteUser rollback on failure, duplicate-email 409, and 4-step WizardProgress component**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-07-19T17:00:00Z
- **Completed:** 2026-07-19T17:35:00Z
- **Tasks:** 3
- **Files modified:** 13 (11 created, 2 modified + jest.setup.ts)

## Accomplishments
- POST /api/onboard/register: rate-limited, uses anon client for signUp (email fires), admin client for users row + complete_gym_onboarding RPC, deleteUser rollback on any DB failure
- GET /api/onboard/status: session-based resume endpoint returning gym_id/name/tier/email_confirmed/billing shape for steps 3-4
- (onboard)/ unauthenticated layout shell + WizardProgress (4 steps, aria-current, sr-only label, accent/completed/upcoming visual states)
- /signup page: full RHF + zod form (6 fields), 409 inline error with "Sign in instead" link, router.push to verify-email on success
- /verify-email page: resend with 60s cooldown timer, Suspense wrapper for useSearchParams, missing-email redirects to /signup

## Task Commits

1. **Task 1: onboardRegisterSchema + APIs + CSRF exemption** - `35e45f3` (feat)
2. **Task 2: (onboard) layout + WizardProgress + signup page** - `51e676b` (feat)
3. **Task 3: verify-email holding page** - `402247f` (feat)

## Files Created/Modified
- `apps/web-admin/src/lib/validation/onboard.ts` - onboardRegisterSchema (7-field zod schema)
- `apps/web-admin/src/app/api/onboard/register/route.ts` - POST registration endpoint with rollback
- `apps/web-admin/src/app/api/onboard/status/route.ts` - GET session-based wizard resume endpoint
- `apps/web-admin/src/app/api/onboard/__tests__/register.test.ts` - 5 TDD tests (invalid, happy, dup, rpc-fail, insert-fail)
- `apps/web-admin/src/app/api/onboard/__tests__/status.test.ts` - 2 tests (401, 200 shape)
- `apps/web-admin/src/app/(onboard)/layout.tsx` - Unauthenticated brand shell
- `apps/web-admin/src/app/(onboard)/components/WizardProgress.tsx` - 4-step progress indicator
- `apps/web-admin/src/app/(onboard)/components/__tests__/WizardProgress.test.tsx` - 5 tests
- `apps/web-admin/src/app/(onboard)/signup/page.tsx` - Step 1 signup form (RHF + zod)
- `apps/web-admin/src/app/(onboard)/verify-email/page.tsx` - Step 2 holding screen with resend
- `apps/web-admin/jest.setup.ts` - @testing-library/jest-dom import
- `apps/web-admin/middleware.ts` - Added /api/onboard/ to CSRF_EXEMPT
- `apps/web-admin/jest.config.js` - Added setupFilesAfterEnv
- `apps/web-admin/tsconfig.json` - Added jest + jest-dom types

## Decisions Made
- anon server client handles signUp (fires confirmation email); admin client handles all post-signUp DB operations — two-client pattern separates email delivery from privileged writes
- identities.length === 0 is the Supabase-documented duplicate email signal — allows 409 before any DB insertion
- deleteUser rollback is best-effort (wrapped in try/catch) so a failed cleanup doesn't mask the original error

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added jest.setup.ts + @testing-library/jest-dom wiring**
- **Found during:** Task 2 (WizardProgress component tests)
- **Issue:** jest.config.js had no `setupFilesAfterEnv` — toBeInTheDocument and toHaveAttribute not available
- **Fix:** Created jest.setup.ts importing jest-dom; added setupFilesAfterEnv to jest.config.js; added jest + jest-dom to tsconfig.json types
- **Files modified:** jest.setup.ts, jest.config.js, tsconfig.json
- **Verification:** All 5 WizardProgress tests pass, tsc clean
- **Committed in:** 51e676b (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 3 - blocking test infrastructure)
**Impact on plan:** Necessary to support component testing. No scope creep.

## Issues Encountered
- status.test.ts: initial mock factory referenced out-of-scope `buildAdminFromMock` — jest hoists mocks before variable declarations. Fixed by using a `mockCreateClient` prefixed variable (per-jest convention) and moving builder to test scope.

## User Setup Required
The plan frontmatter specifies one Supabase configuration task:
- Add `{NEXT_PUBLIC_APP_URL}/subscribe` (prod + localhost:3000) to Redirect URLs allowlist in Supabase Dashboard -> Authentication -> URL Configuration -> Redirect URLs.

This is required for the email verification link to redirect correctly.

## Next Phase Readiness
- /signup and /verify-email are fully functional
- /api/onboard/register and /api/onboard/status are ready for steps 3-4 (subscribe, setup) to consume
- WizardProgress accepts currentStep 1|2|3|4 — plans 06-07 can import it for steps 3-4
- 312 web-admin tests passing, tsc clean

---
*Phase: 01-gym-owner-self-serve-onboarding*
*Completed: 2026-07-19*

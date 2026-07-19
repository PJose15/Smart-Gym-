---
phase: 01-gym-owner-self-serve-onboarding
plan: 06
subsystem: payments
tags: [stripe, react, next-js, supabase, onboarding]

requires:
  - phase: 01-gym-owner-self-serve-onboarding
    plan: 02
    provides: createCheckoutSession with urls param, stripe webhook handlers
  - phase: 01-gym-owner-self-serve-onboarding
    plan: 05
    provides: /api/onboard/status route, (onboard)/ route group, WizardProgress component

provides:
  - GET /api/billing/prices — live Stripe price fetch with 1-hour module-level cache
  - POST /api/billing/checkout — context-aware (onboarding vs default) success/cancel URLs
  - subscribe/page.tsx — Step 3: PKCE code exchange, session refresh, tier picker, resume banner
  - TierCard.tsx — reusable tier card with price rendering, Most Popular pill, feature bullets

affects:
  - 01-09-plan (Stripe E2E checkpoint — prices + checkout tested end-to-end with stripe listen)
  - subscribe page depends on /api/onboard/status from plan 01-05

tech-stack:
  added: []
  patterns:
    - Module-level in-memory cache with TTL for read-heavy Stripe price lookups
    - PKCE code exchange pattern for Supabase email-link verification (exchangeCodeForSession + refreshSession)
    - Context-aware checkout URLs — onboarding context overrides default billing return URLs
    - Supabase light session check (getSession) for read-only endpoints instead of full verifyStaff

key-files:
  created:
    - apps/web-admin/src/app/api/billing/prices/route.ts
    - apps/web-admin/src/app/(onboard)/subscribe/page.tsx
    - apps/web-admin/src/app/(onboard)/components/TierCard.tsx
    - apps/web-admin/src/app/api/billing/__tests__/checkout-context.test.ts
  modified:
    - apps/web-admin/src/app/api/billing/checkout/route.ts
    - apps/web-admin/src/lib/validation/staff.ts

key-decisions:
  - "checkoutSchema extended with context: z.enum(['onboarding']).optional() — invalid enum values rejected 400"
  - "Onboarding context builds successUrl→/setup and cancelUrl→/subscribe; default context passes undefined (preserves existing billing page URLs)"
  - "prices route uses getSession (light check) not verifyStaff — read-only data, cheaper"
  - "Module-level pricesCache { data, fetchedAt } with 1-hour TTL — avoids Stripe API hammering on wizard re-renders"
  - "_resetPricesCache exported for test isolation — allows each test to start with cold cache"
  - "PKCE code exchange: strip ?code param via router.replace('/subscribe') after exchange to prevent re-exchange on refresh"
  - "Always call refreshSession after exchangeCodeForSession — membership row created after JWT was issued (Pitfall 3)"
  - "Resume banner shown when has_customer=true AND has_subscription=false (abandoned or cancelled checkout)"
  - "Auto-redirect to /setup when has_subscription=true — owner already completed checkout"

patterns-established:
  - "Pattern: prices cache — module-level { data, fetchedAt } object with TTL check; export _resetX for tests"
  - "Pattern: PKCE + refresh — always exchangeCodeForSession then refreshSession before fetching protected data"
  - "Pattern: abandon detection — has_customer && !has_subscription signals incomplete checkout"

requirements-completed: [ONBD-01, ONBD-03]

duration: 17min
completed: 2026-07-19
---

# Phase 01 Plan 06: Subscribe Page + Checkout Context Summary

**Stripe Checkout Step 3 — PKCE session handshake, live price tier cards with 1-hr cache, context-aware onboarding return URLs, and abandoned-checkout resume banner**

## Performance

- **Duration:** 17 min
- **Started:** 2026-07-19T17:31:30Z
- **Completed:** 2026-07-19T17:49:05Z
- **Tasks:** 2
- **Files modified:** 6 (4 created, 2 modified)

## Accomplishments

- Checkout route extended with `context: 'onboarding'` — returns to /setup on success and /subscribe on cancel instead of /owner/billing
- New GET /api/billing/prices route fetches all 6 (tier, interval) combos from Stripe, caches them module-level for 1 hour, returns null per combo on env-var miss (dev-safe)
- Subscribe page (Step 3): exchanges PKCE code from email link, refreshes session to get fresh RLS token, fetches /api/onboard/status, shows tier picker with live prices, handles abandoned checkout with resume banner, auto-redirects already-subscribed owners to /setup
- TierCard component with DOC_03 tokens — highlighted Growth card with Most Popular pill, feature bullets, price/month display, spinner + disable-all during pending checkout

## Task Commits

1. **Task 1: Context-aware checkout route + live prices endpoint** - `2f69d3d` (feat)
2. **Task 2: Subscribe page (Step 3) with session handshake and resume banner** - `9908a98` (feat)

## Files Created/Modified

- `apps/web-admin/src/app/api/billing/prices/route.ts` — GET live Stripe prices with 1hr cache; returns null gracefully when price env vars missing
- `apps/web-admin/src/app/api/billing/checkout/route.ts` — extended with context-aware URL building for onboarding context
- `apps/web-admin/src/lib/validation/staff.ts` — checkoutSchema + optional context enum
- `apps/web-admin/src/app/(onboard)/subscribe/page.tsx` — Step 3: full session handshake + tier picker + resume banner
- `apps/web-admin/src/app/(onboard)/components/TierCard.tsx` — reusable tier card component
- `apps/web-admin/src/app/api/billing/__tests__/checkout-context.test.ts` — 5 tests covering onboarding URLs, default flow, invalid context, prices fetch, cache TTL

## Decisions Made

- checkoutSchema extended with `context: z.enum(['onboarding']).optional()` — invalid enum values (e.g. 'bad-value') return 400
- Onboarding context builds `successUrl` pointing to `/setup?checkout=success&session_id={CHECKOUT_SESSION_ID}` and `cancelUrl` to `/subscribe?cancelled=true`; default context (no context field) passes `undefined` as 5th arg, preserving existing behavior
- prices route uses `getSession` (light session check) not `verifyStaff` — read-only harmless data, avoids ownership check overhead
- `_resetPricesCache()` exported for test isolation — Jest import caching means the module-level cache persists across calls within a test; reset in beforeEach ensures cold cache per test
- PKCE code exchange: strip `?code` param via `router.replace('/subscribe')` after exchange to prevent re-exchange on refresh
- Always call `refreshSession()` after `exchangeCodeForSession()` — membership row was created after the JWT was issued (Pitfall 3 from research)
- Resume banner conditions: `has_customer && !has_subscription` (covers both cancelled=true and prior abandoned attempts)
- Auto-redirect to `/setup` when `has_subscription=true` — owner already completed checkout, skip Step 3

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

- Babel `jest.mock` factory: TypeScript type annotations `(...args: unknown[])` in jest.mock factories cause SyntaxError with this project's Babel setup; fixed by using `function(...args: any[])` pattern with eslint-disable comment.
- `jest.clearAllMocks()` cleared `mockPricesRetrieve` between Test 4a and 4b, combined with cache TTL causing 4b to return 0 Stripe calls; fixed by adding `_resetPricesCache()` call in prices `beforeEach` to ensure cold cache per test.

## Next Phase Readiness

- Step 3 complete: verified owner can reach Stripe Checkout with correct return URLs (success → /setup, cancel → /subscribe)
- Abandonment is resumable with no duplicate Stripe customers (get-or-create customer ID already in checkout route)
- Stripe test-mode end-to-end deferred to plan 01-09 checkpoint (needs `stripe listen`)
- Next plan: 01-07 (first-machine wizard) or 01-08 (CSV member import)

---
*Phase: 01-gym-owner-self-serve-onboarding*
*Completed: 2026-07-19*

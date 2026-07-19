---
phase: 01-gym-owner-self-serve-onboarding
plan: 02
subsystem: payments
tags: [stripe, webhooks, idempotency, checkout, billing]

# Dependency graph
requires: []
provides:
  - Idempotency guard on handleStripeWebhook via stripe_events_processed table
  - checkout.session.completed handler — records stripe_subscription_id, sets trialing
  - checkout.session.expired handler — keeps trialing status (retryable, not cancelled)
  - Hardened createCheckoutSession with payment_method_collection='always', trial cancel on missing payment method
  - URL override parameter on createCheckoutSession (needed by plan 01-06 onboarding flow)
affects: [01-06-onboarding-flow, billing-webhook-route, stripe-event-processing]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Insert-before-switch idempotency: insert event_id, treat empty/null result as duplicate → 200 no-op"
    - "Subscription id extraction: string | { id: string } narrowing for expanded vs non-expanded Stripe objects"
    - "Trial hardening: payment_method_collection='always' + trial_settings.end_behavior.missing_payment_method='cancel'"

key-files:
  created:
    - apps/web-admin/src/lib/billing/__tests__/stripeHelpers.test.ts
  modified:
    - apps/web-admin/src/lib/billing/stripeHelpers.ts

key-decisions:
  - "Idempotency via insert-before-switch: on unique violation Supabase returns empty/null data — both treated as duplicate, not thrown"
  - "checkout.session.completed sets trialing (not active) — authoritative sync still happens via customer.subscription.updated which fires immediately after"
  - "checkout.session.expired sets trialing (not cancelled) — retryable; owner can restart checkout without support intervention"
  - "createCheckoutSession URLs made optional override params — backward-compatible, plan 01-06 passes onboarding-specific URLs"

patterns-established:
  - "Duplicate guard pattern: .insert().select('event_id') → empty array = dupe, never throw on 200 path"
  - "Subscription object narrowing: typeof rawSub === 'string' ? rawSub : rawSub?.id"

requirements-completed: [ONBD-03]

# Metrics
duration: 6min
completed: 2026-07-19
---

# Phase 1 Plan 02: Stripe Webhook Hardening Summary

**Idempotency guard via stripe_events_processed insert-before-switch, checkout.session.completed/expired handlers, and hardened createCheckoutSession with payment-method collection and trial cancel behavior**

## Performance

- **Duration:** 6 min
- **Started:** 2026-07-19T16:37:34Z
- **Completed:** 2026-07-19T16:43:13Z
- **Tasks:** 2 (combined into single TDD cycle across both files)
- **Files modified:** 2

## Accomplishments

- Webhook is now replay-safe: Stripe's 3-day retry loop cannot corrupt gym_billing via duplicate events
- checkout.session.completed records the subscription id and confirms trialing state on first completion
- checkout.session.expired leaves gym in retryable trialing state (owner can restart checkout)
- createCheckoutSession always collects a payment method and cancels trial if none provided at trial end
- URL override param enables plan 01-06 to pass onboarding-specific success/cancel URLs

## Task Commits

1. **Task 1 + Task 2: Idempotency guard, checkout handlers, hardened createCheckoutSession** - `f0f05b1` (feat)

_Note: Both TDD tasks were merged into a single commit — RED phase ran with both failing suites, GREEN addressed all 13 tests in one implementation pass._

## Files Created/Modified

- `apps/web-admin/src/lib/billing/stripeHelpers.ts` — Added idempotency guard before switch, checkout.session.completed + expired handlers, hardened createCheckoutSession signature
- `apps/web-admin/src/lib/billing/__tests__/stripeHelpers.test.ts` — 13 new tests covering all 6 plan behaviors plus edge cases (null data duplicate, object-form subscription, partial URL override)

## Decisions Made

- Idempotency treats both `data: []` and `data: null` as duplicate — Supabase returns null data on error, empty array on conflict with `.select()`. Both must short-circuit to avoid throwing.
- checkout.session.completed sets status to `trialing` (not `active`) — the definitive subscription state sync still happens via the existing `customer.subscription.updated` handler which Stripe fires immediately after checkout. The completed handler only records the subscription id.
- checkout.session.expired keeps `trialing` (not `cancelled`) — retryable state means the gym owner can restart checkout without needing a support intervention to reset their status.

## Deviations from Plan

None — plan executed exactly as written. The `mockInsertState.value` indirection pattern was needed to work around Jest's `jest.mock()` hoisting restriction (variables inside factory must be `mock`-prefixed), but this is a test implementation detail, not a plan deviation.

## Issues Encountered

Jest 29 + Babel hoisting: `jest.mock()` factory cannot reference module-scope `const`/`let` variables unless they are prefixed with `mock` (case-insensitive). Resolved by using a `mockInsertState` container object whose `.value` is read at call time inside the factory — gives per-test mutability without breaking the hoisting constraint.

## User Setup Required

None — no external service configuration required. The `stripe_events_processed` table must exist in the database schema (verify via migration check in plan 01-01).

## Next Phase Readiness

- `handleStripeWebhook` is now idempotency-safe and handles all checkout lifecycle events
- `createCheckoutSession` accepts `urls` override — plan 01-06 can pass onboarding-specific redirect URLs
- 296 tests pass, tsc clean — no regressions

---
*Phase: 01-gym-owner-self-serve-onboarding*
*Completed: 2026-07-19*

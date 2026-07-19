---
phase: 01-gym-owner-self-serve-onboarding
verified: 2026-07-19T19:05:43Z
status: human_needed
score: 18/18 automated must-haves verified
human_verification:
  - test: "Signup → email verify → Stripe Checkout (ONBD-01/02/03) — Step 1-3 of walkthrough"
    expected: "Private window signup at /signup creates account + gym atomically, lands on /verify-email showing the address, email link exchanges code and drops user on /subscribe with live tier prices (step 3 highlighted), Stripe Checkout with 4242 card completes and redirects to /setup with 'Subscription active' banner"
    why_human: "Requires real Stripe test mode, live SMTP delivery, PKCE code exchange — cannot be simulated with grep or unit mocks"
  - test: "Abandoned checkout resume (ONBD-03) — Step 4 of walkthrough"
    expected: "Second gym signs up, reaches Stripe Checkout, closes tab, returns to /subscribe and sees 'Complete your subscription' banner; retrying reuses the same Stripe customer (no duplicate)"
    why_human: "Requires Stripe webhook forwarding (stripe listen), real checkout session lifecycle, and Stripe Dashboard inspection"
  - test: "Webhook idempotency (ONBD-03) — Step 5 of walkthrough"
    expected: "stripe events resend <id> returns 200 and server logs show action: 'duplicate' with gym_billing unchanged"
    why_human: "Requires stripe CLI replay against a live dev server with STRIPE_WEBHOOK_SECRET set"
  - test: "Machine wizard QR scan (ONBD-04) — Step 6 of walkthrough"
    expected: "Create 'Lat Pulldown' in /setup, download QR PDF, scan QR with phone camera, /m/<qr_slug> machine landing page loads on the device"
    why_human: "Physical QR scan with a real camera on a real device; PDF generation + scan URL correctness cannot be verified programmatically"
  - test: "CSV import validate-then-confirm round trip (ONBD-05) — Step 7 of walkthrough"
    expected: "Upload a real Excel-exported CSV with BOM + a bad-email row + a duplicate; preview shows correct valid/invalid split with per-row errors and a downloadable error CSV; confirm shows 'N imported, M skipped'"
    why_human: "Requires a live browser session, file upload interaction, and real CSV file from Excel/Sheets"
  - test: "Mobile phone-OTP member claim (ONBD-06) — Step 8 of walkthrough"
    expected: "Sign in on mobile Expo build with the phone number from the CSV; member flow shows name pre-filled; web members list shows row is no longer 'invited' with no duplicate row created"
    why_human: "Requires a physical device, Expo dev build, Supabase phone OTP, and cross-platform state inspection"
  - test: "Dashboard checklist + trial countdown (ONBD-07) — Step 9 of walkthrough"
    expected: "Owner dashboard shows 'X days left' trial banner (approx 30) and setup checklist with checkmarks reflecting actual DB state (machine added = checked, members imported = checked)"
    why_human: "Requires an owner session with real gym data from steps 6-8; visual correctness of the checklist and countdown cannot be verified without a running app"
---

# Phase 1: Gym Owner Self-Serve Onboarding — Verification Report

**Phase Goal:** A gym owner can go from landing page to a working, billed gym — account, plan, first machine QR, and imported members — with zero human intervention
**Verified:** 2026-07-19T19:05:43Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A visitor with no session can load /signup and submit the form — no auth redirect | VERIFIED | `(onboard)/layout.tsx` is 50 lines with no auth check; middleware `updateSession` performs no redirects (confirmed in plan 01-05 interfaces) |
| 2 | Registering creates auth user + gym + membership + settings + billing atomically; RPC failure rolls back and deletes auth user (no orphans) | VERIFIED | `register/route.ts` calls `signUp` then `complete_gym_onboarding` RPC; both failure paths call `admin.auth.admin.deleteUser`; RPC is a `SECURITY DEFINER` plpgsql function wrapping all four INSERTs in one transaction |
| 3 | Duplicate email returns 409, not 500 | VERIFIED | `register/route.ts` line 59: detects `identities.length === 0` from Supabase obfuscated-user response and returns 409 |
| 4 | After signup owner lands on verify-email screen showing their address, with resend + 60s cooldown | VERIFIED | `verify-email/page.tsx` 233 lines; `cooldown` state + countdown `useEffect` + `supabase.auth.resend()` all present |
| 5 | Wizard shows 4-step progress indicator with current step highlighted | VERIFIED | `WizardProgress.tsx` 121 lines; `aria-current="step"` on active segment; sr-only "Step N of 4"; all four wizard pages pass the correct `currentStep` prop |
| 6 | Email link lands owner on /subscribe with live session (code exchanged) and gym context loaded | VERIFIED | `subscribe/page.tsx` lines 191, 201: `exchangeCodeForSession` + `refreshSession` on mount when `?code` param present; then fetches `/api/onboard/status` for gym context |
| 7 | Owner picks tier, reaches Stripe Checkout; completing returns to /setup, cancelling to /subscribe | VERIFIED | `checkout/route.ts` builds `urls` object when `context === 'onboarding'`; `subscribe/page.tsx` POSTs `{ tier, interval, context: 'onboarding' }` and calls `window.location.assign(checkout_url)` |
| 8 | Abandoned-checkout owner sees resume banner; no duplicate Stripe customer created | VERIFIED | `subscribe/page.tsx` line 333: resume banner condition checks `has_customer && !has_subscription && wasCancelled`; customer reuse is handled by the existing `get-or-create` pattern in the checkout route |
| 9 | Webhook replaying the same event ID returns `{ action: 'duplicate' }` with no DB writes | VERIFIED | `stripeHelpers.ts` line 94: inserts into `stripe_events_processed` BEFORE the switch; empty `data` returns `{ action: 'duplicate' }` |
| 10 | `checkout.session.completed` stores subscription id on gym_billing; `checkout.session.expired` keeps trialing state | VERIFIED | `stripeHelpers.ts` lines 198, 225: both cases handled; completed updates `stripe_subscription_id` + `subscription_status: 'trialing'`; expired sets `subscription_status: 'trialing'` |
| 11 | POST /api/machines creates a machine with server-generated qr_slug; unauthenticated callers get 401/403 | VERIFIED | `machines/route.ts` calls `verifyStaff('owner')`, imports `generateQrSlug`, has collision retry via unique-violation check |
| 12 | One MachineForm component serves both the /machines CRUD page and the onboarding wizard | VERIFIED | `MachineForm.tsx` 398 lines with `minimal` prop; imported in both `machines/page.tsx` (line 10) and `setup/page.tsx` (line 6) |
| 13 | Owner dashboard shows setup checklist reflecting actual DB state and trial countdown | VERIFIED | `onboarding-status/route.ts` runs 4 parallel count queries; `dashboard/page.tsx` imports and renders `SetupChecklist` + `TrialCountdownBanner` from live fetch |
| 14 | A just-subscribed owner creates their first machine in /setup; can skip; gets QR PDF download | VERIFIED | `setup/page.tsx` 517 lines: state machine `machine-form → creating → qr-ready`; MachineForm minimal POST to `/api/machines`; qr-pdf anchor link on line 436; "Skip for now" link to `/setup/import` on line 497 |
| 15 | Owner uploads CSV, sees validate-then-import preview with per-row errors before any writes | VERIFIED | `import/page.tsx` 563 lines: validate phase POSTs `mode: validate` and shows preview; confirm POSTs `mode: import`; import route performs zero DB access in validate mode |
| 16 | BOM-safe CSV parse handles header aliases; 500-row cap enforced | VERIFIED | `parseMembersCsv.ts` 238 lines: `bom: true` + manual BOM strip; `normalizeHeader` with alias table; route enforces `total <= 500` |
| 17 | Imported member (phone in CSV) signs in via phone OTP and links to invited row, no duplicate | VERIFIED | `verify/route.ts` line 192: `(onboarding_status === 'pending' \|\| onboarding_status === 'invited') ? 'in_progress'`; test T1 in `verify-claim.test.ts` covers this exact path |
| 18 | Migration 027 is applied to the live DB (stripe_events_processed, both RPCs, 'invited' status) | VERIFIED | Stated as confirmed via PostgREST probes in the prompt; migration file is 217 lines with all 4 sections confirmed |

**Score:** 18/18 truths verified (all automated checks pass)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/027_owner_onboarding.sql` | 4 DB objects | VERIFIED | 217 lines; all 4 sections confirmed; applied to live DB |
| `apps/web-admin/package.json` | react-hook-form, @hookform/resolvers, csv-parse | VERIFIED | All 3 present: `^7.82.0`, `^3.10.0`, `^5.6.0` |
| `apps/web-admin/src/lib/billing/stripeHelpers.ts` | Idempotency + checkout handlers + hardened createCheckoutSession | VERIFIED | 272 lines; all patterns confirmed |
| `apps/web-admin/src/lib/billing/__tests__/stripeHelpers.test.ts` | Unit tests min 100 lines | VERIFIED | 279 lines |
| `apps/web-admin/src/app/api/machines/route.ts` | POST with verifyStaff, Zod, server-side qr_slug | VERIFIED | Exports `GET` + `POST`; all patterns confirmed |
| `apps/web-admin/src/components/machines/MachineForm.tsx` | Shared form with `minimal` prop, min 80 lines | VERIFIED | 398 lines; `minimal` prop + `MachineFormValues` interface present |
| `apps/web-admin/src/lib/validation/machines.ts` | machineCreateSchema | VERIFIED | Exports `machineCreateSchema` and `MachineCreateInput` |
| `apps/web-admin/src/app/api/owner/onboarding-status/route.ts` | GET checklist + trial state | VERIFIED | Exports `GET`; runs 4 queries; `computeDaysRemaining` in `types.ts` |
| `apps/web-admin/src/components/owner/SetupChecklist.tsx` | Checklist card, min 40 lines | VERIFIED | 167 lines |
| `apps/web-admin/src/components/owner/TrialCountdownBanner.tsx` | Trial countdown + upgrade CTA, min 25 lines | VERIFIED | 64 lines |
| `apps/web-admin/src/app/api/onboard/register/route.ts` | Public registration: signUp + RPC + rollback | VERIFIED | 110 lines; exports `POST`; all rollback paths confirmed |
| `apps/web-admin/src/app/(onboard)/layout.tsx` | Unauthenticated brand shell, min 20 lines | VERIFIED | 50 lines; no auth check |
| `apps/web-admin/src/app/(onboard)/signup/page.tsx` | Step 1 react-hook-form + zodResolver, min 80 lines | VERIFIED | 364 lines; `useForm` + `zodResolver` + `onboardRegisterSchema` |
| `apps/web-admin/src/app/(onboard)/verify-email/page.tsx` | Step 2 resend + cooldown, min 30 lines | VERIFIED | 233 lines; cooldown timer + `supabase.auth.resend()` |
| `apps/web-admin/src/app/api/onboard/status/route.ts` | Session-based onboarding state | VERIFIED | 66 lines; exports `GET` |
| `apps/web-admin/src/lib/validation/onboard.ts` | onboardRegisterSchema | VERIFIED | Exports `onboardRegisterSchema` and `OnboardRegisterInput` |
| `apps/web-admin/src/app/api/billing/checkout/route.ts` | Context-aware checkout with onboarding URLs | VERIFIED | Contains "onboarding" twice; builds `urls` object when `context === 'onboarding'` |
| `apps/web-admin/src/app/api/billing/prices/route.ts` | Live Stripe prices, cached | VERIFIED | Exports `GET`; `cache.ts` sibling exists |
| `apps/web-admin/src/app/(onboard)/subscribe/page.tsx` | Step 3: code exchange, tier picker, resume banner, min 100 lines | VERIFIED | 423 lines; all patterns confirmed |
| `apps/web-admin/src/app/(onboard)/components/TierCard.tsx` | Tier card component | VERIFIED | Exists in `(onboard)/components/` |
| `apps/web-admin/src/app/(onboard)/setup/page.tsx` | Step 4: first-machine wizard, min 100 lines | VERIFIED | 517 lines; all patterns confirmed |
| `apps/web-admin/src/app/(onboard)/setup/__tests__/setup-wizard.test.tsx` | 4 wizard behaviors | VERIFIED | 234 lines; T1-T4 all present |
| `apps/web-admin/src/lib/import/parseMembersCsv.ts` | Pure CSV parse + normalization | VERIFIED | 238 lines; exports `parseMembersCsv` and `normalizeHeader` |
| `apps/web-admin/src/app/api/owner/members/import/route.ts` | Two-phase validate-then-import | VERIFIED | Exports `POST`; validate mode confirmed write-free; import calls `bulk_import_members` RPC |
| `apps/web-admin/src/app/(onboard)/setup/import/page.tsx` | Upload/preview/confirm/results, min 120 lines | VERIFIED | 563 lines; all 4 UI states confirmed |
| `apps/web-admin/src/app/api/auth/verify/route.ts` | 'invited' claim path | VERIFIED | Line 192: invited + pending both map to 'in_progress' |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `complete_gym_onboarding RPC` | gyms, gym_memberships, gym_settings, gym_billing | single plpgsql transaction | WIRED | Migration line 103: `INSERT INTO gym_billing` confirmed |
| `bulk_import_members RPC` | members table | jsonb loop with duplicate skip | WIRED | Migration line 197: `onboarding_status = 'invited'` confirmed |
| `handleStripeWebhook` | stripe_events_processed table | insert-before-switch idempotency | WIRED | `stripeHelpers.ts` line 94: `.from('stripe_events_processed')` before switch |
| `checkout.session.completed` | gym_billing | session.metadata.gym_id | WIRED | `stripeHelpers.ts` line 198: case handler confirmed |
| `machines/route.ts` POST | generateQrSlug from @nexera/utils | gym slug lookup + server-side slug | WIRED | Lines 2,5,57: import + usage confirmed |
| `machines/page.tsx` | components/machines/MachineForm | import + render | WIRED | Line 10 import + line 436 render confirmed |
| `owner/dashboard/page.tsx` | /api/owner/onboarding-status | fetch on mount | WIRED | Lines 9-10 imports; line 37 fetch; lines 126,131 renders confirmed |
| `onboarding-status/route.ts` | machines, members, machine_scan_events, gym_billing | count queries | WIRED | Line 25: `machine_scan_events` count query confirmed |
| `signup/page.tsx` | /api/onboard/register | fetch POST on RHF handleSubmit | WIRED | Lines 4-5 RHF imports; line 173 fetch confirmed |
| `register/route.ts` | complete_gym_onboarding RPC | admin.rpc | WIRED | Line 89: `admin.rpc('complete_gym_onboarding', ...)` confirmed |
| `middleware.ts` | /api/onboard/ routes | CSRF_EXEMPT entry | WIRED | Line 10: `'/api/onboard/'` in CSRF_EXEMPT confirmed |
| `register failure path` | admin.auth.admin.deleteUser | rollback on RPC/insert error | WIRED | Lines 81, 102: deleteUser called in both failure branches |
| `subscribe/page.tsx` | supabase.auth.exchangeCodeForSession | on-mount ?code handling | WIRED | Line 191: `exchangeCodeForSession(code)` + line 201: `refreshSession()` confirmed |
| `subscribe/page.tsx` | /api/billing/checkout | POST { tier, interval, context: 'onboarding' } | WIRED | Line 268: fetch POST with context confirmed |
| `checkout/route.ts` | createCheckoutSession urls param | context === 'onboarding' -> /setup and /subscribe URLs | WIRED | Line 31-34: urls object with /setup and /subscribe confirmed |
| `setup/page.tsx` | POST /api/machines | MachineForm minimal onSubmit | WIRED | Line 308: `fetch('/api/machines', ...)` confirmed |
| `setup/page.tsx` | GET /api/machines/qr-pdf | download link on success step | WIRED | Line 436: anchor href `/api/machines/qr-pdf` confirmed |
| `import/route.ts` | bulk_import_members RPC | admin.rpc on confirmed import | WIRED | Lines 99: `admin.rpc('bulk_import_members', ...)` confirmed |
| `setup/import/page.tsx` | /api/owner/members/import | FormData POST, validate then import | WIRED | Lines 249, 289: both mode phases confirmed |
| `verify/route.ts` | invited members | 'invited' status → 'in_progress' on link | WIRED | Line 192: `onboarding_status === 'invited'` branch confirmed |

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|---------------|-------------|--------|----------|
| ONBD-01 | 01-05, 01-06, 01-09 | 4-step wizard with no human intervention | SATISFIED | `/signup` → `/verify-email` → `/subscribe` → `/setup` fully wired; layout has no auth check |
| ONBD-02 | 01-01, 01-05, 01-09 | Atomic gym creation, resumable, no orphaned users | SATISFIED | `complete_gym_onboarding` RPC is a single transaction; register route has dual rollback paths; `status` route enables resume |
| ONBD-03 | 01-02, 01-06, 01-09 | Stripe checkout safe + retry/abandonment paths | SATISFIED | Idempotency table wired before switch; checkout.session.completed/expired handled; resume banner on /subscribe; payment_method_collection + trial_settings.end_behavior hardened |
| ONBD-04 | 01-03, 01-07, 01-09 | First-machine wizard: zero machines → printable QR | SATISFIED | POST /api/machines with server-side qr_slug + collision retry; /setup step machine-form→qr-ready state machine; QR PDF download link present |
| ONBD-05 | 01-08, 01-09 | Bulk CSV import with validate-then-import flow | SATISFIED | parseMembersCsv with BOM safety + header aliases + 500-row cap; two-phase import route; 4-state import page with preview, error report download |
| ONBD-06 | 01-08, 01-09 | Imported members claim accounts on mobile | SATISFIED | verify/route.ts links 'invited' rows on phone OTP match; transitions to 'in_progress'; test T1 in verify-claim.test.ts confirms behavior |
| ONBD-07 | 01-04, 01-09 | Dashboard setup checklist + trial countdown | SATISFIED | onboarding-status route with live DB counts; SetupChecklist + TrialCountdownBanner wired into owner dashboard |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `signup/page.tsx` | 234, 251, 280, 306, 323 | `placeholder="..."` in form inputs | Info | HTML input placeholder attributes — not stubs |

No functional anti-patterns found. All route handlers return real data; no `return null` stubs; no `console.log`-only implementations; no empty handlers.

### Human Verification Required

#### 1. Full End-to-End Onboarding Walkthrough (9 steps)

**Test:** Run the walkthrough documented in `01-09-PLAN.md` Task 2 against the dev environment with Stripe CLI forwarding. Two terminals: `pnpm dev` in T1, `stripe listen --forward-to localhost:3000/api/billing/webhook` in T2.

Step-by-step:

1. Open `http://localhost:3000/signup` in private window. Create account + new gym. Expected: step-1 progress indicator, validation errors on bad input, redirect to `/verify-email` showing your address.
2. Click the verification email link. Expected: land on `/subscribe` with tier cards showing real Stripe prices (step 3 highlighted), no login prompt.
3. Pick Growth monthly, Stripe Checkout with card `4242 4242 4242 4242`. Expected: redirect to `/setup` with "Subscription active" banner; T2 logs `checkout.session.completed → 200`; Stripe Dashboard shows subscription `trialing` with payment method.
4. Second private window: signup another gym, reach checkout, close tab, return to `/subscribe`. Expected: "Complete your subscription" banner; retry reuses same Stripe customer (one customer in Stripe Dashboard for that gym).
5. In T2: Ctrl+C, rerun `stripe listen`, run `stripe events resend <id-of-completed-event>`. Expected: 200 response, server logs `action: 'duplicate'`, gym_billing unchanged.
6. On `/setup`: create "Lat Pulldown" with 2 muscle groups. Expected: success panel with scan URL; download QR PDF; scan QR with phone camera → `/m/<qr_slug>` loads on device.
7. Create a CSV in Excel/Sheets with columns Name/Email/Phone — include your phone, one bad-email row, one duplicate row. Upload at `/setup/import`. Expected: preview shows correct split, row-level errors, downloadable error CSV; confirm shows "N imported, M skipped".
8. On mobile Expo dev build: sign in with the phone from the CSV against this gym. Expected: member flow with name pre-filled from import; web members list shows row no longer `invited`; no duplicate member row.
9. Open `/owner/dashboard` as the new owner. Expected: trial countdown banner (~30 days) and checklist with machine ✓, members ✓, QR per actual scan state.

**Why human:** Real Stripe checkout, live email delivery, PKCE code exchange, physical QR scan, Expo device, cross-platform member claim — none can be approximated with unit mocks.

### Gaps Summary

No automated gaps found. All 18 must-haves verified, all 26 artifacts confirmed substantive and wired, all 20 key links confirmed. The single blocking item is the deferred 9-step manual walkthrough from plan 01-09 Task 2, which the user explicitly deferred. All automated gates were reported green in the prompt (876 tests, tsc strict, ESLint clean, next build, Migration 027 applied live).

The phase goal is functionally complete in code. Status is `human_needed` because the journey-level truths — real Stripe checkout, physical QR scan, mobile OTP claim — require a live environment that cannot be verified programmatically.

---

_Verified: 2026-07-19T19:05:43Z_
_Verifier: Claude (gsd-verifier)_

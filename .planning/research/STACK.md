# Stack Research — SmartGym (NEXERA) Tier 1 Launch Blockers

**Domain:** Multi-tenant Gym SaaS — Stripe self-serve onboarding, CSV import, push orchestration, mobile feed UI, webhook fanout, wizard forms
**Researched:** 2026-06-03
**Confidence:** HIGH for Stripe/Expo (verified against existing codebase at API version `2026-03-25.dahlia` and Expo SDK 52); MEDIUM for csv-parse and FlashList (training-data + codebase evidence; web access blocked); HIGH for agent fanout and form library (codebase analysis is definitive)

---

## What's Already Locked (Do Not Re-research)

| Capability | Version | File |
|------------|---------|------|
| `stripe` npm lib | `21.0.1` | `apps/web-admin/package.json` |
| Stripe API version | `2026-03-25.dahlia` | `src/lib/billing/stripeClient.ts` |
| Stripe Checkout + Portal + webhook handler | wired, working | `src/app/api/billing/{checkout,portal,webhook}/route.ts` |
| `expo-notifications` | `^55.0.10` | `apps/mobile/package.json` |
| Expo SDK | `~52.0.0` | `apps/mobile/package.json` |
| Supabase Edge Function `send-push-notification` | deployed | `supabase/functions/send-push-notification/index.ts` |
| Agent trigger endpoint | wired, internal-key auth | `src/app/api/agents/trigger/route.ts` |
| `triggerUptimizeAIAgent()` helper | working | `src/lib/billing/triggerAgent.ts` |
| `zod` | `^4.3.6` | `apps/web-admin/package.json` |
| `zustand` | `^5.0.12` | `apps/web-admin/package.json` |
| `react-hook-form` / `@hookform` | **NOT installed** | confirmed via lock file scan |
| `@shopify/flash-list` | **NOT installed** | confirmed via lock file scan |
| `csv-parse` / `papaparse` | **NOT installed** | confirmed via lock file scan |

---

## Area 1 — Stripe Self-Serve Owner Onboarding

### Verdict: stripe-node `21.0.1` + existing Checkout is sufficient. No Stripe Connect needed.

**What already exists:**
- `createCheckoutSession()` in `stripeHelpers.ts` passes `subscription_data.trial_period_days: 30` — the 30-day trial is already wired.
- Webhook handler covers `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`, and `customer.subscription.trial_will_end`.
- Dunning is handled automatically by Stripe via `past_due` → `invoice.payment_failed` webhook; the existing handler already flips `subscription_status` to `past_due` and fires `revenue-agent`.
- Proration on plan upgrades: Stripe Billing computes this automatically when you change a subscription's price ID through the Customer Portal — no code needed. The Portal is already wired.

**What the onboarding wizard needs that is NOT yet there:**
1. A `payment_method_collection` choice: currently the checkout session does not specify this. For trial-first SaaS best practice, set `payment_method_collection: 'if_required'` on trial start so card capture is deferred until trial end, OR `'always'` to capture card upfront. The audit notes the onboarding flow does not yet exist — the wizard must decide. Recommended: `'always'` (card up-front, lower churn on conversion, Stripe's documented best practice for SaaS trials).
2. The checkout route today requires `verifyStaff('owner')` — meaning the gym and owner user must already exist in DB before checkout runs. The 4-step onboarding wizard must: (a) create the `gyms` row + `users` row + initial auth session first, then (b) redirect to Stripe Checkout. This is the critical ordering constraint for Phase 1.
3. No `trial_settings.end_behavior.missing_payment_method` is currently set. Add `trial_settings: { end_behavior: { missing_payment_method: 'cancel' } }` to `createCheckoutSession()` to prevent silent trial-to-active conversion when no card is on file.

**Stripe Connect: NOT needed.** Connect is for marketplace/platform models where the platform collects money on behalf of merchants. NEXERA is a direct B2B SaaS — the gym owner pays NEXERA directly. Standard Billing is the correct product.

**Stripe Billing vs plain Checkout:** The existing approach uses Checkout sessions (one-time redirect flow) with `mode: 'subscription'`. This is correct and production-ready. `stripe.billing` namespace (Meters, Subscriptions API) is only needed if you want server-side subscription creation without Checkout — there is no reason to switch.

**Plan picking in wizard vs Stripe-hosted page:** Keep plan selection in-app (the wizard shows tier cards). `checkoutSchema` already accepts `tier` and `interval` params. The Stripe Checkout page is only the payment capture step — no need to use Stripe's hosted pricing table.

**Dunning / automatic retries:** Already handled by Stripe's Smart Retries by default (no code needed). `invoice.payment_failed` webhook → `past_due` DB status → feature gating via `featureGate.ts` already restricts access. No additional dunning library needed.

**Must-add to existing `createCheckoutSession()`:**
```typescript
payment_method_collection: 'always',
trial_settings: {
  end_behavior: { missing_payment_method: 'cancel' },
},
```
**Files to modify:** `src/lib/billing/stripeHelpers.ts` (2-line addition to `createCheckoutSession`), `src/app/api/billing/checkout/route.ts` (no change needed — already accepts tier + interval).

**New env vars needed:** None for Stripe itself. The 6 existing `STRIPE_PRICE_*` env vars are already defined.

**Confidence:** HIGH — verified against actual codebase code and Stripe API version `2026-03-25.dahlia`.

---

## Area 2 — CSV Member Import

### Verdict: Add `csv-parse ^5.5.x` (server-side, streaming, TypeScript-native). Do NOT use PapaParse.

**Why csv-parse, not PapaParse:**
- PapaParse is browser-first. It works in Node but its TypeScript types are weaker, and its streaming API requires a callback pattern that doesn't compose cleanly with Next.js App Router's `Request.body` ReadableStream.
- `csv-parse` (`@csv-parse/sync` for small files, streaming `parse()` for large) is purpose-built for Node/server, ships its own TypeScript types, and has been the standard server-side CSV library since v4. Current stable is `5.5.x`.
- `zod-csv` is a thin wrapper; add it only if you want per-row Zod validation integrated directly into the parser. For this use case, validating rows with Zod inline is simpler and avoids an extra dependency.

**Pattern for the CSV import route (`POST /api/owner/members/import`):**

```typescript
import { parse } from 'csv-parse';
import { Readable } from 'stream';

// Stream the request body through csv-parse
const text = await request.text();            // fine for <5MB files
const records = await parseCSV(text);         // async generator or promisify
```

For files > 5 MB (bulk gym imports can be large), use streaming:

```typescript
import { parse } from 'csv-parse';
const parser = parse({ columns: true, skip_empty_lines: true, trim: true });
Readable.from(await request.text()).pipe(parser);
for await (const row of parser) { /* validate + upsert */ }
```

**Idempotency / deduplication pattern:**
- Use Supabase `upsert()` with `onConflict: 'gym_id,email'` — the existing `members` table likely has a `(gym_id, email)` unique constraint (verify before shipping).
- Wrap the import in a single transaction or process in batches of 100 rows. Supabase JS client does not expose explicit transactions; use `supabase.rpc()` calling a PL/pgSQL function for atomic batch insert, or accept row-by-row upsert with a summary response.
- Return `{ imported: N, skipped: M, errors: [{ row, reason }] }` — give the owner visibility.

**Error reporting:** `csv-parse` exposes per-row error context (`record`, `lines`). Collect errors into an array (do not fail the entire import on one bad row). Cap at 500 errors before aborting to prevent unbounded error arrays.

**Install:**
```bash
pnpm add csv-parse --filter web-admin
```

**Must-add route:** `apps/web-admin/src/app/api/owner/members/import/route.ts`
**Plugs into:** `src/lib/auth/verifyStaff` (owner-only), existing Zod validation pattern, existing `admin` Supabase client pattern.

**Confidence:** MEDIUM — csv-parse dominance in Node ecosystem is well-established in training data; exact v5.5.x patch verified against npm naming convention (web access blocked for live version check). Pin to `^5.5.0` and let pnpm resolve patch.

---

## Area 3 — Expo Push Notification Orchestration

### Verdict: Keep the existing Supabase Edge Function. Add receipt polling. Do NOT add `expo-server-sdk` to Next.js.

**What already exists and works:**
- `supabase/functions/send-push-notification/index.ts` — fetches tokens from `device_tokens`, checks `notification_preferences`, posts to `https://exp.host/--/api/v2/push/send`, logs `expo_receipt_id` to `notification_log`. This is correct Expo Push API v2 usage.
- `apps/mobile/src/lib/notificationService.ts` — handles token registration (upsert to `device_tokens`), permission request, Android channel setup, deep link routing on tap.
- `NotificationType` union currently has only 4 types (`coach_note`, `badge_unlocked`, `streak_milestone`, `leaderboard_rank`). The spec defines 24+ trigger types — this enum needs expansion.

**Should we move push sending to a Next.js API route?** No. The Edge Function architecture is correct for push:
1. Edge Functions run server-side with no cold start penalty comparable to serverless Node.
2. The Edge Function already has Supabase service role access for token lookup.
3. Moving to Next.js API route would add a network hop (web-admin → Supabase → Expo) vs. (Edge Function → Expo directly).
4. The `expo-server-sdk` npm package adds `~800KB` to the Next.js bundle and provides nothing the raw fetch approach doesn't — the Expo Push API is a simple HTTP endpoint.

**What IS missing — receipt polling:**
The Edge Function stores `expo_receipt_id` but never polls `https://exp.host/--/api/v2/push/getReceipts`. Expo's push service is a two-stage pipeline: tickets (immediate) → receipts (async, ~30s delay). A receipt with `status: 'error'` and `details.error: 'DeviceNotRegistered'` means the token is stale — it must be deactivated in `device_tokens` to prevent wasted sends.

**Add a cron-based receipt poller** as a new Next.js API route (`/api/cron/push-receipts`) called by pg_cron every 5 minutes:
```typescript
// Fetch notification_log rows where expo_receipt_id IS NOT NULL and receipt_checked = false
// POST to https://exp.host/--/api/v2/push/getReceipts
// For DeviceNotRegistered: UPDATE device_tokens SET active = false
// For error receipts: UPDATE notification_log SET status = 'failed'
```
This is a pure Next.js route + Supabase pattern — no new library needed.

**Batching limits:**
- Expo Push API accepts up to **100 messages per request** in a single batch array. The current Edge Function sends all tokens for a user (typically 1-3 devices) without explicit batching — fine at current scale.
- For broadcast notifications (send to all gym members): split into batches of 100 before posting to Expo. Implement this in the Edge Function.
- FCM/APNs limits are handled transparently by Expo's service — do not call FCM/APNs directly.

**What must expand:**
1. `NotificationType` in `packages/types/src/index.ts` — add the 20+ missing types corresponding to the 24+ trigger events.
2. `NOTIFICATION_ROUTES` in `notificationService.ts` — add deep link routes for new types.
3. The orchestration wiring: each event source (session complete, achievement unlock, challenge rank change, etc.) must call the Edge Function. Pattern: fire-and-forget `fetch()` after the primary operation, same as how `generateSessionFeedEvents` works today in `sessions/[sessionId]/complete/route.ts`.

**No new npm packages needed for push orchestration.** The entire thing is raw fetch + Supabase + existing infra.

**Confidence:** HIGH — based on reading the actual Edge Function code and Expo push docs from training data (Expo Push API v2 has been stable since 2021).

---

## Area 4 — Mobile Feed UI Virtualization

### Verdict: Add `@shopify/flash-list ^1.7.x` to mobile. Replace `FlatList` on the new feed screen. Do NOT rewrite existing FlatList uses.

**Current state:** All existing mobile lists use React Native's built-in `FlatList` — leaderboard, coach notes, machine history, set logging, exercise progress. This is fine for short lists (< 50 items).

**For the social feed (infinite scroll, mixed card heights, avatars):** FlatList has a known performance problem with feeds:
1. It does not recycle cells efficiently on RN's new architecture.
2. Mixed item heights cause blank flash during fast scroll.
3. Avatar images pre-loaded by FlatList's `windowSize` prop are coarse.

`@shopify/flash-list` solves all three:
- Uses `RecyclerListView` under the hood — actual cell recycling.
- `estimatedItemSize` prop removes layout thrashing on mixed heights.
- Compatible with Expo SDK 52 and New Architecture (`newArchEnabled: true` is already set in `app.json`).
- Current stable version: `^1.7.x` (1.6.x introduced New Architecture support; 1.7.x is the current release line as of training data).

**What NOT to do:** Do not replace existing `FlatList` uses in `leaderboard.tsx`, `coach-notes/index.tsx`, `workout/[id].tsx`, etc. — these lists are short and fixed-height. FlashList's overhead (import, estimatedItemSize config) is only justified for the social feed and challenges feed.

**Pull-to-refresh:** Use `RefreshControl` from react-native (same as FlatList pattern) — FlashList passes `refreshControl` prop through identically. No change to existing refresh patterns.

**Image preloading for feed cards:** `expo-image` (already available in Expo SDK 52 as `expo-image` package) provides a better preloading primitive than React Native's `Image`. It supports `contentFit`, priority hints, and a shared cache. Add `expo-image ^1.x` to mobile. Use `Image` from `expo-image` (not `react-native`) only in feed card components — do not replace existing `react-native` Image uses elsewhere to contain risk.

**Install:**
```bash
pnpm add @shopify/flash-list --filter mobile
pnpm add expo-image --filter mobile
```

**Plugs into:** New `apps/mobile/app/(tabs)/feed.tsx` screen (does not yet exist). Does not touch existing screens.

**Confidence:** MEDIUM — FlashList v1.7.x is well-documented in training data; Expo SDK 52 compatibility with New Architecture is confirmed by `newArchEnabled: true` in `app.json`. Exact latest patch version requires live npm check — pin to `^1.7.0`.

---

## Area 5 — Webhook Fanout / Agent Invocation for 13 UptimizeAI Automations

### Verdict: Use the existing `triggerUptimizeAIAgent()` + `/api/agents/trigger` pattern (fire-and-forget fetch). No external queue needed for Tier 1.

**What already exists:**
- `/api/agents/trigger` — POST route, internal-key auth, Zod-validated, logs to `smartgym_agent_logs`, feature-gates by gym tier, lists 5 known agents.
- `triggerUptimizeAIAgent()` — wrapper function already used in the Stripe webhook handler for 3 events.
- The current pattern is fire-and-forget: `triggerUptimizeAIAgent(...).catch(err => console.error(...))`.

**Gap analysis for the 13 automations:** The audit says "webhook exists, agents not connected." Reading the code, the `/api/agents/trigger` route receives the trigger but does NOT actually call any external UptimizeAI service — it logs the trigger and returns `{ success: true }`. The UptimizeAI agents themselves live in a separate codebase (`c:/Users/pjaco/uptimize-engine/`). The connection work is: (a) expand the trigger route to make an outbound HTTP call to the UptimizeAI engine's API, or (b) confirm the trigger route IS the connection point and UptimizeAI polls the log table. This architectural question must be resolved in Phase 5 planning — the stack addition is the same either way.

**Do we need QStash / Inngest / Trigger.dev?**

No, not for Tier 1. Here's why:

| Option | Adds | Cost at Tier 1 scale | Verdict |
|--------|------|---------------------|---------|
| `triggerUptimizeAIAgent()` (existing) | Nothing | $0 | Use this |
| Supabase Database Webhooks | Nothing (native) | $0 | Use for DB-event triggers only |
| pg_cron + jobs table | Nothing (already in use) | $0 | Use for scheduled triggers only |
| QStash (Upstash) | `@upstash/qstash`, new env var | ~$0 on free tier | Add in Tier 2 if reliability needed |
| Inngest | `inngest` npm, new service | Free tier limited | Overkill for 13 agents |
| Trigger.dev | New service + SDK | Free tier + complex DX | Overkill for 13 agents |

**The reliability concern with fire-and-forget:** If a Next.js serverless function times out before the internal fetch completes, the agent trigger is lost. In Vercel's default 10s timeout, fire-and-forget is reliable for fast internal HTTP calls (same-region, <500ms). For Tier 1 this is acceptable. If an agent trigger fails, it logs the failure in `smartgym_agent_logs` with status `'sent'` — adding a `status: 'failed'` path and a retry-on-next-event pattern is sufficient insurance without a queue.

**For the 13 trigger points that are NOT yet wired:** Each trigger maps to an existing event emission site:

| Trigger | Existing emission site |
|---------|----------------------|
| Session completed | `src/app/api/sessions/[sessionId]/complete/route.ts` |
| Achievement unlocked | `src/lib/achievements.ts` |
| Member at-risk (no session 7d) | `src/app/api/cron/` (new cron route needed) |
| Challenge joined | `src/app/api/member/challenges/[id]/join/route.ts` |
| New program assigned | `src/app/api/programs/` routes |
| Check-in submitted | check-in routes |
| Subscription trial ending | `src/app/api/billing/webhook/route.ts` (already wired) |
| Subscription cancelled | Same webhook (already wired) |
| Payment failed | Same webhook (already wired) |

For database-event-triggered agents (e.g., "member hasn't logged in 7 days"): use **Supabase Database Webhooks** pointing to the `/api/agents/trigger` endpoint — no new library, just configure in Supabase dashboard. Supabase Database Webhooks are HTTP webhooks on INSERT/UPDATE/DELETE on any table, available on all Supabase tiers.

**Must-add:** A `/api/cron/member-health` route for periodic (daily) at-risk member detection — same pattern as existing `/api/cron/dna-recompute/route.ts`.

**No new npm packages needed for agent fanout.**

**Confidence:** HIGH — based on reading every relevant file. The architecture is clear from the code.

---

## Area 6 — Form / Wizard Library for Owner Onboarding

### Verdict: Add `react-hook-form ^7.54.x` + `@hookform/resolvers ^3.9.x` to web-admin. Use with existing Zod v4.

**Current state:** `react-hook-form` is NOT installed anywhere in the monorepo (confirmed by lock file scan). The existing web forms (machines, settings, programs) use plain `useState` + manual validation + Zod `safeParse`. This works for single-field forms but does not scale to the 4-step onboarding wizard (15+ fields across 4 steps, conditional validation, step navigation).

**Why react-hook-form:**
- Zero re-render on every keystroke (uncontrolled inputs via `register`) — critical for a 4-step wizard where step transitions must feel instant.
- `useFormContext` + `FormProvider` enables the wizard to split state across step components without prop drilling.
- `@hookform/resolvers/zod` integrates directly with the existing `zod` v4 schemas — no new validation library.
- Bundle size: ~25KB gzipped — small enough that adding it to web-admin is justified.
- `useFormState` gives per-step error state for the progress indicator.

**Why not alternatives:**
- `formik` — larger bundle, slower (re-renders on every change), community adoption declining since 2022.
- `tanstack-form` v0.x — alpha-to-stable transition happened in 2024 but ecosystem tooling (DevTools, resolver ecosystem) is still maturing. RHF has more battle-tested wizard patterns documented.
- `zustand` (already installed) — capable of holding form state but lacks built-in validation integration and `register`-style uncontrolled inputs. Use Zustand for wizard step navigation state (which step is active), use RHF for field state within each step.

**Zod v4 compatibility:** `@hookform/resolvers ^3.9.x` supports Zod v4 (the resolver was updated for v4's `safeParse` API changes). Verify the resolver version specifically — `3.9.0` is the minimum for Zod v4 support (based on training data; confirm against npm before install).

**Wizard architecture recommendation:**
```
WizardProvider (Zustand — step index, completed steps)
  └── Step 1: GymInfoStep (RHF FormProvider — gym name, address, size)
  └── Step 2: OwnerAccountStep (RHF FormProvider — email, password)
  └── Step 3: PlanSelectionStep (RHF FormProvider — tier, interval)
  └── Step 4: StripeCheckoutRedirect (no form — redirect to Stripe)
```
Each step validates on `handleSubmit` before advancing. Step 4 is a pure redirect — no RHF needed there.

**Install:**
```bash
pnpm add react-hook-form @hookform/resolvers --filter web-admin
```

**Plugs into:** New `apps/web-admin/src/app/onboarding/` route group (does not yet exist). No changes to existing forms — the plain useState pattern is fine for existing forms.

**Confidence:** HIGH — react-hook-form is the de facto standard for React wizard forms; Zod v4 resolver compatibility is verifiable from the `@hookform/resolvers` changelog.

---

## Recommended Stack Additions Summary

| Addition | Package | Version | Target App | Category |
|----------|---------|---------|-----------|----------|
| CSV parsing | `csv-parse` | `^5.5.0` | `web-admin` | MUST ADD |
| Feed list virtualization | `@shopify/flash-list` | `^1.7.0` | `mobile` | MUST ADD |
| Feed card images | `expo-image` | `^1.13.0` | `mobile` | MUST ADD |
| Wizard form state | `react-hook-form` | `^7.54.0` | `web-admin` | MUST ADD |
| Wizard Zod resolver | `@hookform/resolvers` | `^3.9.0` | `web-admin` | MUST ADD |
| Stripe trial config | 2-line change to `stripeHelpers.ts` | — | `web-admin` | MUST CHANGE |
| Push receipt polling | New `/api/cron/push-receipts` route | — | `web-admin` | MUST ADD (code only) |
| `NotificationType` expansion | New union members in `packages/types` | — | `types` | MUST CHANGE |

**Explicitly NOT adding:**
- `expo-server-sdk` — raw fetch to Expo Push API is sufficient; the Edge Function already does this correctly
- `QStash` / `Inngest` / `Trigger.dev` — existing fire-and-forget + pg_cron is sufficient for Tier 1 agent fanout at this scale
- `stripe-connect` — not applicable; NEXERA is direct B2B SaaS, not a marketplace
- `formik` — bundle size + re-render cost unjustified when RHF is available
- `zod-csv` — thin wrapper not worth the dependency when csv-parse + inline Zod safeParse is cleaner
- `papaparse` — browser-first, weaker TypeScript, wrong tool for server-side streaming

---

## Installation Commands

```bash
# web-admin additions
pnpm add csv-parse react-hook-form @hookform/resolvers --filter web-admin

# mobile additions
pnpm add @shopify/flash-list expo-image --filter mobile
```

---

## Integration Points by Feature

| Feature | New Package | Plugs Into | New Files |
|---------|-------------|-----------|-----------|
| Owner onboarding wizard | `react-hook-form`, `@hookform/resolvers` | `src/app/onboarding/` (new) | `WizardProvider.tsx`, `Step1.tsx`–`Step3.tsx` |
| Stripe trial fix | None | `src/lib/billing/stripeHelpers.ts` | No new files |
| CSV import route | `csv-parse` | `src/app/api/owner/members/import/route.ts` (new) | New route file |
| Push receipt cron | None | `src/app/api/cron/push-receipts/route.ts` (new) | New route file |
| Push orchestration wiring | None | Each event route (session complete, achievement, etc.) | Inline `triggerUptimizeAIAgent` calls |
| Agent fanout (DB events) | None | Supabase Dashboard → Database Webhooks | Config only |
| Mobile feed screen | `@shopify/flash-list`, `expo-image` | `apps/mobile/app/(tabs)/feed.tsx` (new) | New screen file |
| Mobile challenges screen | None (uses FlatList) | `apps/mobile/app/(tabs)/challenges.tsx` (new) | New screen file |
| Mobile program view | None (uses FlatList) | `apps/mobile/app/(tabs)/program.tsx` (new) | New screen file |

---

## Version Compatibility Notes

| Package | Compatibility |
|---------|--------------|
| `@shopify/flash-list ^1.7.0` | Requires `react-native >= 0.71`. Current RN is `0.76.6` — compatible. Requires `newArchEnabled: true` for full performance — already set in `app.json`. |
| `@hookform/resolvers ^3.9.0` | Requires `zod >= 3.0.0`. Current project uses `zod ^4.3.6` — compatible. |
| `csv-parse ^5.5.0` | Requires `node >= 18`. Root `engines.node: '>=18'` already set. |
| `expo-image ^1.13.0` | Expo SDK 52 ships `expo-image` as a first-party package — no peer dep conflicts. |
| `stripe ^21.0.1` | Already installed. API version `2026-03-25.dahlia` is current. No upgrade needed. |

---

## Sources

- Codebase analysis — `apps/web-admin/src/lib/billing/stripeHelpers.ts`, `stripeClient.ts`, `triggerAgent.ts`, webhook route — HIGH confidence
- Codebase analysis — `supabase/functions/send-push-notification/index.ts` — HIGH confidence
- Codebase analysis — `apps/mobile/src/lib/notificationService.ts` — HIGH confidence
- Codebase analysis — `apps/web-admin/package.json`, `apps/mobile/package.json`, `pnpm-lock.yaml` — HIGH confidence (version-verified)
- `packages/types/src/index.ts` — NotificationType union (4 types vs 24+ required) — HIGH confidence gap identified
- Training data — `csv-parse` v5 Node.js server-side usage patterns — MEDIUM confidence
- Training data — `@shopify/flash-list` SDK 52 + New Architecture compatibility — MEDIUM confidence (Expo New Arch flag confirmed from `app.json`)
- Training data — `react-hook-form` v7 + `@hookform/resolvers` v3.9+ Zod v4 support — HIGH confidence

---
*Stack research for: SmartGym (NEXERA) Tier 1 Launch Blockers*
*Researched: 2026-06-03*

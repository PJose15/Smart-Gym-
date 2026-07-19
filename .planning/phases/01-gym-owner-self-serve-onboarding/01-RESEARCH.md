# Phase 1: Gym Owner Self-Serve Onboarding — Research

**Researched:** 2026-07-19
**Domain:** Stripe self-serve onboarding, unauthenticated Next.js route group, atomic Postgres gym creation, CSV member import, QR PDF wizard, mobile phone-OTP claim, dashboard checklist
**Confidence:** HIGH (grounded in direct codebase audit; all key files read)

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| ONBD-01 | 4-step wizard (account → gym info → plan → Stripe checkout), unauthenticated `(onboard)/` route group, react-hook-form + Zod, DOC_03 tokens | Route group pattern from `(member)/` and `(trainer)/`; `verifyStaff` auth model understood; design tokens in `src/styles/tokens.css` fully documented |
| ONBD-02 | Atomic gym creation via Postgres RPC; `onboarding_status` tracks partial completion; session refresh post-creation for RLS | `is_gym_owner` + `owned_gym_ids` confirmed SECURITY DEFINER; `gyms`/`gym_memberships`/`gym_settings`/`gym_billing` schema verified; no `stripe_events_processed` table exists yet (must be migrated) |
| ONBD-03 | `stripe_events_processed` idempotency table; `checkout.session.completed` + `checkout.session.expired` handlers; abandonment banner; `payment_method_collection` + `trial_settings.end_behavior` | `handleStripeWebhook` in `stripeHelpers.ts` confirmed — these 2 events are NOT handled; idempotency table does not exist; `createCheckoutSession` missing `payment_method_collection` and `trial_settings` |
| ONBD-04 | 3-step first-machine wizard (name → muscles → QR PDF) using existing API; shared `MachineForm` | `generateQrPdf` + `GET /api/machines/qr-pdf` exist and work; machines page uses Supabase direct insert — no `POST /api/machines` route exists (must create); `MachineForm` extraction needed |
| ONBD-05 | CSV import: column mapping UI, preview, per-row error report, BOM handling, all-or-nothing batch, 500-row cap, `csv-parse` server-side | No import route or page exists; `csv-parse` not installed; `members.email` column confirmed in schema; no `(gym_id, email)` unique constraint on members (verify before bulk import) |
| ONBD-06 | Imported members: `invited` status + claim email; phone-OTP on mobile links invited record to auth user | `findOrCreateMember` in `api/auth/verify` already links by phone (`user_id = null` path at line 186); members schema has `email` and `onboarding_status`; `invited` status NOT in current CHECK constraint (must add via migration) |
| ONBD-07 | Dashboard checklist (add machine, import/invite members, share QR) + trial countdown banner | `onboarding_events` table exists; `gym_billing.trial_ends_at` exists; owner dashboard page at `owner/dashboard/page.tsx` uses `/api/owner/dashboard` — must extend API + add UI components |
</phase_requirements>

---

## Summary

Phase 1 is the most novel build in the v1.0 milestone. Unlike Phases 3-4 (pure mobile UI on existing APIs), this phase requires new auth flows, database migrations, new API routes, and new page groups that do not exist today.

**The codebase ground truth reveals several gaps that differ from the 2026-06-03 milestone research assumptions:** (1) There is no `POST /api/machines` route — the machines page calls Supabase directly from the client — so the wizard needs a new server route, not just a form extraction. (2) The `stripe_events_processed` idempotency table has not been created yet. (3) The `invited` onboarding status value is missing from the `members.onboarding_status` CHECK constraint. (4) Neither `react-hook-form`, `@hookform/resolvers`, nor `csv-parse` are installed. (5) The `(onboard)/` route group does not exist at all.

The pre-existing strengths are significant: the `generateQrPdf` function and `GET /api/machines/qr-pdf` endpoint are fully built and production-ready; the phone-OTP claim path in `api/auth/verify` already handles the "link invited member by phone" case; `is_gym_owner` and `owned_gym_ids` are `SECURITY DEFINER` (Pitfall 3 already avoided); all 5 tables needed for gym creation (`gyms`, `gym_memberships`, `gym_settings`, `gym_billing`, `users`) have verified schemas; and the DOC_03 token system is fully implemented at `src/styles/tokens.css`.

**Primary recommendation:** Build in this order: (1) migration wave (stripe_events_processed, invited status, onboarding_status on gyms); (2) `POST /api/onboard/register` RPC + middleware bypass; (3) `(onboard)/` wizard pages; (4) Stripe handlers in webhook; (5) `POST /api/machines` route + MachineForm extraction + wizard; (6) CSV import route + page; (7) dashboard checklist + trial banner.

---

## Standard Stack

### Core (already installed — do not re-install)
| Library | Version | Purpose | File |
|---------|---------|---------|------|
| `stripe` | `^21.0.1` | Stripe API client | `apps/web-admin/package.json` |
| `zod` | `^4.3.6` | Schema validation | `apps/web-admin/package.json` |
| `pdf-lib` | `^1.17.1` | QR PDF generation | `apps/web-admin/package.json` |
| `qrcode` | `^1.5.4` | QR code image generation | `apps/web-admin/package.json` |
| `@supabase/supabase-js` | existing | DB + Auth client | monorepo-wide |

### Must Add (not installed)
| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| `react-hook-form` | `^7.54.0` | Multi-step wizard forms | Zero re-render per keystroke, FormProvider for step splitting, `useFormState` for per-step errors |
| `@hookform/resolvers` | `^3.9.0` | Zod v4 integration for RHF | `^3.9.0` is minimum for Zod v4 compat; already confirmed by STACK.md |
| `csv-parse` | `^5.5.0` | Server-side CSV parsing | Node-native, streams, TypeScript-native; Node `>=18` already set in root `engines` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `csv-parse` | `papaparse` | PapaParse is browser-first, weaker TS types, awkward with Next.js ReadableStream — do not use |
| `react-hook-form` | plain `useState` | useState works for existing single-field forms but doesn't scale to 4-step wizard with 15+ fields and conditional validation |

**Installation:**
```bash
pnpm add react-hook-form @hookform/resolvers csv-parse --filter web-admin
```

---

## Architecture Patterns

### Route Group: `(onboard)/`

The onboarding flow MUST live in a separate unauthenticated route group. The existing `owner/layout.tsx` calls `/api/auth/staff/me` on mount and redirects to `/staff/login` if no session — so unauthenticated users can never reach pages inside `owner/`. The `(member)/` and `(trainer)/` route groups at `apps/web-admin/src/app/(member)/layout.tsx` and `(trainer)/layout.tsx` provide the structural template.

```
apps/web-admin/src/app/
├── (onboard)/
│   ├── layout.tsx              NEW — no auth check; loads tokens.css; Nexera brand shell
│   ├── signup/
│   │   └── page.tsx            NEW — Step 1: name + email + password + gym name
│   ├── verify-email/
│   │   └── page.tsx            NEW — Step 2: holding screen ("check your inbox")
│   ├── subscribe/
│   │   └── page.tsx            NEW — Step 3: tier picker + Stripe Checkout redirect
│   └── setup/
│       ├── page.tsx            NEW — Step 4: first machine wizard
│       └── import/
│           └── page.tsx        NEW — CSV member import
├── (member)/                   EXISTING
├── (trainer)/                  EXISTING
└── owner/                      EXISTING (auth-gated)
```

The layout for `(onboard)/` mirrors the minimal unauthenticated shell — no sidebar, centered content, Nexera logo, progress indicator component.

### Middleware Change (Critical)

`apps/web-admin/middleware.ts` — add `/api/onboard/` to the `CSRF_EXEMPT` array AND ensure the `/(onboard)/` page routes pass through the `updateSession` call without redirecting unauthenticated users. The current middleware runs `updateSession` for all non-`/api/` routes; `updateSession` (from `@/lib/supabase/middleware`) must NOT redirect unauthenticated users out of `(onboard)/` pages.

Current `CSRF_EXEMPT` array:
```typescript
const CSRF_EXEMPT = [
  '/api/billing/webhook',
  '/api/cron/',
  '/api/agents/',
  '/api/health',
  '/api/dev/',
]
```

Add: `'/api/onboard/'`

Also check `lib/supabase/middleware.ts` — if `updateSession` does auth-gating redirects, add `(onboard)` to the bypass list.

### Pattern 1: Atomic Gym Creation via Postgres RPC

All five DB rows (`auth.users` via Supabase Auth, `users`, `gyms`, `gym_memberships`, `gym_settings`, `gym_billing`) must be created atomically. Since Supabase JS does not expose multi-statement transactions, use a Postgres function called via `admin.rpc()`.

```typescript
// Migration 027 — new function
CREATE OR REPLACE FUNCTION complete_gym_onboarding(
  p_user_id     uuid,
  p_gym_name    text,
  p_gym_slug    text,
  p_gym_city    text DEFAULT NULL,
  p_gym_type    text DEFAULT 'independent',
  p_tier        text DEFAULT 'starter'
) RETURNS uuid AS $$
DECLARE
  v_gym_id uuid;
BEGIN
  -- 1. Insert gym
  INSERT INTO gyms (name, slug, owner_id, gym_type, city, subscription_tier, subscription_status)
  VALUES (p_gym_name, p_gym_slug, p_user_id, p_gym_type, p_gym_city, p_tier, 'trial')
  RETURNING id INTO v_gym_id;

  -- 2. Insert gym_memberships (owner role)
  INSERT INTO gym_memberships (user_id, gym_id, role, status)
  VALUES (p_user_id, v_gym_id, 'owner', 'active');

  -- 3. Insert gym_settings (defaults)
  INSERT INTO gym_settings (gym_id)
  VALUES (v_gym_id);

  -- 4. Insert gym_billing (trialing)
  INSERT INTO gym_billing (gym_id, subscription_status, tier)
  VALUES (v_gym_id, 'trialing', p_tier);

  RETURN v_gym_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

The API route calls: `const { data: gymId } = await admin.rpc('complete_gym_onboarding', { ... })`.

### Pattern 2: `POST /api/onboard/register` — Pre-Auth Route

This route is public (no `verifyStaff`), CSRF-exempt, uses the service-role admin client, creates the Supabase Auth user, then calls the gym creation RPC.

```typescript
// Source: derived from existing /api/auth/staff/signin pattern + admin client pattern in stripeHelpers.ts
export async function POST(request: Request) {
  const body = await request.json();
  const parsed = onboardRegisterSchema.safeParse(body);
  if (!parsed.success) return /* 400 */;

  const admin = getAdminClient(); // service role — same pattern as stripeHelpers.ts

  // 1. Create Supabase Auth user
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email: parsed.data.email,
    password: parsed.data.password,
    email_confirm: false, // verification email sent automatically
    user_metadata: { display_name: parsed.data.owner_name },
  });

  // 2. Insert users row (mirrors the existing members flow)
  await admin.from('users').insert({
    id: authData.user.id,
    email: parsed.data.email,
    display_name: parsed.data.owner_name,
    platform_role: 'gym_owner',
  });

  // 3. Atomic gym creation
  const { data: gymId } = await admin.rpc('complete_gym_onboarding', {
    p_user_id: authData.user.id,
    p_gym_name: parsed.data.gym_name,
    p_gym_slug: generateGymSlug(parsed.data.gym_name), // from @nexera/utils
    p_gym_city: parsed.data.city,
  });

  // 4. Update users.platform_role after gym creation (or set in RPC)
  return NextResponse.json({ gym_id: gymId, email: parsed.data.email });
}
```

**emailRedirectTo**: Pass `${appUrl}/subscribe?gym_id=${gymId}` so clicking the verification email lands on Step 3 with the gym context.

### Pattern 3: Stripe Webhook — New Handlers

Add to `handleStripeWebhook` in `stripeHelpers.ts`:

```typescript
case 'checkout.session.completed': {
  const session = event.data.object as Stripe.Checkout.Session;
  const gymId = session.metadata?.gym_id;
  if (!gymId) return { action: 'no_gym_id' };

  const subId = typeof session.subscription === 'string'
    ? session.subscription
    : session.subscription?.id;

  await admin.from('gym_billing').update({
    stripe_subscription_id: subId ?? null,
    subscription_status: 'trialing', // stays trialing until trial ends
  }).eq('gym_id', gymId);

  // Mark gym onboarding_status as stripe_pending→active (see ONBD-02)
  await admin.from('gyms').update({ subscription_status: 'trial' }).eq('id', gymId);

  return { action: 'checkout_completed', gymId };
}

case 'checkout.session.expired': {
  const session = event.data.object as Stripe.Checkout.Session;
  const gymId = session.metadata?.gym_id;
  if (!gymId) return { action: 'no_gym_id' };

  // Reset from stripe_pending back to trial so owner can retry
  await admin.from('gym_billing').update({
    subscription_status: 'trialing',
  }).eq('gym_id', gymId);

  return { action: 'checkout_expired', gymId };
}
```

Before adding these handlers, add the idempotency guard (migration 027) at the top of `handleStripeWebhook`:
```typescript
const { data: inserted } = await admin
  .from('stripe_events_processed')
  .insert({ event_id: event.id, processed_at: new Date().toISOString() })
  .select('event_id');
if (!inserted || inserted.length === 0) return { action: 'duplicate' };
```

### Pattern 4: `POST /api/machines` Route (NEW)

The existing `machines/page.tsx` calls `supabase.from('machines').insert(...)` directly from the client. This bypasses the middleware CSRF + auth layer. The first-machine wizard needs a proper server route, and this is also the right time to fix the machines page to use the API.

```typescript
// apps/web-admin/src/app/api/machines/route.ts — NEW
export async function POST(request: Request) {
  const result = await verifyStaff('owner');
  if (result instanceof NextResponse) return result;
  const { admin, gym_id } = result;

  const body = await request.json();
  const parsed = machineCreateSchema.safeParse(body);
  if (!parsed.success) return /* 400 */;

  const qr_slug = generateQrSlug(parsed.data.name, gym_id); // from @nexera/utils

  const { data: machine, error } = await admin.from('machines').insert({
    gym_id,
    ...parsed.data,
    qr_slug,
  }).select('id, name, qr_slug').single();

  return NextResponse.json(machine);
}
```

### Pattern 5: Shared `MachineForm` Component

Extract from `machines/page.tsx` into `components/machines/MachineForm.tsx`. Both the `/machines` CRUD page and the `(onboard)/setup` wizard import it. The form needs:
- Machine name (required)
- Category (select: strength/cardio/cable/functional/other)
- Equipment type (select)
- Muscle groups (multi-select from COMMON_MUSCLES — reuse existing checkbox UI)
- Instructions (textarea, optional)
- Location in gym (text, optional)

The wizard uses a minimal 3-field version (name + muscle groups + submit → QR). The CRUD page uses the full form. Implement `MachineForm` with an optional `minimal` prop.

### Pattern 6: CSV Import — Two-Phase Validate-Then-Import

```typescript
// POST /api/owner/members/import
// Phase 1 (validate=true): parse, validate, return { valid[], invalid[] } — NO DB writes
// Phase 2 (validate=false, confirmed by owner): actual insert

import { parse } from 'csv-parse/sync'; // sync for <500 rows in memory

export async function POST(request: Request) {
  const result = await verifyStaff('owner');
  // ...
  const formData = await request.formData();
  const file = formData.get('file') as File;
  const validate = formData.get('validate') === 'true';

  let text = await file.text();
  // BOM strip (Excel UTF-16)
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);

  const records = parse(text, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  // Normalize headers: 'Email Address', 'email', 'e-mail' → 'email'
  const normalizedRecords = records.map(normalizeRow);

  if (validate) {
    const { valid, invalid } = validateRecords(normalizedRecords);
    return NextResponse.json({ valid, invalid, total: records.length });
  }

  // Import phase: upsert via RPC for atomicity, 500-row hard cap
  if (records.length > 500) {
    return NextResponse.json({ error: 'Max 500 rows per import' }, { status: 400 });
  }

  const { data: result } = await admin.rpc('bulk_import_members', {
    p_gym_id: gym_id,
    p_members: validRows,
  });

  return NextResponse.json({ imported: result.imported, failed: result.failed, errors: result.errors });
}
```

The `bulk_import_members` Postgres function handles the all-or-nothing transaction logic (see migration section).

### Pattern 7: Member Claim via Phone OTP (ONBD-06)

The `api/auth/verify` route already handles the link case at line 186:
```typescript
if (existing.user_id === null) {
  // links the auth user to the pre-created member row
  await admin.from('members').update({ user_id: userId, onboarding_status: 'in_progress' })...
}
```

For CSV-imported members: create them with `user_id = null`, `onboarding_status = 'invited'`, `email = <imported_email>`. When the member opens the mobile app and does phone OTP, `findOrCreateMember` matches by phone (`eq('phone', phone)`) and links. If the member has no phone in the import, match by email — add an email match path to `findOrCreateMember`.

**The `invited` status value must be added to the CHECK constraint** (see migration section — `onboarding_status` currently allows: `'pending','in_progress','intake_complete','active','program_generating','program_active'`).

### Pattern 8: Setup Checklist + Trial Countdown (ONBD-07)

The checklist derives from `onboarding_events` (existing table) plus live counts. Add a new `GET /api/owner/onboarding-status` route:

```typescript
// Returns:
{
  checklist: {
    has_machine: boolean,       // COUNT machines WHERE gym_id
    has_members: boolean,       // COUNT members WHERE gym_id AND status != 'invited'  
    has_shared_qr: boolean,     // has any machine been scanned? COUNT machine_scan_events
  },
  trial: {
    is_trialing: boolean,
    trial_ends_at: string | null,
    days_remaining: number | null,
  }
}
```

In the owner dashboard `page.tsx`, add a `SetupChecklist` component and a `TrialCountdownBanner` component. Both use this route.

### Anti-Patterns to Avoid

- **Anti-pattern: Creating Stripe checkout session BEFORE the gym row exists.** The current `billing/checkout/route.ts` already checks for `gym_billing` existence — the gym MUST be created by `complete_gym_onboarding` before checkout is initiated. The onboarding flow sequence enforces this: Step 1 = create gym → Step 2 = verify email → Step 3 = Stripe checkout. Do not skip the gym creation step.
- **Anti-pattern: Building the onboarding pages under `owner/`.** The `owner/layout.tsx` calls `/api/auth/staff/me` on mount and redirects to `/staff/login` on failure. New owners have no session yet. This is explicitly why the `(onboard)/` route group is needed.
- **Anti-pattern: Client-side direct Supabase insert for machines.** The existing `machines/page.tsx` bypasses the API layer. The wizard MUST use `POST /api/machines` (new). Also update the machines page to use the API (reduces attack surface).
- **Anti-pattern: Skipping the `stripe_events_processed` dedup table.** The `checkout.session.completed` handler creates/updates DB rows. Without dedup, Stripe retries on a 500 response will re-run those inserts.
- **Anti-pattern: Importing all 500 rows in one HTTP request with synchronous processing.** Vercel functions have a 10-30s timeout. The route must: (1) validate synchronously in memory, (2) use a Postgres RPC for the actual insert (which is fast, server-side), not row-by-row JS loops.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CSV parsing | Manual `String.split(',')` or `String.split('\n')` | `csv-parse` | BOM handling, quoted fields, multi-line cells, Windows CRLF, Excel encodings |
| Multi-step form state | Custom step reducer + manual validation | `react-hook-form` + `FormProvider` | Uncontrolled inputs (no re-render per keystroke), per-step validation, `useFormState` |
| QR PDF generation | Custom PDF library | `pdf-lib` + `generateQrPdf` (already built) | Already produces letter-size PDF with 2-column layout, machine names, equipment types |
| Atomic multi-table insert | Sequential JS await calls | `admin.rpc('complete_gym_onboarding', ...)` | Single transaction; partial failures don't leave orphaned rows |
| Stripe idempotency | In-memory dedup | `stripe_events_processed` table with UNIQUE constraint | Survives deploys, server restarts, and multi-instance deployments |
| BOM stripping | npm package | 1-line inline check: `if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1)` | The only case is BOM 0xFEFF; `strip-bom` npm package is unnecessary overhead |

---

## Common Pitfalls

### Pitfall 1: Webhook Retry Creates Duplicate Gym (CRITICAL)
**What goes wrong:** Stripe retries `checkout.session.completed` when the handler returns 5xx or times out. Without `stripe_events_processed`, each retry re-runs the handler and may update `gym_billing` multiple times.
**Why it happens:** The current webhook handler has no dedup. The table does not exist yet.
**How to avoid:** Migration 027 creates `stripe_events_processed (event_id text UNIQUE, processed_at timestamptz)`. The idempotency check is the FIRST thing in `handleStripeWebhook` before any switch statement.
**Warning signs:** Two rows in `gym_billing` for the same gym, or Stripe dashboard showing "retried" on recent events.

### Pitfall 2: Owner Stuck After Email Verification (HIGH)
**What goes wrong:** Owner clicks the email verification link but the redirect URL `emailRedirectTo` doesn't include `gym_id`. Owner lands on `/subscribe` with no gym context, can't complete checkout.
**Why it happens:** The Supabase `signUp` call in `register/route.ts` must include `emailRedirectTo: ${appUrl}/subscribe?gym_id=${gymId}`.
**How to avoid:** Store `gym_id` in the emailRedirectTo param. On `/subscribe` page, read `gym_id` from searchParams and pass it to the checkout API. Also: store gym_id in a short-lived cookie as backup (in case email client strips query params).
**Warning signs:** Owner on `/subscribe` page with no tier cards loading; 400 from checkout route because gym_id is missing.

### Pitfall 3: RLS Returns Empty Data After Signup (HIGH)
**What goes wrong:** Owner completes signup, lands on dashboard, sees empty metrics. Refreshing the page fixes it.
**Why it happens:** Supabase JWTs are cached. The membership row was just created after the JWT was issued. `is_gym_owner()` and `owned_gym_ids()` ARE `SECURITY DEFINER` (verified in migration 001, lines 1038-1078) — they do a live DB lookup. This means the data should be accessible without a forced refresh, AS LONG AS the owner's session is active. But the owner session may not exist yet (they signed up server-side, haven't signed in on the client). Force a client-side session refresh after email verification.
**How to avoid:** After the owner lands on `/subscribe` (post-email-click), call `supabase.auth.refreshSession()` before fetching owner data. The `(onboard)/subscribe/page.tsx` should do this on mount.
**Warning signs:** Empty metrics on dashboard after first login; no 403 errors, just empty arrays.

### Pitfall 4: CSV BOM Corrupts Email Column (MEDIUM)
**What goes wrong:** Excel CSV export on Windows includes a BOM (`\xEF\xBB\xBF` for UTF-8, `\xFF\xFE` for UTF-16). `csv-parse` handles UTF-8 BOM with `bom: true` option, but not UTF-16.
**How to avoid:** Strip BOM before parsing: `if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1)`. Also pass `bom: true` to `csv-parse`. Normalize column headers with `.toLowerCase().trim()` and support aliases: `['email', 'Email', 'Email Address', 'e-mail']`.
**Warning signs:** First column header shows `﻿email` in logs; email field is undefined on imported rows.

### Pitfall 5: `invited` Status Missing from CHECK Constraint (HIGH)
**What goes wrong:** Importing a member with `onboarding_status = 'invited'` causes a Postgres CHECK constraint violation.
**Why it happens:** Current CHECK constraint on `members.onboarding_status` allows: `'pending','in_progress','intake_complete','active','program_generating','program_active'`. `'invited'` is not in the list.
**How to avoid:** Migration 027 adds `'invited'` to the constraint: `ALTER TABLE members DROP CONSTRAINT members_onboarding_status_check; ALTER TABLE members ADD CONSTRAINT members_onboarding_status_check CHECK (onboarding_status IN ('pending','in_progress','intake_complete','active','program_generating','program_active','invited'));`
**Warning signs:** 500 error on CSV import with `"constraint members_onboarding_status_check"` in logs.

### Pitfall 6: Ghost Checkout State (MEDIUM)
**What goes wrong:** Owner abandons Stripe checkout (closes browser). `gym_billing` has `stripe_customer_id` set but `stripe_subscription_id` is null. Owner tries again, gets a second checkout session. Multiple abandoned sessions accumulate on the same Stripe customer.
**How to avoid:** Handle `checkout.session.expired` webhook to detect abandonment. On the `/subscribe` page, check if `gym_billing.stripe_customer_id` is set but `stripe_subscription_id` is null — show "Complete your subscription" banner instead of a fresh tier picker. The `billing/checkout/route.ts` already re-uses the existing customer ID (line 35: `let customerId = billing?.stripe_customer_id`) — this is correct.
**Warning signs:** Multiple "expired" sessions in Stripe dashboard per customer; `gym_billing` rows with `stripe_customer_id` but no `stripe_subscription_id` for >24h.

### Pitfall 7: Missing `POST /api/machines` Route
**What goes wrong:** The first-machine wizard calls `POST /api/machines` which does not exist. The machines page uses a direct Supabase client insert instead.
**How to avoid:** Create `apps/web-admin/src/app/api/machines/route.ts` with `POST` handler before building the wizard. The `qr_slug` must be generated server-side using `generateQrSlug` from `@nexera/utils`. Verify `generateQrSlug` exists in that package.
**Warning signs:** 404 on `POST /api/machines` from wizard; machines page still working because it uses direct Supabase.

### Pitfall 8: `gyms` Slug Uniqueness Collision
**What goes wrong:** Two owners sign up with the same gym name simultaneously. Both get the same slug (`iron-society`). One insert succeeds; the other violates the UNIQUE constraint on `gyms.slug`.
**How to avoid:** In the `complete_gym_onboarding` RPC, use `INSERT ... ON CONFLICT DO NOTHING RETURNING id` first. If nothing returned, append a random 4-digit suffix. Alternatively, use a slug with the user_id fragment: `iron-society-a3f2`. The `generateGymSlug` utility should handle collision avoidance.
**Warning signs:** 500 on registration for gyms with common names; Postgres unique violation on `gyms.slug`.

---

## Code Examples

### Zod Schema: `onboardRegisterSchema`
```typescript
// apps/web-admin/src/lib/validation/onboard.ts — NEW
import { z } from 'zod';

export const onboardRegisterSchema = z.object({
  owner_name: z.string().min(2).max(100).trim(),
  email: z.string().email(),
  password: z.string().min(8).max(72),
  gym_name: z.string().min(2).max(100).trim(),
  city: z.string().max(100).trim().optional(),
  gym_type: z.enum(['independent','crossfit','martial-arts','yoga','personal-training','corporate','other'])
    .optional().default('independent'),
});
```

### react-hook-form Wizard Step Pattern
```typescript
// Source: react-hook-form docs + STACK.md recommendation
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

// In SignupPage (Step 1):
const methods = useForm<OnboardRegisterInput>({
  resolver: zodResolver(onboardRegisterSchema),
  defaultValues: { gym_type: 'independent' },
});

// FormProvider wraps child step components
return (
  <FormProvider {...methods}>
    <form onSubmit={methods.handleSubmit(onSubmit)}>
      {/* step fields */}
    </form>
  </FormProvider>
);
```

### Middleware CSRF Exempt Addition
```typescript
// apps/web-admin/middleware.ts — MODIFY
const CSRF_EXEMPT = [
  '/api/billing/webhook',
  '/api/cron/',
  '/api/agents/',
  '/api/health',
  '/api/dev/',
  '/api/onboard/',   // ADD THIS
]
```

### csv-parse BOM-Safe Pattern
```typescript
// apps/web-admin/src/app/api/owner/members/import/route.ts — NEW
import { parse } from 'csv-parse/sync';

let text = await file.text();
if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1); // strip BOM

const records = parse(text, {
  columns: true,
  skip_empty_lines: true,
  trim: true,
  bom: true, // handles UTF-8 BOM
});

// Normalize column names
function normalizeRow(row: Record<string, string>) {
  const normalized: Record<string, string> = {};
  for (const [k, v] of Object.entries(row)) {
    const key = k.toLowerCase().trim()
      .replace(/\s+/g, '_')
      .replace(/e[-_]mail/, 'email')
      .replace(/email_address/, 'email')
      .replace(/full_name|member_name/, 'display_name');
    normalized[key] = v;
  }
  return normalized;
}
```

### `createCheckoutSession` Fix
```typescript
// apps/web-admin/src/lib/billing/stripeHelpers.ts — MODIFY createCheckoutSession
return stripe.checkout.sessions.create({
  customer: customerId,
  mode: 'subscription',
  payment_method_collection: 'always',  // ADD: capture card upfront
  line_items: [{ price: priceId, quantity: 1 }],
  subscription_data: {
    trial_period_days: 30,
    trial_settings: {                    // ADD: prevent silent conversion
      end_behavior: { missing_payment_method: 'cancel' },
    },
    metadata: { gym_id: gymId, tier },
  },
  // ... rest unchanged
});
```

---

## State of the Art

| Old Approach | Current Approach | Notes |
|--------------|------------------|-------|
| Machines page: client-side `supabase.from('machines').insert()` | NEW: `POST /api/machines` server route | Old approach bypasses CSRF and rate limiting |
| No webhook idempotency | NEW: `stripe_events_processed` table | Stripe retries are 3-day persistent |
| `supabase.auth.signUp()` (client-side) | `admin.auth.admin.createUser()` (server-side) | Server-side gives control over email flow and allows setting `platform_role` in the same request |
| No onboarding route group | NEW: `(onboard)/` unauthenticated group | Required because `owner/layout.tsx` blocks unauthenticated access |

**Not deprecated/outdated:**
- `pdf-lib` + `qrcode` for QR PDF: still the correct approach; `generateQrPdf` is production-ready
- `verifyStaff('owner')` pattern: used on all new owner routes, no change
- `getAdminClient()` with service-role key: correct pattern for all new server routes

---

## Open Questions

1. **`generateQrSlug` in `@nexera/utils`**
   - What we know: The `machines/page.tsx` imports `generateQrSlug` from `@nexera/utils` (line 6)
   - What's unclear: The exact signature and collision-handling behavior were not verified
   - Recommendation: Read `packages/utils/src/index.ts` before writing the `POST /api/machines` route to confirm the slug generation approach

2. **`bulk_import_members` RPC — all-or-nothing vs per-row**
   - What we know: REQUIREMENTS.md says "all-or-nothing batch import capped at 500 rows"; PITFALLS.md says use a Postgres function for atomicity
   - What's unclear: All-or-nothing is ideal but means a single bad row cancels 499 good ones. FEATURES.md says "import valid rows even if some fail." These are contradictory.
   - Recommendation: Implement as all-or-nothing for the validate-then-import two-phase flow — the validate phase catches all errors first, so Phase 2 only runs on clean data. If the owner has mixed data, they fix it before confirming. This satisfies both requirements.

3. **`supabase/middleware.ts` — does `updateSession` redirect unauthenticated users?**
   - What we know: `middleware.ts` calls `updateSession(request)` for all non-`/api/` routes
   - What's unclear: Whether `updateSession` performs redirects for unauthenticated users (it shouldn't — it only refreshes the session cookie if present)
   - Recommendation: Read `apps/web-admin/src/lib/supabase/middleware.ts` early in the planning wave to confirm before building the `(onboard)/` layout

4. **`members` table — unique constraint on `(gym_id, email)`**
   - What we know: `members.email` exists (line 302 of schema); the column is nullable
   - What's unclear: Whether there is a `(gym_id, email)` unique constraint for upsert safety
   - Recommendation: Check migration 001 and later migrations before writing the CSV import RPC. If no constraint exists, the import RPC must handle duplicates manually (check before insert).

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest 30.2.0 |
| Config file | `apps/web-admin/jest.config.js` |
| Quick run command | `cd apps/web-admin && npx jest --testPathPattern="onboard\|import\|billing" --no-coverage` |
| Full suite command | `cd apps/web-admin && npx jest` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ONBD-01 | Signup form validates email + password min length | unit | `npx jest --testPathPattern="onboard"` | ❌ Wave 0 |
| ONBD-01 | Wizard progress indicator renders correct step | unit | `npx jest --testPathPattern="WizardProgress"` | �� Wave 0 |
| ONBD-02 | `complete_gym_onboarding` RPC creates 4 rows atomically | integration (mock) | `npx jest --testPathPattern="register"` | ❌ Wave 0 |
| ONBD-02 | Partial failure (gym created but billing insert fails) leaves no orphan | unit | `npx jest --testPathPattern="register"` | ❌ Wave 0 |
| ONBD-03 | `handleStripeWebhook` returns `{action:'duplicate'}` on second event_id | unit | `npx jest --testPathPattern="stripeHelpers"` | ❌ Wave 0 |
| ONBD-03 | `checkout.session.completed` updates `gym_billing.stripe_subscription_id` | unit | `npx jest --testPathPattern="stripeHelpers"` | ❌ Wave 0 |
| ONBD-03 | `checkout.session.expired` resets status to trialing | unit | `npx jest --testPathPattern="stripeHelpers"` | ❌ Wave 0 |
| ONBD-04 | `POST /api/machines` creates machine with unique qr_slug | unit | `npx jest --testPathPattern="machines"` | ❌ Wave 0 |
| ONBD-04 | MachineForm renders required fields and submits | unit | `npx jest --testPathPattern="MachineForm"` | ❌ Wave 0 |
| ONBD-05 | CSV import strips BOM and parses email column correctly | unit | `npx jest --testPathPattern="import"` | ❌ Wave 0 |
| ONBD-05 | Validate phase returns `{valid[], invalid[]}` with no DB writes | unit | `npx jest --testPathPattern="import"` | ❌ Wave 0 |
| ONBD-05 | Import rejects >500 rows | unit | `npx jest --testPathPattern="import"` | ❌ Wave 0 |
| ONBD-06 | `findOrCreateMember` links `user_id=null` member on OTP verify | unit | `npx jest --testPathPattern="verify"` | ❌ Wave 0 |
| ONBD-07 | `GET /api/owner/onboarding-status` returns correct `has_machine` boolean | unit | `npx jest --testPathPattern="onboarding-status"` | ❌ Wave 0 |
| ONBD-07 | Trial countdown calculates correct `days_remaining` | unit | `npx jest --testPathPattern="onboarding-status"` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `cd apps/web-admin && npx jest --testPathPattern="onboard|import|stripeHelpers|machines" --no-coverage`
- **Per wave merge:** `cd apps/web-admin && npx jest`
- **Phase gate:** Full suite green (269+ tests baseline) before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `apps/web-admin/src/app/api/onboard/__tests__/register.test.ts` — covers ONBD-02
- [ ] `apps/web-admin/src/app/api/billing/__tests__/stripeHelpers.test.ts` — covers ONBD-03
- [ ] `apps/web-admin/src/app/api/machines/__tests__/machines.test.ts` — covers ONBD-04
- [ ] `apps/web-admin/src/app/api/owner/members/__tests__/import.test.ts` — covers ONBD-05
- [ ] `apps/web-admin/src/app/api/auth/__tests__/verify-claim.test.ts` — covers ONBD-06 (link path)
- [ ] `apps/web-admin/src/app/api/owner/__tests__/onboarding-status.test.ts` — covers ONBD-07

---

## Sources

### Primary (HIGH confidence — direct file read)
- `apps/web-admin/src/lib/billing/stripeHelpers.ts` — confirmed `createCheckoutSession` missing `payment_method_collection` and `trial_settings`; confirmed 4 event handlers, NOT `checkout.session.completed/expired`
- `apps/web-admin/src/app/api/billing/webhook/route.ts` — confirmed 3 agent triggers already wired
- `apps/web-admin/src/app/api/billing/checkout/route.ts` — confirmed customer ID reuse pattern
- `apps/web-admin/middleware.ts` — confirmed CSRF_EXEMPT list; `/api/onboard/` NOT in list
- `apps/web-admin/src/app/owner/layout.tsx` — confirmed auth guard calling `/api/auth/staff/me`
- `apps/web-admin/src/app/machines/page.tsx` — confirmed direct Supabase insert (no `POST /api/machines` route)
- `apps/web-admin/src/app/api/machines/qr-pdf/route.ts` — confirmed working; uses `generateQrPdf`
- `apps/web-admin/src/lib/qr/generateQrPdf.ts` — confirmed interface: `(machines, gymName, baseUrl) => Uint8Array`
- `apps/web-admin/src/lib/auth/verifyStaff.ts` — confirmed session-based auth pattern
- `apps/web-admin/src/app/api/auth/verify/route.ts` — confirmed `findOrCreateMember` links `user_id=null` by phone (line 186); `invited` onboarding status NOT handled
- `supabase/migrations/001_nexera_schema.sql` — confirmed: `gyms`/`gym_memberships`/`gym_settings`/`gym_billing` schemas; `is_gym_owner` + `owned_gym_ids` are SECURITY DEFINER; `members.onboarding_status` CHECK constraint does NOT include `'invited'`; `onboarding_events` table exists
- `apps/web-admin/src/styles/tokens.css` — confirmed DOC_03 token palette (`--accent: #7C5CFF`, `--color-blue: #7C5CFF`, full background/text/border system)
- `apps/web-admin/package.json` — confirmed: `stripe ^21.0.1`, `zod ^4.3.6`, `pdf-lib ^1.17.1`, `qrcode ^1.5.4` installed; `react-hook-form`, `@hookform/resolvers`, `csv-parse` NOT installed
- `apps/web-admin/jest.config.js` — confirmed: Jest 30.2.0, jsdom environment, `__tests__/**/*.test.ts(x)` pattern

### Secondary (MEDIUM confidence — from .planning/research/ files, not re-verified via live file read)
- `.planning/research/STACK.md` — `@hookform/resolvers ^3.9.0` minimum for Zod v4 (training data)
- `.planning/research/PITFALLS.md` — pitfall details P1-P6 validated against actual codebase
- `.planning/research/ARCHITECTURE.md` — route group structure recommendation validated against actual `(member)/`, `(trainer)/` directories

### Tertiary (LOW confidence — not verified against current code)
- `csv-parse ^5.5.0` exact patch: pin to `^5.5.0` and let pnpm resolve; live npm check skipped
- `react-hook-form` wizard patterns: training data, well-established library patterns

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified against `package.json`
- Architecture patterns: HIGH — grounded in direct file reads of all key files
- Migration requirements: HIGH — schema gaps confirmed by reading migration 001
- Pitfalls: HIGH — P1/P3/P5/P7 verified against actual code; P2/P4/P6/P8 from codebase analysis
- CSV import: MEDIUM — `csv-parse` API patterns from training data; exact behavior not live-tested

**Research date:** 2026-07-19
**Valid until:** 2026-08-19 (stable stack; 30 days)

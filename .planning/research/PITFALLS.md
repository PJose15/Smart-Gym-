# Pitfalls Research

**Domain:** Multi-tenant Gym SaaS — adding 6 launch-blocker features to existing Supabase + Next.js + Expo system
**Researched:** 2026-06-03
**Confidence:** HIGH (based on direct codebase reading + known patterns for this exact stack)

---

## Critical Pitfalls

### Pitfall 1: Stripe Webhook Idempotency — Double-Processing on Retry

**What goes wrong:**
Stripe retries webhooks for up to 3 days when it gets any non-2xx response or a timeout. The current `handleStripeWebhook` in `stripeHelpers.ts` has no dedup guard — it simply runs the DB update every time the event arrives. On a `customer.subscription.updated` retry the update is idempotent by coincidence (same values), but on `invoice.payment_failed` the status flip to `past_due` fires again, and on `trial_will_end` the agent trigger fires a second time. When adding the owner onboarding flow the risk doubles: the `checkout.session.completed` handler (not yet written) will create the gym row, create gym_settings, create gym_memberships, and set the owner role — if that event is retried, you get a UNIQUE constraint violation on `gyms.slug` (best case: insert fails, webhook returns 500, Stripe retries forever) or silently creates a second gym row (worst case, if the constraint is missing).

**Why it happens:**
The existing code was written before the onboarding flow existed. The billing events it handles today (`subscription.updated`, `subscription.deleted`, `invoice.payment_failed`) are idempotent DB updates, so the missing dedup never caused a visible incident. Adding a `checkout.session.completed` handler that creates rows changes the failure mode from "duplicate update" to "duplicate insert."

**How to avoid:**
Store processed Stripe event IDs in a `stripe_events_processed` table with a UNIQUE constraint on `event_id`. At the top of `handleStripeWebhook`, do:
```sql
INSERT INTO stripe_events_processed (event_id, processed_at)
VALUES ($1, now())
ON CONFLICT (event_id) DO NOTHING
RETURNING event_id;
```
If the RETURNING result is empty, return `{ action: 'duplicate' }` immediately. Add this migration before writing any new webhook handler. The table needs no RLS (service_role only) and one index on `event_id`.

**Warning signs:**
Supabase logs showing repeated `gym_billing` updates within seconds; Stripe dashboard showing "retried" on recent events; any 500 from the webhook route.

**Phase to address:** Phase 1 (Owner Onboarding) — must exist before `checkout.session.completed` is added.

---

### Pitfall 2: Onboarding Race Condition — gym row + gym_memberships + gym_billing created in three non-atomic steps

**What goes wrong:**
The owner onboarding flow must create: (1) a `users` row (via Supabase Auth callback), (2) a `gyms` row, (3) a `gym_memberships` row with role=owner, (4) a `gym_billing` row, (5) a `gym_settings` row. If any step after (1) fails, the user has a Supabase auth account but no gym — they are stuck. They cannot log in to the owner dashboard (the dashboard RLS helper `is_gym_owner` will find nothing) and they cannot complete the flow again because the email already exists in `auth.users`. If the Stripe checkout callback (`checkout.session.completed`) fires before the `gyms` row is committed, `gym_id` in Stripe metadata points to a non-existent row.

**Why it happens:**
Multi-step onboarding flows are inherently sequential. Without wrapping all DB inserts in a database transaction (or a single RPC), a network failure between steps leaves orphaned state. The current checkout route creates the Stripe customer first, then upserts `gym_billing` — these two are already not atomic.

**How to avoid:**
Create a Postgres function `complete_gym_onboarding(p_user_id, p_gym_name, p_gym_slug, ...)` that inserts into `gyms`, `gym_memberships`, `gym_billing`, and `gym_settings` in a single transaction. Call it from the Next.js API with service_role. Add a partial index to detect orphans: `CREATE INDEX IF NOT EXISTS idx_gyms_no_billing ON gyms(id) WHERE id NOT IN (SELECT gym_id FROM gym_billing)` — query this in a cleanup cron. Also add an `onboarding_status` column to `gyms` with values `['pending', 'stripe_pending', 'active']` so partial completions are detectable and resumable.

**Warning signs:**
Users emailing "I signed up but can't log in"; `gyms` rows with no matching `gym_memberships` row; `stripe_events_processed` showing `checkout.session.completed` events whose `gym_id` metadata returns null in a gyms query.

**Phase to address:** Phase 1 (Owner Onboarding).

---

### Pitfall 3: RLS Policy Missing for Newly-Created gym_id During Onboarding

**What goes wrong:**
After the onboarding transaction creates the gym, the owner immediately hits routes that call `is_gym_owner(gym_id)`. This helper (from migration 001) queries `gym_memberships` — but if the session JWT was issued before the memberships row was inserted, the JWT's `role` claim may still be `authenticated` with no gym context. Supabase RLS policies are evaluated with the JWT's claims at call time, not re-read from the DB. This means the first 5 minutes of the owner dashboard may return empty data sets (not errors — silently empty) because RLS evaluates `owned_gym_ids()` and finds nothing. The owner thinks the product is broken.

**Why it happens:**
Supabase JWTs are cached for the lifetime of the session (default 3600s). The `owned_gym_ids()` function does a live DB lookup on each call, so it should work — but this only applies when using service_role or when the RLS function has `SECURITY DEFINER`. Verify that `is_gym_owner` and `owned_gym_ids` are `SECURITY DEFINER` in migration 001. If they are `SECURITY INVOKER` (the default), they run as the calling role (anon/authenticated) which may lack permission to read `gym_memberships` cross-tenant.

**How to avoid:**
In migration 001, confirm `is_gym_owner`, `is_gym_trainer`, `is_gym_member`, and `owned_gym_ids` are all `SECURITY DEFINER`. After the onboarding RPC completes, force a session refresh on the client: call `supabase.auth.refreshSession()` before redirecting to the owner dashboard. Add an integration test: sign up as new owner, insert gym+membership, call `supabase.auth.refreshSession()`, then query `gyms` — assert the result has 1 row.

**Warning signs:**
Owner dashboard loads with 0 members, 0 machines immediately after sign-up; no 403 errors, just empty arrays; refreshing the page fixes it.

**Phase to address:** Phase 1 (Owner Onboarding).

---

### Pitfall 4: CSV Import — Partial Success Without Rollback Leaves Corrupt State

**What goes wrong:**
Owner uploads a 500-member CSV. The route processes rows sequentially, inserting into `members` and `gym_memberships`. Row 347 has a duplicate email that already exists in `auth.users` for a different gym. The insert fails. The owner now has 346 members created, 154 missing, and no way to know which — and no way to re-run the import because the first 346 would now fail on a UNIQUE constraint (if the route tries them again).

**Why it happens:**
CSV import routes commonly insert row-by-row without transaction wrapping, and Supabase's JS client does not support multi-statement transactions directly. Each `.insert()` call is its own transaction. A failure on row N does not roll back rows 1..N-1.

**How to avoid:**
Implement a "validate then import" two-phase approach. Phase 1 (validate): parse all rows in memory, check uniqueness within the CSV itself (dedup emails), check for required fields, return a `{ valid: [], invalid: [{ row, reason }] }` response with no DB writes. Phase 2 (import): only called if owner confirms after seeing the validation report. Use a Postgres function `bulk_import_members(p_gym_id, p_members jsonb[])` wrapped in a transaction, so all-or-nothing. Cap the import at 500 rows per request; for larger files, stream and paginate with a background job. Return a job ID for async status polling rather than blocking the HTTP request.

**Warning signs:**
Import route takes >30 seconds (serverless timeout risk); partial member counts after upload; owner reports "some members missing" after import.

**Phase to address:** Phase 1 (Owner Onboarding).

---

### Pitfall 5: CSV Encoding — Excel UTF-16 BOM Corrupts First Column Header

**What goes wrong:**
Most non-technical gym owners export their member list from Excel on Windows. Excel's "Save as CSV (UTF-16 LE)" adds a BOM (`\xFF\xFE`) at the start of the file. Standard `csv-parse` or manual `String.split('\n')` leaves the BOM attached to the first column name, so `email` becomes `﻿Email` and the header matching fails silently. The import appears to succeed but no emails are extracted (they are undefined), so Supabase inserts members with `email: null`, violating the NOT NULL constraint on `users.email` — or worse, if email is optional, creates member records with no contact info.

**Why it happens:**
Developers test with clean CSV files they generate programmatically. Real gym owner exports come from Excel (UTF-16 BOM), Google Sheets (UTF-8 no BOM), or gym management software (Windows-1252). The first is the most destructive because it looks like valid data in most editors.

**How to avoid:**
Use the `strip-bom` npm package (or inline: `if (content.charCodeAt(0) === 0xFEFF) content = content.slice(1)`) before parsing. Use `papaparse` which handles BOM, different line endings, and quoted fields better than manual splitting. Normalize the parsed headers with `.toLowerCase().trim()` and support common column name variations: `email`, `Email`, `Email Address`, `e-mail`. Return a clear error if required columns are not found. Test with an actual Excel-generated CSV in the test suite.

**Warning signs:**
First column header name in logs shows `﻿` prefix; `email` field is `undefined` or empty on imported rows; all imported members fail the email NOT NULL constraint.

**Phase to address:** Phase 1 (Owner Onboarding).

---

### Pitfall 6: Stripe "Customer But No Subscription" Ghost State

**What goes wrong:**
Owner starts the checkout flow. A Stripe customer is created and saved to `gym_billing.stripe_customer_id`. The owner abandons the Stripe-hosted checkout page (closes the tab, credit card declined, etc.). The `gym_billing` row now has a `stripe_customer_id` but `stripe_subscription_id` is null and `subscription_status` is still `'trial'`. When the owner returns and clicks "upgrade" again, the checkout route finds the existing customer_id and creates a new checkout session — this is correct. But if the owner tries three times over three days, three separate abandoned checkout sessions accumulate in Stripe against the same customer, and the Stripe dashboard looks alarming. More critically: the webhook for `checkout.session.expired` is not currently handled in `handleStripeWebhook`. Expired sessions do not clean themselves up.

**Why it happens:**
Checkout abandonment rate is typically 30-60%. The current code creates the customer eagerly (before the owner completes payment) to avoid creating a second customer on retry — which is the right call. But the expired session state is not explicitly tracked.

**How to avoid:**
Add `checkout.session.expired` to the webhook handler that resets `gym_billing.subscription_status` from `stripe_pending` to `trial` (add `stripe_pending` as a status). Add `checkout.session.completed` to finalize the onboarding. In the owner dashboard, show a "complete your subscription" banner whenever `subscription_status` is `trial` or `stripe_pending` and `stripe_customer_id` is set. The re-initiated checkout session re-uses the existing customer_id (already implemented correctly) — just ensure the banner CTA hits the checkout route, not a fresh signup page.

**Warning signs:**
`gym_billing` rows with `stripe_customer_id` set but `stripe_subscription_id` null and `subscription_status = 'trial'` for >24h; Stripe dashboard showing many "expired" sessions per customer.

**Phase to address:** Phase 1 (Owner Onboarding).

---

### Pitfall 7: Agent Trigger Infinite Loop — Notification Fires Agent, Agent Fires Notification

**What goes wrong:**
The notification orchestration phase wires events to push notifications. The agent wiring phase connects billing events to `triggerUptimizeAIAgent`. If the UptimizeAI agent responds by calling an internal API that creates a `notifications` row, and that row creation fires a Supabase DB webhook that calls the notification send Edge Function, which in turn calls back the agent trigger endpoint — you have an infinite loop. The current `triggerUptimizeAIAgent` in `triggerAgent.ts` is fire-and-forget with `.catch(console.error)`. A loop would exhaust Gemini quota, flood `smartgym_agent_logs`, and eventually 500 the app, silently (no alerting exists per the audit).

**Why it happens:**
The `agents/trigger` route currently only logs to `smartgym_agent_logs` and returns `{ success: true }` — it does not actually call the UptimizeAI external service yet (0% connected per audit). When the real agent connection is wired, the agent's response payload will contain actions to perform. If those actions call back into the same event stream, the loop forms. This is a topology error that is invisible until both features are live simultaneously.

**How to avoid:**
Add an `is_agent_initiated: boolean` flag to the notification creation payload. In the notification send path, skip the agent trigger entirely if `is_agent_initiated = true`. Add a cooldown table: before triggering an agent for a `(gym_id, agent_name, trigger_event)` combination, check `smartgym_agent_logs` for the same combination within the last N minutes. If found, skip and log `status: 'deduped'`. This is already structurally possible via `smartgym_agent_logs` — add a UNIQUE index on `(gym_id, agent_name, trigger_event, created_at::date)` or a time-bucketed dedup query. Maximum loop depth: 1 agent trigger per (gym, event, 5-minute window).

**Warning signs:**
`smartgym_agent_logs` growing faster than one row per workout session; Gemini billing spiking; notification_log accumulating rows without corresponding user sessions; Edge Function invocation counts in Supabase spiking.

**Phase to address:** Phase 5 (UptimizeAI Agent Connection) — dedup must be built before wiring the first agent. Also Phase 6 (Notification Orchestration) — the `is_agent_initiated` flag must be in the notification payload schema.

---

### Pitfall 8: Agent Triggers Non-Existent Schema Columns — Stale Field Reference

**What goes wrong:**
The audit found 4 code references to non-existent tables: `error_log`, `social_connections`, `platform_daily_metrics`, `admin_actions_log`. If agent trigger payloads are built by reading these tables (e.g., an agent that reads `platform_daily_metrics` to compute churn risk), the agent call silently returns empty data, the agent produces a no-op recommendation, and the gym owner sees nothing happen. Worse: if agent code tries to `INSERT` into `admin_actions_log` as an audit trail, it throws a runtime error that is currently swallowed by the `.catch(console.error)` in the webhook handler.

**Why it happens:**
The 4 dead table references were in existing code before this milestone. Adding agent wiring on top of broken references compounds the problem because agents will query existing helper functions that internally reference these tables.

**How to avoid:**
Before Phase 5, do a targeted cleanup pass: grep for all references to `error_log`, `social_connections`, `platform_daily_metrics`, `admin_actions_log` and either create minimal migrations for the tables that agents genuinely need, or replace the references with the correct table names from the 56-table schema. This is explicitly called out in the audit as "address opportunistically" — Phase 5 is the right moment because it forces you to read the agent trigger payloads. Add a CI test: `SELECT count(*) FROM information_schema.tables WHERE table_name IN ('error_log', 'social_connections', 'platform_daily_metrics', 'admin_actions_log')` and assert it matches the expected count of tables that actually exist.

**Warning signs:**
Agent trigger route returns 200 but `smartgym_agent_logs.status` shows `'sent'` with no downstream effect; any `relation "error_log" does not exist` in Vercel function logs.

**Phase to address:** Phase 5 (UptimizeAI Agent Connection) — resolve before wiring.

---

### Pitfall 9: Mobile Feed Pagination — Offset Gaps on Real-Time Inserts

**What goes wrong:**
The mobile feed uses the existing `gym_feed_events` backend. If the feed is fetched with offset-based pagination (`OFFSET 0 LIMIT 20`, then `OFFSET 20 LIMIT 20`), a new feed event inserted between the two requests shifts all rows by 1 — the item that was at position 20 is now at position 21, and is skipped. The member sees a gap in their feed. Alternatively, if the member pulls to refresh (resetting to OFFSET 0), they see duplicate items if the FlatList key is based on array index rather than item ID.

**Why it happens:**
Offset pagination is simple to implement but incorrect for real-time-inserted tables. The web admin feed (already built) appears to use offset pagination based on the existing `/api/member/feed` route pattern. Copying that pattern to mobile propagates the bug.

**How to avoid:**
Use cursor-based pagination on `created_at` + `id`: `WHERE created_at < :cursor ORDER BY created_at DESC LIMIT 20`. The cursor is the `created_at` of the last fetched item. On pull-to-refresh, set cursor to `now()`. This is immune to inserts. On the mobile FlatList, use `item.id` (UUID) as the `keyExtractor`, never the array index. Add a `useFeedPagination` hook in the mobile app that manages cursor state.

**Warning signs:**
QA sees "missing" feed items when logging a workout and then scrolling the feed; duplicate items after pull-to-refresh; the mobile feed has visibly fewer items than the web feed for the same gym.

**Phase to address:** Phase 2 (Mobile Social Feed).

---

### Pitfall 10: Mobile Screen Performance — Reproducing the 20-Query Home Screen Problem on Feed/Challenge Screens

**What goes wrong:**
The audit explicitly flags the mobile home screen making 20+ DB queries on load as a performance concern. The mobile feed, challenges, and program screens are being added now. If each new screen follows the same pattern of `useEffect(() => { fetchX(); fetchY(); fetchZ(); }, [])` with independent API calls for each piece of data, the feed screen could easily accumulate 5-8 calls (feed events, user reactions, challenge snippets, notification count, gym info). On a 3G connection, each call adds ~200-400ms latency. The screen takes 2-3 seconds to become interactive.

**Why it happens:**
React Native screens built screen-by-screen, each owning its own data fetching, naturally accumulate independent queries. There is no established pattern in the existing mobile code for server-side aggregation — the home screen with 20+ calls is the model being followed.

**How to avoid:**
For each new mobile screen, create a single aggregated API endpoint that returns all data needed for that screen in one call. For the feed screen: `/api/member/feed-screen` returns `{ feed_events: [], active_challenges: [], unread_count: number }`. For the challenge screen: `/api/member/challenges-screen` returns `{ active: [], completed: [], leaderboard: [] }`. Use `Promise.all()` on the server side for independent queries — the server query time is the max of the parallel queries, not the sum. Add a loading skeleton that displays immediately, so perceived performance is fast even if data takes 800ms.

**Warning signs:**
Supabase query logs showing 5+ queries originating from the same mobile session within 100ms; Expo DevTools network tab showing many concurrent API calls on screen mount.

**Phase to address:** Phases 2, 3, 4 (Mobile Feed, Challenges, Program). Establish the aggregated-endpoint pattern in Phase 2 and carry it forward.

---

### Pitfall 11: Notification Preference Bypass — Push Sent Despite User Opt-Out

**What goes wrong:**
The `notification_preferences` table exists (migration 021 added the `enabled` column) and the schema has granular preference columns. But the `push/send` route (`/api/push/send/route.ts`) does not check `notification_preferences` at all — it inserts into `notifications` and returns success regardless of the user's preferences. When the notification orchestration phase wires 24+ triggers, every trigger will have the same bypass. A user who turned off achievement notifications will still receive them.

**Why it happens:**
The `push/send` route was built for the owner-initiated broadcast use case (owner sends a message to a gym or member). It has no concept of per-user preference filtering. The notification orchestration will re-use this route or a similar pattern, inheriting the bypass.

**How to avoid:**
Create a `sendNotificationWithPreferenceCheck(memberId, notificationType, payload)` server-side utility that: (1) reads `notification_preferences` for the member, (2) checks the preference for `notificationType` against the `enabled` boolean and the specific type flag, (3) checks quiet hours (no pushes between 22:00 and 08:00 member local time), (4) calls the Edge Function only if all checks pass. Every notification trigger in Phase 6 must call this utility, never the raw Edge Function or push/send route directly.

**Warning signs:**
Members receiving push notifications after toggling off preferences in settings; notification audit shows pushes sent at 3am; App Store review mentions notification spam.

**Phase to address:** Phase 6 (Notification Orchestration) — build the utility before wiring any triggers. The preference check utility is the first task of Phase 6.

---

### Pitfall 12: Device Token Rot — Unbounded Table Growth and Silent Delivery Failure

**What goes wrong:**
The `device_tokens` table accumulates rows as users install, uninstall, and reinstall the app. Expo push tokens expire when a user uninstalls and reinstalls (new token) or when iOS revokes the token (app uninstall). The current push send path does not handle `DeviceNotRegistered` errors from the Expo Push API — errors are swallowed in the Edge Function. Over 6 months with 1000 members each having 1-2 devices, the table could have 3000+ rows of which 40-60% are expired. Every gym-wide push blast queries `device_tokens WHERE gym_id = ? AND active = true` — but "active" is not automatically set to false when Expo returns `DeviceNotRegistered`, so the flag is always true.

**Why it happens:**
The `send-push-notification` Edge Function was built for the happy path. Handling the Expo API response (`tickets` and `receipts`) requires a two-step process: (1) send returns ticket IDs, (2) poll the receipts endpoint up to 30 minutes later to know if delivery succeeded or failed. Most implementations skip step 2.

**How to avoid:**
In Phase 6, implement the Expo receipt polling pattern: after sending, store the ticket IDs in a `push_tickets` table with a TTL. A cron job (add to the existing 8 cron jobs) runs every 15 minutes to check receipts. For any receipt with `status: 'error'` and `details.error: 'DeviceNotRegistered'`, set `device_tokens.active = false` and log the deactivation. The existing index `idx_device_tokens_profile_active` (from migration 023) filters on `active = true` which makes the deactivation immediately effective for future queries.

**Warning signs:**
Expo push API returning `DeviceNotRegistered` errors that are ignored; `device_tokens` table count growing faster than active member count; push delivery rate (delivered / sent) declining over time.

**Phase to address:** Phase 6 (Notification Orchestration).

---

### Pitfall 13: Rate Limiter Reset on Deploy Breaks Onboarding Routes

**What goes wrong:**
The current rate limiter is an in-memory `Map<string, number[]>` in `rateLimit.ts`. Every Vercel deployment (including preview deployments triggered by each PR) resets the Map to empty. The billing/checkout route has a rate limit of 5 requests per 5 minutes per user (`billing-checkout:${user_id}`). On a fresh deploy, anyone who was rate-limited can immediately retry. During the onboarding flow, the 4-step signup wizard makes multiple API calls. If step 3 (Stripe checkout) fails and the owner retries, the rate limit counter has reset — which is fine. But the deeper problem: if the onboarding page is open in two tabs simultaneously (owner split-screening the process), two checkout sessions could be created for the same gym, creating two Stripe customers and a double `gym_billing` insert.

**Why it happens:**
In-memory rate limiting is acknowledged in the codebase (`LIMITATION: State resets on server restart`) and in the PROJECT.md constraints (`Acceptable for now, durable store deferred`). The risk is specifically elevated during onboarding because the operations being rate-limited are write operations that create persistent state.

**How to avoid:**
For the three most dangerous onboarding routes (gym creation, checkout session creation, CSV import), add a Postgres-backed dedup check as a second line of defense. For checkout: check `gym_billing` for an existing `stripe_customer_id` before calling Stripe (the checkout route already does this — verify this check is also inside a transaction with the gym creation). For gym creation: the `UNIQUE` constraint on `gyms.slug` provides natural dedup. For CSV import: add a `import_jobs` table with status tracking to prevent duplicate import submissions. The rate limiter's in-memory limitation is not fixed in this milestone — just ensure idempotent DB operations compensate for it.

**Warning signs:**
Two `gym_billing` rows for the same gym_id (caught by UNIQUE constraint on `gym_id`); two Stripe customers with the same email and metadata.gym_id; two `checkout.session.completed` webhooks for the same gym within 60 seconds.

**Phase to address:** Phase 1 (Owner Onboarding).

---

### Pitfall 14: Deep Link to Deleted Resource Crashes Mobile App

**What goes wrong:**
A push notification is sent for a challenge ("3 days left — join now!"). The gym owner deletes the challenge (from the web admin) before the member taps the notification. The notification's deep link goes to `/challenge/{id}`. The mobile challenge screen calls the challenges API, gets a 404 or empty response, and the screen either crashes (if it calls `.participants[0].name` on undefined) or renders a blank screen with no back navigation visible, trapping the user.

**Why it happens:**
Deep links in notifications are composed at send time, when the resource exists. The resource can be deleted before the notification is delivered or tapped. Mobile screens that assume the API will always return data are not written defensively.

**How to avoid:**
Every mobile screen that is a deep link target must handle the "resource not found" state explicitly — show a "This content is no longer available" message with a "Go back" button, not a crash or blank screen. In the notification payload, include the resource type and a short expiry hint so the mobile client can skip deep linking for clearly stale notifications. In the challenges screen, add null guards on all data accesses and a `notFound` state to the screen's state machine.

**Warning signs:**
Crash reports from Expo error boundary for screens receiving 404 API responses; users reporting "notifications don't work" (they work but crash the app).

**Phase to address:** Phases 3 (Mobile Challenges), 6 (Notification Orchestration). Phase 3 builds the defensive screens; Phase 6 adds the expiry hint to notification payloads.

---

### Pitfall 15: Multi-Tenancy Leak via gym_id in Mobile Deep Link

**What goes wrong:**
A mobile deep link like `nexera://gym/abc-123/feed` embeds a `gym_id`. If a member is in Gym A and somehow receives or constructs a deep link for Gym B's feed, the mobile app fetches from `/api/member/feed?gym_id=abc-123`. The API route uses `verifyMember()` which validates the session but may not validate that the requesting member belongs to `gym_id=abc-123`. If the feed query is scoped only by `gym_id` without also checking `gym_memberships`, a member can read another gym's private feed.

**Why it happens:**
The existing feed API uses the `verifyMember()` helper which resolves the gym from the member's session. But the mobile client may pass `gym_id` as a URL parameter, and the route may use that parameter rather than the session-derived gym_id if the route was written to accept gym_id in the query string (a common pattern for multi-gym support that is out of scope for launch).

**How to avoid:**
In all mobile API routes that accept `gym_id` as a parameter, validate that `gym_id` matches the gym returned by `verifyMember()`. Never trust a client-supplied `gym_id` without cross-checking against the authenticated session. The pattern to use: `const { gym_id: session_gym_id } = await verifyMember(); if (query_gym_id && query_gym_id !== session_gym_id) return 403;`. Add a test for every new mobile API route: "member from gym A cannot fetch data with gym B's ID."

**Warning signs:**
A member seeing content they don't recognize in their feed (wrong gym); Supabase logs showing `gym_feed_events` rows being read by a `member_id` not in that gym's `gym_memberships`.

**Phase to address:** Phase 2 (Mobile Social Feed) — establish the pattern, carry it to Phases 3, 4.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Skipping the Expo push receipt polling loop | Simpler initial implementation | Expired tokens never cleaned; delivery rate silently declines; `device_tokens` grows unbounded | Never for production — implement in Phase 6 |
| Copying the web feed's offset pagination to mobile | 1 hour of work instead of building cursor pagination | Duplicate/missing feed items for active gyms; regression only visible at scale | Never — use cursor pagination from the start in Phase 2 |
| Re-using `push/send` route directly from notification triggers without preference check | No new utility to build | Every automated notification ignores user opt-out; immediate App Store review risk | Never — build the preference utility first |
| Creating the Stripe checkout session before the gym row exists in DB | Simpler flow ordering | `checkout.session.completed` webhook fires with a `gym_id` pointing to a non-existent row; webhook fails and retries indefinitely | Never — gym row must exist before Stripe checkout is created |
| Skipping the `stripe_events_processed` dedup table | No migration to write | Webhook retries create duplicate gyms or duplicate state transitions | Never — add before first new webhook event type |
| Building agent wiring without `smartgym_agent_logs` dedup check | Faster feature delivery | Infinite agent-notification loop in production | Never — dedup is the first task of Phase 5 |
| Using `Promise.all([fetch1, fetch2, fetch3])` in mobile screens instead of one aggregated endpoint | Easier to test each call independently | 3x RTT overhead on mobile; screen takes 3x longer to load; repeats the known 20-query home screen problem | Acceptable only for development/prototype; must be consolidated before QA |
| Skipping `is_agent_initiated` flag on notifications | Simpler notification schema | Agent → notification → agent loop has no circuit breaker | Never — add the flag to the notification schema in Phase 6 before wiring any trigger |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Stripe webhooks | Not verifying the signature on every call | `stripe.webhooks.constructEvent(body, sig, secret)` is already done — do not remove it when adding new event handlers |
| Stripe webhooks | Using `event.data.object.metadata.gym_id` without null-checking | Always guard: `const gymId = sub.metadata?.gym_id; if (!gymId) return { action: 'no_gym_id' }` — pattern already in code, extend it |
| Stripe checkout | Creating new customer on every checkout attempt | Always check `gym_billing.stripe_customer_id` first — already done in checkout route |
| Stripe customer portal | Returning to `/owner/billing` after portal without revalidating subscription | Portal can cancel, upgrade, or downgrade — revalidate billing status on `?success=true` return URL |
| Supabase RLS with service_role | Using `createClient` with anon key in server routes instead of service_role | The `getAdminClient()` pattern in billing routes uses service_role correctly — verify every new server route uses the same pattern |
| Supabase RLS helper functions | Calling `is_gym_owner()` from a client-side query | These are server-side Postgres functions; client queries must go through API routes that use service_role, not direct Supabase client calls from mobile |
| Expo Push API | Treating push send as fire-and-forget | Push sends return ticket IDs; receipts must be polled within 30 minutes to detect failures. Two-step process is mandatory for production reliability |
| Expo Push API | Sending >100 pushes in a single batch | Expo recommends max 100 per batch; for gym-wide blasts (potentially 500+ members), split into batches of 100 with 100ms delay between batches |
| UptimizeAI external API | Not handling the case where the external service is down | The `triggerUptimizeAIAgent` call is already fire-and-forget; ensure the calling code never awaits it in a request path; log failures to `smartgym_agent_logs.status = 'error'` |
| Supabase Edge Functions | Calling the `send-push-notification` Edge Function synchronously from a Next.js route | Edge Function cold starts can take 500ms+; always call from a background job or queue, never in a user-facing request path |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Mobile screen making N+1 API calls on mount | Screen takes 2-3 seconds to show content; Supabase logs show 5-10 queries per page view | One aggregated endpoint per screen; `Promise.all()` on server side | At 500 concurrent users during gym peak hours |
| `device_tokens` full table scan per notification | Push send latency increases; `idx_device_tokens_profile_active` not being used if query lacks `WHERE active = true` | Always include `AND active = true` in device token queries; the index is partial (migration 023) and only covers active tokens | At 10,000 total token rows (mixed active/inactive) |
| Leaderboard `SELECT *` without caching on challenge screen | Challenge leaderboard is slow; same query runs for every member viewing the challenge simultaneously | Cache leaderboard in `leaderboard_snapshots` (table exists); invalidate on `challenge_participants.score` update; serve from cache with a max-age of 60 seconds | At 50 concurrent members viewing the same challenge |
| `smartgym_agent_logs` growing without TTL | Table scan on every dedup check; agent trigger route slows down | Add a TTL cron (the 8 existing cron jobs are a model) to delete rows older than 90 days | At 1 million rows (~1 year of heavy use) |
| CSV import processing 1000+ rows in a synchronous HTTP request | Vercel function timeout (10-30s limit on free/pro); route returns 504; owner retries, creating duplicate import | Max 500 rows per synchronous request; for larger files, return a job ID and poll for completion | At 200+ rows on a slow connection |
| `gym_feed_events` pagination without index on `(gym_id, created_at DESC)` | Feed load time increases as event history grows | Verify this index exists in migration 001 or 023; add it if missing before Phase 2 ships | At 10,000 feed events per gym (~6 months of active use) |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Trusting `gym_id` from mobile deep link without session verification | Member reads another gym's feed, challenges, or member data (tenant isolation breach) | Always derive `gym_id` from `verifyMember()` session; treat client-supplied `gym_id` as a hint, not a fact |
| Creating owner account without email verification | Anyone can sign up as gym owner with a fake email; Stripe trial period is consumed with no intent to pay | Add Supabase email confirmation before creating the gym row; use `supabase.auth.signUp` with `emailRedirectTo` pointing to step 2 of onboarding |
| Exposing member PII in push notification body | iOS/Android lock screen shows notification body; trainer coach notes or health data visible on lock screen | Keep notification `body` to generic strings like "You have a new check-in response"; never include member name, weight, or health metrics in the body |
| CSV import endpoint accessible to non-owners | Any staff member with a session token could import or overwrite all members | Ensure the CSV import route uses `verifyStaff('owner')` (same pattern as `billing/checkout`) |
| Agent trigger endpoint using a static `INTERNAL_WEBHOOK_KEY` that is the same across environments | Staging key compromise gives access to production agent triggers | Use different keys per environment; rotate quarterly; the current code already validates the key is present — ensure the key is in Vercel environment variables per-environment |
| Notification preferences read-only in UI but not enforced server-side | User toggles off notifications, still receives them; legal risk in GDPR jurisdictions where notification opt-out must be respected | The preference check utility (see Pitfall 11) must be enforced server-side, not just hidden in UI |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Onboarding flow has no progress indicator | Owner abandons at step 3 of 4 not knowing how close they are to done | Show step X of Y with a progress bar; persist partial state in localStorage so a page reload does not lose form data |
| First-machine wizard skipped or abandoned | Owner sees empty machine list; QR scan flow returns "no machines at this gym"; members scanning QR codes get errors on day 1 | After Stripe payment, force entry into the machine wizard before reaching the dashboard; do not allow skipping until at least 1 machine is created |
| CSV import with validation errors shows raw error object | Owner sees `{"code": "23505", "detail": "Key (email)=(john@gym.com) already exists."}` | Map database constraint errors to human messages: "This email is already registered: john@gym.com" |
| Challenge leaderboard cached 60s but shows stale rank after user just scored | User submits a set, sees their leaderboard rank unchanged, thinks the system is broken | Show a "scores update every minute" indicator near the leaderboard; optimistically update rank locally on score submission |
| Push notification tapped when app is backgrounded navigates to wrong screen | User taps "New workout session logged" notification, lands on home screen instead of the workout | Implement Expo's `addNotificationResponseReceivedListener` and map `notificationType` to deep link destination; test all 24+ notification types |
| Mobile program view shows full week but does not highlight today | User cannot quickly identify what to do today in a week view | Highlight today's date/column; show "Today" label; auto-scroll to today on mount |

---

## "Looks Done But Isn't" Checklist

- [ ] **Owner Onboarding:** The gym is created and the owner can log in — but verify `gym_settings` row also exists with defaults, `gym_billing` row exists, at least one machine exists before marking onboarding complete.
- [ ] **CSV Import:** The import completes and member count increases — but verify members can actually log in (they need entries in `auth.users` OR the import is invitation-only with invite emails sent).
- [ ] **Stripe Integration:** Checkout completes and webhook fires — but verify `subscription_status` is `'active'` (not stuck at `'trialing'`), `stripe_subscription_id` is saved, and the owner dashboard billing page shows the correct plan.
- [ ] **Mobile Feed:** Feed items appear on screen — but verify reactions work (tap reaction → API call → optimistic update → server confirmation), comments load, and pull-to-refresh fetches new events without duplicating existing ones.
- [ ] **Mobile Challenges:** Challenge list loads — but verify the join button calls the correct API and the member appears in the challenge leaderboard within 60 seconds.
- [ ] **Notification Wiring:** A push is delivered — but verify: (1) user who opted out does NOT receive it, (2) quiet hours are respected, (3) the device token is valid (test against a known-expired token), (4) tapping the notification navigates correctly.
- [ ] **Agent Triggers:** Agent trigger logs show `status: 'sent'` — but verify the UptimizeAI external service actually receives and processes the call (check the external service's own logs); `'sent'` in `smartgym_agent_logs` only means the internal endpoint was called, not that UptimizeAI did anything.
- [ ] **RLS on New Routes:** New API routes authenticate correctly — but verify with a test: call the route with a session token from a different gym and assert 403 or empty result, never data from the wrong gym.

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Duplicate gym created by webhook retry | HIGH | Identify the duplicate; merge member data if any; delete duplicate gym row; update `stripe_customer_id` to point to correct gym; add dedup table immediately |
| Partial CSV import (200 of 500 members created) | MEDIUM | Query `members WHERE gym_id = X ORDER BY created_at DESC` to find which members were created; re-run import with only the missing rows; add the import_jobs tracking table before re-running to prevent re-duplication |
| Agent-notification infinite loop in production | HIGH | Add `is_agent_initiated` flag immediately (hotfix migration); deploy; loop stops on next event; clean up `smartgym_agent_logs` and `notification_log` flood manually |
| Device token table with 80% expired tokens | MEDIUM | One-time cleanup: query Expo's `/getReceipts` endpoint for a batch of tokens, mark expired ones `active = false`; then deploy the receipt polling cron job to prevent recurrence |
| Owner stuck in "customer but no subscription" state | LOW | Manually trigger a new checkout session for the owner via admin dashboard (add admin action); or use Stripe dashboard to resend the invoice; add `stripe_pending` status and banner to prevent future occurrences |
| Stripe webhook retrying indefinitely (non-idempotent handler) | HIGH | Add `stripe_events_processed` table migration immediately; re-process the stuck event manually to verify idempotency; confirm with Stripe that event retries stop after the table check returns success |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Webhook idempotency (duplicate processing) | Phase 1 | Test: send same webhook event twice; assert DB state changed only once |
| Onboarding race condition (multi-step non-atomic) | Phase 1 | Test: simulate failure after gyms INSERT but before gym_memberships INSERT; verify cleanup detects orphan |
| RLS gap after session creation (empty dashboard) | Phase 1 | Test: sign up new owner, immediately call owner dashboard API without session refresh; assert data is accessible after forced refresh |
| CSV partial import without rollback | Phase 1 | Test: import CSV with a bad row at position 50%; verify 0 members imported (all-or-nothing) or full validation report returned |
| CSV UTF-16 BOM corruption | Phase 1 | Test: import an actual Excel-generated CSV with BOM; assert emails parsed correctly |
| Stripe ghost state (customer no subscription) | Phase 1 | Test: abandon checkout, return to billing page; assert "complete subscription" CTA is shown |
| Agent infinite loop | Phase 5 (dedup) + Phase 6 (flag) | Test: trigger agent that creates notification; assert notification does NOT re-trigger agent; check `smartgym_agent_logs` shows at most 1 entry per 5-minute window |
| Agent querying non-existent tables | Phase 5 | Test: CI SQL check for the 4 dead table references resolves before agent wiring |
| Feed offset pagination gaps | Phase 2 | Test: insert new feed event between page 1 and page 2 fetch; assert item appears exactly once across both pages |
| Mobile screen N+1 queries | Phase 2, 3, 4 | Test: instrument API calls on mount; assert each screen makes at most 2 API calls (1 for data, 1 for user context) |
| Notification preference bypass | Phase 6 | Test: set preference `achievements = false`; trigger achievement push; assert push NOT delivered |
| Device token rot | Phase 6 | Test: mock Expo API returning `DeviceNotRegistered`; assert token marked `active = false` in DB |
| Rate limiter reset on deploy | Phase 1 | Verify idempotency at DB level compensates for in-memory limiter; test concurrent duplicate checkout calls |
| Deep link to deleted resource crash | Phase 3, Phase 6 | Test: send push with challenge ID; delete challenge; tap notification; assert "not found" screen renders without crash |
| Multi-tenancy leak via gym_id param | Phase 2 | Test: member A calls feed API with gym B's gym_id; assert 403 response |

---

## Cross-Cutting Integration Pitfalls (Feature X + Feature Y)

**Owner Onboarding + Notification Orchestration:**
The owner signs up and should receive a "Welcome to SmartGym" push notification. But at signup the owner has no `device_tokens` entry (they just created their account on the web, not mobile). The notification orchestration phase must handle the case where a user has no registered devices gracefully — log `status: 'no_devices'`, do not error. Also: the welcome email (from onboarding) and the welcome push (from notification orchestration) must not both fire at the same time. Deduplicate welcome communications in the notification orchestration design.

**Agent Triggers + Billing Webhooks:**
The current webhook handler already calls `triggerUptimizeAIAgent` for three billing events (cancellation, payment failure, trial ending). When Phase 5 actually connects UptimizeAI, these three triggers will suddenly produce real outbound API calls instead of fire-and-forget no-ops. The behavior change is invisible at the code level — the same three lines of code go from doing nothing to doing something real. This must be tested in staging before Phase 5 ships to production. Add an integration test that mocks the UptimizeAI endpoint and verifies the correct agent names and payloads are sent for each billing event type.

**Mobile Challenges + Gamification Engine:**
Challenge participation writes to `challenge_participants.score`. The existing session completion route (`/api/sessions/[id]/complete`) awards points, updates streaks, and checks achievements all in one atomic operation. Challenge score updates must be wired to this same operation — not added as a separate mobile API call — otherwise a member could get achievement credit without their challenge score updating, or vice versa.

**Mobile Feed + Offline Queue:**
The mobile app already has an offline write queue for workout sessions. If a member reacts to a feed item while offline, the reaction should be queued. But the current offline queue is specifically for workout set logging. Extending it to social actions (reactions, challenge joins) requires a schema change to the queue format that includes the action type. Do not silently drop offline social actions — queue them or show a "you're offline" state.

---

## Sources

- Direct codebase reading: `apps/web-admin/src/app/api/billing/webhook/route.ts`, `apps/web-admin/src/lib/billing/stripeHelpers.ts`, `apps/web-admin/src/lib/billing/triggerAgent.ts`, `apps/web-admin/src/lib/rateLimit.ts`, `apps/web-admin/middleware.ts`
- Direct schema reading: `supabase/migrations/001_nexera_schema.sql`, `021_schema_alignment.sql`, `023_rls_policies_triggers_indexes.sql`
- `NEXERA_FULL_CODEBASE_AUDIT.md` — Section 6 (mobile gaps), Section 9 (dead tables), Section 10 (missing for production)
- `.planning/PROJECT.md` — constraints, known issues, technology lock-in decisions
- Stripe webhook retry behavior: documented in Stripe official docs (retries for 3 days, exponential backoff)
- Expo Push Notifications two-step receipt pattern: Expo official documentation
- Supabase RLS `SECURITY DEFINER` requirement: Supabase official documentation on row-level security helper functions

---
*Pitfalls research for: SmartGym (NEXERA) — 6 launch-blocker features on existing multi-tenant system*
*Researched: 2026-06-03*

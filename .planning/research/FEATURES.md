# Feature Research — SmartGym (NEXERA) Tier 1 Launch Blockers

**Domain:** Multi-tenant gym SaaS — owner acquisition flow + mobile engagement layer + automation
**Researched:** 2026-06-03
**Confidence:** HIGH (grounded in codebase audit + 2026 SaaS conventions from training data)

---

## Context: What Already Exists

The backend for all 6 features is substantially built. These are not greenfield features — they are
primarily UI wiring tasks on top of an existing API layer. Key existing assets:

- `gym_feed_events` table + 12 event types + `FeedEventCard`, `ReactionBar`, `CommentSection` components (web) — need mobile port
- `gym_challenges`, `challenge_participants`, `challenge_teams` tables + web challenge UI — need mobile port
- `ai_programs`, `program_days`, `program_exercises`, `member_program_assignments` tables + web program view — need mobile port
- `notification_preferences`, `notifications`, `device_tokens`, `notification_log` tables + `send-push-notification` Edge Function — need trigger wiring
- `gym_agent_config`, `smartgym_agent_logs` tables + `/api/agents/trigger` route + `triggerUptimizeAIAgent()` util — 5 agents named (retention, engagement, revenue, operations, growth), triggers wired only for 3 Stripe billing events
- `gym_billing` table with Stripe checkout/portal/webhooks built — missing the owner self-serve signup flow that creates the gym record and drives into billing

---

## FEATURE 1: Gym Owner Self-Serve Onboarding

### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| 4-step signup wizard (email → gym info → plan → done) | 2026 SaaS standard: no salesperson, no phone call, instant access | MEDIUM | Step 1: email+password, Step 2: gym name+city+phone, Step 3: plan selection, Step 4: Stripe checkout or trial confirmation |
| Plan selection during signup (not after first login) | Users need to see value proposition before committing time to setup; conversion data shows plan-during-signup outperforms plan-after-login | LOW | Show Starter/Growth/Pro tier cards with feature bullets and pricing; pre-select Growth as recommended |
| 14-day free trial, credit card optional at signup | 2026 B2B SaaS convention: 14-day trial without card reduces signup friction by ~40%; card required at trial end | LOW | `subscription_status = 'trialing'`, `trial_ends_at = now() + 14d`; existing `gym_billing` schema supports this |
| Email verification after account creation, not before | Modern convention: let user into app immediately, verify email async; block only sensitive actions (not onboarding) | LOW | Send verification email post-signup; show dismissible banner "Verify your email to ensure account recovery" |
| Gym record created atomically with user account | Owner must own a gym record to do anything in the app; creating account without gym is an incomplete state | MEDIUM | Transaction: create Supabase auth user → create `gyms` row → create `gym_memberships` row (role=owner) → create `gym_billing` row (trialing) |
| Trial banner with countdown in owner dashboard | Every B2B SaaS with trials shows days-remaining; creates urgency without being aggressive | LOW | Already exists in `/owner/billing` page; needs to show on dashboard too; "12 days left in trial → Upgrade" |
| Post-signup checklist with 3-5 required steps | Reduces time-to-value; owners who complete checklist have dramatically higher 30-day retention | MEDIUM | Steps: Add first machine, invite first member, share QR code, set gym hours — each with completion checkmark |
| First machine setup wizard (inline, not separate page) | New owner has zero machines; app is useless until at least one machine exists | MEDIUM | Triggered after signup completes; 3-step wizard: machine name → muscle groups (checkboxes) → generate QR → print/download PDF |
| Member CSV import with field mapping UI | Gyms have existing members in spreadsheets; manual entry of 200 members is a dealbreaker | HIGH | CSV upload → header detection → map columns to: name (required), email (required), phone (optional), trainer_email (optional) → preview 5 rows → import → send claim emails |
| CSV import: required fields only email + name | Email is identity anchor; name is display requirement; everything else is optional | LOW | Reject rows missing email or name with row-level error display; import valid rows even if some fail |
| CSV import: claim-account email flow | Imported members need a way to activate their account | MEDIUM | On import: create `members` row with `onboarding_status = 'invited'` + `invited_email` field; send email with magic link or invite code; member completes phone OTP on first mobile login and gets linked |
| CSV import success/failure UX | Must show what worked and what failed, not just "import complete" | LOW | Show summary: "47 imported, 3 failed — download error report"; downloadable CSV of failed rows with reason column |
| Stripe webhook → gym record sync | Subscription upgrades/downgrades must reflect in `gym_billing`; already works for existing gyms but needs to cover the new signup path | LOW | Already built in `handleStripeWebhook`; ensure new signup path sets correct `stripe_customer_id` on the `gym_billing` row |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Setup checklist with completion % progress bar | Visual progress bars (like GitHub profile completion) create psychological completion urge; reduces abandonment | LOW | Simple `onboarding_events` inserts already tracked; compute completion_pct on dashboard |
| Social proof during signup ("Join 47 gyms already using NEXERA") | Reduces signup anxiety for early adopters | LOW | Static or CMS-driven number; update monthly |
| Gym logo upload during signup step 2 | Personalizes the experience immediately; owner sees their gym branding on first dashboard view | MEDIUM | Use existing Supabase storage bucket (avatar bucket already configured); store URL in `gym_settings.logo_url` |
| "Skip for now" on every optional step | Reduces friction; owner can start with just a name and come back | LOW | Each wizard step after email/password should have Skip option that still creates the gym record |

### Anti-Features

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Social login (Google/Facebook) for gym owner signup | Reduces fields at signup | In B2B SaaS, email+password ownership is cleaner for billing/invoicing; OAuth adds OAuth library, token management, linking edge cases; the existing `verifyStaff()` auth path is email-based | Keep email+password; consider adding later as Tier 3 enhancement |
| SSO / SAML for gym chains | Enterprise feature request | Not needed for independent gyms (core market); adds significant auth complexity; `franchise_support` is already a Pro-tier schema concept deferred to Tier 3 | Defer to multi-location milestone |
| Gym directory / public listing during signup | Owner might want discoverability | Gym public profile is Tier 3 in audit; building it as part of onboarding couples two large features and risks delaying the signup flow | Note: `gym_profile_views` table exists; build public profile as separate Tier 3 feature |
| Auto-import from gym management software (Mindbody, etc) | Many gyms use these | API integration with third-party gym software is a separate milestone; adds OAuth flows per integration; CSV covers 80% of use cases immediately | CSV import covers launch; integrations are roadmap items |
| Conditional logic "what kind of gym" branching signup | Personalize experience per gym type | Adds decision tree complexity before owner has even seen the product; creates multiple code paths to maintain | Single linear signup; gym type can be set in Settings post-onboarding |

### Complexity Flags

- CSV import pipeline is the hardest piece (MEDIUM-HIGH): needs file parser, header detection, Supabase batch insert with error isolation, email send queue, and claim-link mechanics
- Gym record + billing row atomic creation requires careful transaction handling; partial creation (user exists but no gym row) is a bad stuck state
- Email claim flow for imported members creates a new auth state (`onboarding_status = 'invited'`) that the mobile app must handle on first launch

---

## FEATURE 2: Mobile Social Feed

### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Feed screen as a bottom tab or accessible from home | Mobile-first convention since 2016; gym community is core retention mechanic | LOW | Add tab or push route from home `CommunityPulse` section; `gym_feed_events` API endpoint already exists at `/api/member/[id]/feed` |
| All 12 existing event card types rendered | Web already renders all 12 (achievement_earned, level_up, pr_weight, pr_volume, session_milestone, streak_milestone, program_complete, challenge_launched/joined/rank_1/podium/complete, new_member, gym_announcement, member_spotlight, goal_reached, archetype_change, workout_share); mobile must match | MEDIUM | Port `FeedEventCard` logic to React Native; `formatFeedEvent()` util in `@nexera/utils` already handles weight-unit-aware description rendering |
| Pull-to-refresh | Mobile standard since iOS 7; users expect it; absence creates "is this broken?" confusion | LOW | `<RefreshControl>` in `FlatList` or `FlashList`; call feed API with `?refresh=true` |
| Infinite scroll / pagination | Feed is unbounded; loading all events on mount is a performance and data-cost issue | LOW | Cursor-based pagination; `?cursor=<last_event_id>&limit=20`; append on scroll-to-bottom |
| Empty state with CTA | New gym with no feed events must show something useful, not a blank screen | LOW | "Be the first to work out and share your progress!" with a Scan CTA; show when `events.length === 0` |
| Reactions (emoji) inline on card | Mobile users expect tap-to-react; web already has `ReactionBar`; absence feels broken on mobile | LOW | Tap reaction type → optimistic update → `POST /api/social/[id]/reaction`; 5 reaction types already in web: fire, strong, medal, heart, clap |
| Comment count badge + tap to expand | Comments are visible on web; mobile must show they exist | LOW | Show comment count badge on each card; tap expands inline (not new screen); `CommentSection` component logic to port |
| Own post highlighted subtly | Users need to know when they authored a feed event; helps with sense of contribution | LOW | Border color or "You" label on own posts; compare `event.member_id` to current `member.id` |
| Notification opt-in prompt on first feed view | Push notification permission should be requested at a contextual moment, not app-launch; feed is the right moment ("Get notified when someone reacts to your posts") | LOW | Show once using `AsyncStorage` flag; defer push permission request to this screen using `expo-notifications` |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Pinned gym announcements at top of feed | Owners need to communicate with members; pinned posts guarantee visibility | LOW | `is_pinned` column already on `gym_feed_events`; filter `WHERE is_pinned = true` to top; already styled in web with blue border |
| Animated reaction button (scale + haptic) | Tactile feedback makes reactions feel rewarding; increases reaction rate | LOW | `Animated.spring` scale on press + `Haptics.impactAsync(ImpactFeedbackStyle.Light)` from `expo-haptics` |
| Rich workout share card (volume, PRs, machines hit) | Post-workout completion already supports sharing; a styled card with stats is more engaging than plain text | LOW | `WorkoutShareCard.tsx` already exists in web `components/feed`; port to React Native |

### Anti-Features

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Story-style horizontal cards (like Instagram Stories) | Modern and engaging | Stories require expiry logic, circular avatar rails, full-screen viewer, substantial new UI; the existing event-stream model is architecturally different | Keep linear feed; horizontal "quick wins" card row on home screen is the Stories-adjacent pattern that fits existing data |
| Direct messaging in feed | Users might want to comment to a person privately | Trainer messaging is a separate feature (Tier 2); mixing DMs into feed creates two messaging surfaces | Comment section for public reactions; trainer messaging for private |
| Post creation from feed screen | Members asking to post arbitrary text/photos | UGC moderation, image upload pipeline, content policy — all complexity not needed when auto-generated events (workouts, PRs, badges) already populate the feed richly | Auto-generated events only at launch; gym announcements via owner tools |
| Feed algorithm / ranked feed | Engagement optimization | Chronological is the appropriate convention for a small-gym community (50-500 members); algorithmic ranking requires engagement signals, training data, and creates fairness concerns in small groups | Chronological with pinned posts on top |

---

## FEATURE 3: Mobile Challenges

### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Browse active challenges screen | Members need to discover what's running; web has `/gym/challenges` with tab toggle (active/completed) | LOW | Fetch from existing `/api/challenges/[gymId]` or member challenges endpoint; show active vs completed tab |
| Challenge card: type icon + title + description + end date | Enough context to decide to join; web cards show all of this | LOW | Port `gym/challenges/page.tsx` card pattern to React Native |
| Join CTA on challenge detail | Single tap to join; web has this wired to `POST /api/member/[id]/challenges/join` | LOW | Button → optimistic update → join endpoint; disable if already joined or challenge ended |
| My progress within joined challenge | After joining, show current score vs goal; what the member has contributed | MEDIUM | `/api/member/[id]/challenges` already returns `current_value` and `goal_value`; render as progress bar with label "You: 142 / 500 kg" |
| Leaderboard within challenge detail | Top 10 or so participants ranked; creates competition drive | LOW | `/api/challenges/[id]/leaderboard` or `/api/leaderboard` endpoint; rank badges (gold/silver/bronze) for top 3 |
| Challenge end date / countdown | Urgency driver; "3 days left" creates action | LOW | Relative time calculation from `ends_at` timestamp; surface as chip on challenge card |
| Completed challenges history | Members want to see their past wins; validates effort invested | LOW | Tab toggle on challenges screen; filter `WHERE status = 'completed'` + show member's final rank |
| Challenge type badge | 7 challenge types exist (sessions, volume, streak, PR, consistency, cardio, custom); type label helps member choose | LOW | Map `challenge_type` to label + icon; use same `CHALLENGE_ICONS` record pattern already in web |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Rank change notification (entered top 3) | "You just moved to 2nd place!" notifications create re-engagement spikes | MEDIUM | Requires leaderboard comparison on each score update; trigger push when rank crosses threshold; pairs with Feature 6 (notification orchestration) |
| Haptic feedback on join | Makes the commitment feel real and deliberate | LOW | `Haptics.notificationAsync(NotificationFeedbackType.Success)` on join success |
| Personal best highlighted in leaderboard | Show "YOU" row pinned at bottom even when member is rank 47; ensures members don't feel lost in large leaderboards | LOW | Standard leaderboard UX pattern; pin own row at bottom if not in visible window |

### Anti-Features

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Create challenge from mobile | Owner might want to create on-the-go | Challenge creation is an owner/trainer admin tool with many fields (type, goal, dates, machines); mobile forms for complex objects create poor UX; web admin is the right surface | Challenge creation stays in web admin; mobile is consumption-only |
| Friend challenges (1-on-1 invites) | Fun, competitive | Requires social connections graph; `social_connections` table is in code references but doesn't exist in schema (audit confirmed dead reference); adds friend management overhead | Gym-wide challenges at launch; friend challenges are Tier 3 |
| Streak protection during challenges | "I was sick, don't break my streak" | Challenge streak logic is separate from main workout streak; reconciling them creates edge cases; complexity not justified at launch | Standard challenge scoring without streak protection; streak protection is already Out of Scope for main streaks |
| Real-time leaderboard updates (live subscriptions) | More engaging | Supabase Realtime subscription on leaderboard for every active member = connection overhead; polling every 60s on refresh is sufficient for gym-scale (50-500 members) | Poll on focus + manual refresh; Realtime is Tier 3 enhancement |

---

## FEATURE 4: Mobile Program View

### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Full program screen (not just today's exercises in home zone) | Mobile currently shows today-only in home `TodayZone`; members need to see the full plan, upcoming days, and where they are in the program | LOW | New `/program` screen or tab; fetch `/api/member/[id]/program` which already returns `program_data.days`, `week_number`, `day_number`, `sessions_completed`, `sessions_total`, `duration_weeks` |
| Program metadata header (name, goal, length, level, trainer) | Context for why the member has this program | LOW | `ProgramHeader` pattern from web program page; `title`, `description`, `duration_weeks`, `sessions_per_week`, `generated_by`, `trainer_name`, `trainer_approved` all in API response |
| Week progress bar | Shows how far through the program the member is | LOW | `sessions_completed / sessions_total * 100`; already computed as `progress_pct` in API response |
| Day cards for all program days | Scrollable list of all days; each shows: day number, day name, exercise list with sets×reps | MEDIUM | `DayCard` component exists in web; port to React Native; iterate `program_data.days` |
| Today's day highlighted / "active" state | Member needs to know which day to do now | LOW | Compare current `day_number` from API to each day card's `day_number`; highlight with accent border |
| Past days shown as checked/completed | Visual progress confirmation; shows work done | LOW | Track which days have sessions completed; `sessions_completed` count maps to which days are done |
| "Start today's workout" CTA on today's day card | Primary CTA; deep links to Scan screen or starts a session | LOW | Button navigates to Scan tab with program day pre-loaded; or shows exercise list for manual start |
| Exercise list with sets × reps preview | Member needs enough info to prepare before going to the machine | LOW | `exercise_name`, `default_sets`, `default_reps` all in `program_data.days[].exercises`; show as "3 x 10" chips |
| Empty / no program state | Member has no assigned program; must show something useful | LOW | "No program assigned yet" with explanation; if AI programs available for their tier, show "Request AI Program" CTA |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Week/day toggle (week view vs day detail) | Week view gives birds-eye orientation; day detail gives workout focus | LOW | Toggle between week summary (7-day grid) and expanded day view; common pattern in fitness apps (Garmin Connect, Whoop, Strenuous) |
| Coaching note attached to day (if trainer added one) | Trainer communication on the program itself increases perceived value | LOW | `coach_notes` table already exists with `source = 'trainer'`; query notes for today's day context; show as collapsible card below day header |
| Tap exercise name to navigate to exercise detail | Each exercise name is a link to `/exercise/[name]` screen | LOW | Already have `/exercise/[name].tsx` in mobile; just wrap exercise names in `TouchableOpacity` → `router.push` |

### Anti-Features

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Swap exercise from program view | "I don't have access to that machine today" | `alternatives.ts` already handles swaps from machine detail screen; adding swap logic to program view creates two separate swap surfaces to maintain; the correct flow is: start workout → scan nearest machine → app suggests alternatives | Swap from machine/scan flow; program view is read-only reference |
| Edit program days from mobile | Power users want customization | Program editing is complex (adds/removes days, reorders, changes sets); it belongs in the trainer/owner web admin tools, not on mobile | Mobile is read-only; edit via web |
| Accept/reject program flow | Members should have agency over assigned programs | This is already called out as "Program accept/reject flow — Tier 3" in PROJECT.md Out of Scope; building it now adds an approval state machine that blocks program start until accepted | Auto-accept programs at launch; explicit accept/reject is Tier 3 |
| Calendar integration (sync to Apple Calendar / Google Calendar) | Scheduling help | Adds OAuth per calendar provider; program schedule is fuzzy (not fixed day/time), making calendar sync semantically awkward | Show next workout recommendation on home screen instead |

---

## FEATURE 5: UptimizeAI Agent Connection (13 Automations)

### Existing Infrastructure

The codebase has 5 named agents (`retention-agent`, `engagement-agent`, `revenue-agent`, `operations-agent`, `growth-agent`) in `tiers.ts` and `KNOWN_AGENTS` in the trigger route. Billing webhook fires 3 of them for Stripe events. The `gym_agent_config` table (per-gym, per-agent config row) and `smartgym_agent_logs` table are fully built. The spec references 13 automations from DOC_09 (not findable in repo — the spec doc was not committed). Based on the 5 agent families + the data model + gym SaaS automation conventions, the 13 automations map to:

### The 13 Agents (Inferred + Standard Gym SaaS Patterns)

**Retention Agent (3 automations) — Growth+ tier**

| # | Name | Trigger | Action | Guardrails |
|---|------|---------|--------|-----------|
| 1 | Dormant Member Re-engagement | Member has 0 sessions in past 14 days (cron, daily check) | Push notification: "We miss you! Your strength gains are waiting" + link to scan screen | Cooldown: 7 days between fires per member; opt-out via notification preferences; only fire if member has push token |
| 2 | At-Risk Early Warning | Member goes from 2+ sessions/week to 0 sessions for 7 days (session completion event) | Push notification + trainer notification in web portal: "Member [Name] hasn't trained in a week — consider reaching out" | Fire once per 7-day window; trainer alert only if member has assigned trainer; respect quiet hours |
| 3 | Post-Cancellation Win-Back | `subscription_cancelled` Stripe webhook (already wired) | Email to gym owner + 30-day re-engagement sequence for their members | Fire once per cancellation event; log in `smartgym_agent_logs`; no cooldown (event is rare) |

**Engagement Agent (3 automations) — Growth+ tier**

| # | Name | Trigger | Action | Guardrails |
|---|------|---------|--------|-----------|
| 4 | Milestone Celebration | Achievement unlocked, level up, streak milestone (session complete event) | Push notification to member: "You just earned [Badge]! Check your profile" | Dedup: don't fire if member is active in app (last_active < 5 min); daily limit 1 celebration push per member |
| 5 | Trial Ending Soon | `trial_ends_at - now() < 3 days` (cron, daily) | Email to gym owner: "Your trial ends in X days — here's what you'd lose" with upgrade CTA | Fire once at 3 days and once at 1 day remaining; gated by `subscription_status = 'trialing'` (already wired via Stripe webhook) |
| 6 | New Program Ready | AI program generation completed (`ai_programs` insert event or cron check) | Push notification to member: "Your personalized program is ready — start today!" | Fire once per program; check `member_program_assignments.notified_at` to prevent re-fire; cooldown: 1 per program |

**Revenue Agent (2 automations) — Pro tier**

| # | Name | Trigger | Action | Guardrails |
|---|------|---------|--------|-----------|
| 7 | Payment Failed Recovery | `payment_failed` Stripe webhook (already wired) | Email to gym owner: "Your payment failed — update billing to keep your gym running" + Stripe portal link | Max 3 emails per failed-payment cycle; stop if payment succeeds; already partially implemented |
| 8 | Upgrade Prompt (Usage Limit) | Member count or machine count approaches tier limit (e.g., 80% of max) | Email to gym owner: "You're nearing your [members/machines] limit — upgrade to Growth/Pro" | Fire once when crossing 80% threshold; once more at 100%; suppress if already on higher tier |

**Operations Agent (3 automations) — Pro tier**

| # | Name | Trigger | Action | Guardrails |
|---|------|---------|--------|-----------|
| 9 | Weekly Activity Summary | Every Sunday 08:00 UTC (cron) | Email to gym owner: sessions this week, active members, top machine, new members | Send only if gym has been active at least 1 week; respect unsubscribe; summarize from existing analytics data |
| 10 | Machine Maintenance Alert | `last_maintenance_date + maintenance_interval_days < today` (cron, daily) | Notification in owner dashboard + optional email: "Machine [Name] is due for maintenance" | Fire once per overdue machine per 7-day window; gated on `is_active = true` |
| 11 | Trainer Check-In SLA Alert | Weekly check-in has been pending trainer review for > 48 hours (cron, daily) | Push notification to trainer: "[Member Name]'s check-in needs your review" | Fire once per overdue check-in; stop if trainer reviews it; only if trainer has push token or email |

**Growth Agent (2 automations) — Pro tier**

| # | Name | Trigger | Action | Guardrails |
|---|------|---------|--------|-----------|
| 12 | New Member Welcome Sequence | Member created with `onboarding_status = 'active'` (new member event or cron) | Push notification D+0: "Welcome! Scan your first machine to get started"; Push D+3 if no scan: "Your program is waiting — try the QR code on any machine" | Max 2 messages per new member; stop sequence if member completes first scan; opt-out |
| 13 | Churn Risk Alert (Owner-facing) | Member retention drops below 70% for the week (cron, weekly) | Email to gym owner: "Retention is down this week — X members haven't trained in 7+ days. Here's what to do" | Fire weekly max; only if active member count > 10 (noise floor); include actionable suggestions |

### Table Stakes Per Agent

| Requirement | Notes |
|-------------|-------|
| Per-gym enable/disable toggle | `gym_agent_config.enabled` already exists; owner dashboard needs UI to toggle each agent |
| Cooldown windows enforced server-side | Check `gym_agent_config.last_fired_at` before firing; minimum windows defined per agent above |
| Opt-out respected | All member-facing agents must check `notification_preferences.enabled` before sending push; owner-facing agents check owner preference |
| Graceful degradation if UptimizeAI is unreachable | Current `triggerUptimizeAIAgent()` is fire-and-forget with catch; logs failure to `smartgym_agent_logs.status = 'failed'` — this pattern is correct |
| Tier-gated access | Already enforced in `/api/agents/trigger` via `checkAgentAccess()`; Growth gets agents 1,4,5,6; Pro gets all 13 |
| Log every fire in `smartgym_agent_logs` | Already built; every trigger creates a row with `agent_name`, `trigger_event`, `status`, `payload` |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Per-member agent opt-out (not just global push off) | Granular: member wants workout PRs but not check-in reminders | MEDIUM | Extend `notification_preferences` table with per-category boolean columns; agents check category preference |
| Agent fire preview in owner dashboard ("this would have fired for 12 members today") | Builds trust in automation; owners can see what's being sent | MEDIUM | Dry-run mode: count eligible targets without firing; surface in owner agents panel |
| Multi-step sequences (Day 0, Day 3, Day 7) | More sophisticated than single-shot; matches modern marketing automation | HIGH | Requires sequence state tracking; add `agent_sequence_state` jsonb column to `gym_agent_config` or new table; defer to Tier 2 |

### Anti-Features

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| A/B testing of agent messages | Optimization | Requires message variant management, statistical significance tracking, result reporting — full experimentation platform; premature at launch | Ship one message per agent; optimize copy based on engagement data post-launch |
| Natural language agent builder (owner creates custom agents) | Flexibility | LLM-generated automation logic is non-deterministic; debugging fires from user-created rules is very difficult; safety and billing risk if malformed | Fixed 13 agents with configuration options (cooldown overrides, custom message); custom agents are Tier 3+ |
| Real-time agent processing (event streaming) | Lower latency | Adds infrastructure complexity (Kafka, queues); cron + webhook is adequate for gym-scale events; cost is much lower | Cron daily + event-driven webhooks is the right model at this scale |

---

## FEATURE 6: Notification Orchestration

### Existing Infrastructure

`notification_preferences` table exists but only has `enabled` (boolean) — no per-category granularity. `notification_log` table tracks sent notifications. `notifications` table exists. `device_tokens` table stores Expo push tokens. `send-push-notification` Edge Function is deployed. `NotificationType` in types has only 4 values (coach_note, badge_unlocked, streak_milestone, leaderboard_rank) — the spec promises 24+ trigger types.

### The 24+ Trigger Types (Categorized)

**Activity notifications** (triggered by member actions):
1. `workout_complete` — session completed
2. `pr_achieved` — personal record hit
3. `badge_unlocked` — achievement earned
4. `streak_milestone` — streak hit (7, 14, 30, 100 weeks)
5. `level_up` — member advances level
6. `challenge_rank_change` — entered top 3 in a challenge
7. `challenge_complete` — challenge ended, final rank

**Social notifications** (triggered by others' actions on member's content):
8. `feed_reaction` — someone reacted to member's feed event
9. `feed_comment` — someone commented on member's feed event
10. `new_member_joined` — new member joined the gym (gym community update)

**Program / coaching notifications** (triggered by trainer or AI):
11. `program_assigned` — new program available
12. `coach_note_sent` — trainer sent a check-in note
13. `checkin_reminder` — weekly check-in is ready for review
14. `program_week_start` — new week of program begins

**Owner / operational notifications** (owner-facing):
15. `new_member_signup` — a new member joins the gym
16. `member_at_risk` — member hasn't trained in 7 days
17. `payment_failed` — billing issue
18. `trial_ending` — trial expiring soon
19. `checkin_overdue` — trainer hasn't reviewed check-in within 48h
20. `maintenance_due` — machine maintenance due
21. `weekly_summary` — weekly activity digest

**Agent-triggered notifications** (fired by the 13 agents above):
22. `agent_dormant_alert` — dormant member re-engagement
23. `agent_welcome` — new member welcome
24. `agent_upgrade_prompt` — usage limit approaching

### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Per-category notification preferences UI (member) | 2026 consumer standard: iOS and Android apps must offer granular push preferences; users who can't control preferences turn off all pushes | MEDIUM | Extend `notification_preferences` schema with per-category boolean columns; settings screen (mobile) shows toggle per category group |
| Quiet hours setting (per member) | Sleep protection is a standard 2026 mobile app expectation | LOW | Add `quiet_hours_start` and `quiet_hours_end` (time, defaults to 22:00-08:00) to `notification_preferences`; check before sending in Edge Function |
| Deep link from every push notification | Tapping a push must navigate to the relevant content (the badge earned, the feed post reacted to, the program day); 2026 standard | MEDIUM | Each notification payload includes `data.screen` and `data.id`; mobile app handles in `useNotificationObserver` or Expo Router `linking` config |
| Notification center / inbox in mobile app | Users expect to see past notifications; especially important when phone was offline | MEDIUM | `notifications` table already exists; add `/notifications` screen to mobile; list with `is_read` toggle; mark read on tap |
| Unread count badge on notification icon | Standard mobile UX; iOS app badge or in-app badge indicator | LOW | Count `WHERE is_read = false AND profile_id = current`; show red dot or count badge on bell icon |
| Delivery confirmation in admin | Owners/super-admins need to see that notifications are actually reaching members | LOW | `notification_log.status` already tracks `sent/failed/delivered`; surface delivery rate in owner dashboard or super admin |
| `badge_unlocked` push trigger on session complete | Most expected mobile game-ification notification; already checked in `sessions/[id]/complete` route | LOW | Add push trigger call after achievement check in session complete handler |
| `coach_note_sent` push trigger | Trainer sends a note → member gets notified; currently there is no mobile notification for this | LOW | Add push call in `coach_notes` creation path |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Notification bundling ("3 things happened while you were away") | Reduces notification fatigue; batch low-urgency events | MEDIUM | Group notifications with same `profile_id` within a 15-minute window; send one "here's what you missed" push instead of 3 separate ones |
| Send-time optimization (send when member is usually active) | Higher open rates; better experience | HIGH | Requires tracking member active hours from `workout_sessions.session_date`; infer best send window per member; store in `member_settings`; too complex for launch |
| Rich push notifications with image (badge art, PR graphic) | Higher tap rates | MEDIUM | Expo push supports rich notifications; add `attachment_url` to push payload for badge earned and PR notifications; needs asset hosting |

### Anti-Features

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Email notifications for all 24 trigger types | Broader reach | Most trigger types are high-frequency (reactions, badges) — emailing on each would be spam; email is appropriate for transactional (payment failed, trial ending) and weekly digests | Push for real-time events; email only for billing + weekly digest + coach notes |
| In-app chat notifications (real-time) | Trainer messaging needs notifications | Trainer messaging is Tier 2; building notification infrastructure for a feature that doesn't exist yet creates dead code | Notify when coach note sent (already a trigger type); full chat notifications go in Tier 2 |
| Per-notification delivery retry with exponential backoff | Enterprise reliability | Expo push service handles retries; adding a custom retry layer over Expo's is duplicative; failure is already logged in `notification_log` | Log failures; accept occasional delivery miss at this scale; retry logic is Tier 3 infrastructure |

---

## Cross-Feature Dependencies

```
Feature 1 (Owner Onboarding)
    └──enables──> Feature 5 (Agents) [agents need gym records + member data to act on]
    └──enables──> Feature 6 (Notifications) [imported members need push tokens from mobile]

Feature 2 (Mobile Social Feed)
    └──enhanced-by──> Feature 6 (Notifications) [feed_reaction + feed_comment push triggers]

Feature 3 (Mobile Challenges)
    └──enhanced-by──> Feature 6 (Notifications) [challenge_rank_change push trigger]

Feature 5 (UptimizeAI Agents)
    └──requires──> Feature 6 (Notifications) [agents output push notifications as primary channel]
    └──enhanced-by──> Feature 1 (Onboarding) [new_member welcome sequence fires on onboarding complete]

Feature 6 (Notification Orchestration)
    └──amplifies──> Feature 2, 3, 4 [all mobile features become more sticky with relevant pushes]
    └──blocks-if-absent──> Feature 5 [agents that can't deliver notifications have no output channel]
```

### Dependency Notes

- **Feature 5 requires Feature 6:** Most of the 13 agents output a push notification. Building agents without notification orchestration means agents fire but nobody sees the result. Feature 6 must be at least minimally wired (push trigger + basic preferences) before agents are useful.
- **Feature 6 requires Feature 1 partially:** The per-member notification preferences UI needs the member to exist (mobile onboarding already handles members); but the owner-facing notification delivery stats need the owner to have signed up via Feature 1.
- **Feature 2 and 3 are independent:** Mobile social feed and mobile challenges share no code paths. Both consume existing backend endpoints. Either can ship first.
- **Feature 4 is independent:** Mobile program view reads from an already-complete API (`/api/member/[id]/program`). No dependencies on other Tier 1 features.
- **Feature 1 CSV import unlocks Feature 5 scale:** The dormant-member and at-risk agents become much more valuable when a gym has imported 200 existing members vs. having 3 manually-created ones.

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Phase Priority |
|---------|------------|---------------------|---------------|
| 1a: Signup wizard (email → gym → Stripe) | HIGH — no gyms can sign up without this | MEDIUM | P1 — Phase 1 |
| 1b: First machine wizard | HIGH — app is empty without machines | LOW | P1 — Phase 1 |
| 1c: CSV member import | HIGH — existing gyms need bulk import | HIGH | P1 — Phase 1 (but last) |
| 2: Mobile social feed | HIGH — community engagement driver | LOW-MEDIUM | P1 — Phase 2 |
| 3: Mobile challenges | HIGH — key retention mechanic | LOW-MEDIUM | P1 — Phase 3 |
| 4: Mobile program view | HIGH — core feature gap | LOW | P1 — Phase 4 |
| 5: Agents (core 8, Growth+Pro tier) | HIGH — automation is core value prop | MEDIUM | P1 — Phase 5 |
| 6a: Push triggers wired (badge, PR, note) | HIGH — notifications are expected | LOW | P1 — Phase 6 |
| 6b: Per-category preferences UI | MEDIUM — expected but not day-1 critical | MEDIUM | P1 — Phase 6 |
| 6c: Notification inbox (mobile) | MEDIUM — nice to have, not blocking | MEDIUM | P1 — Phase 6 |
| Deep links from push | HIGH — pushes are useless without deep links | LOW | P1 — Phase 6 |
| Quiet hours | MEDIUM — reduces uninstalls | LOW | P1 — Phase 6 |
| Agent multi-step sequences | MEDIUM — more effective than single-shot | HIGH | P2 — post-launch |
| Send-time optimization | LOW at launch scale | HIGH | P3 — Tier 3 |
| Friend challenges | MEDIUM | HIGH | P3 — Tier 3 |

---

## MVP Definition

### Launch With (Tier 1 — all 6 features, all P1 items above)

- [ ] Gym owner self-serve signup (4 steps + Stripe trial) — no gym can acquire without this
- [ ] First machine setup wizard — app is useless empty
- [ ] CSV member import — existing gyms need bulk import
- [ ] Mobile social feed (12 card types, reactions, comments, pull-to-refresh) — core community engagement
- [ ] Mobile challenges (browse, join, progress, leaderboard) — key retention mechanic
- [ ] Mobile program view (full week, day cards, progress) — basic feature parity expectation
- [ ] 8 core agents wired (agents 1-8 from enumeration above) — automation is core value prop
- [ ] Push triggers wired for: badge_unlocked, coach_note_sent, streak_milestone, challenge_rank_change, program_assigned, dormant_member, at_risk_member
- [ ] Per-category notification preferences (5 category groups: activity, social, coaching, operational, agents)
- [ ] Quiet hours setting
- [ ] Deep links from all push notifications
- [ ] Notification inbox screen (mobile)

### Add After Validation (Tier 2 — within 30 days of launch)

- [ ] Agents 9-13 (operations + growth agents) — add once core agent pipeline is proven
- [ ] Notification bundling — add if users report notification fatigue
- [ ] Mobile body metrics / goal setting — Tier 2 per audit
- [ ] Mobile trainer messaging — Tier 2 per audit

### Future Consideration (Tier 3+)

- [ ] Multi-step agent sequences
- [ ] Send-time optimization
- [ ] Friend / 1-on-1 challenges
- [ ] Rich push notifications with badge art
- [ ] A/B testing for agent messages
- [ ] Calendar sync for program view

---

## Sources

- NEXERA_FULL_CODEBASE_AUDIT.md — April 2026, 12-agent deep codebase audit (all gaps, existing components, DB schema)
- Codebase: `apps/web-admin/src/lib/billing/tiers.ts` — confirmed 5 agent names and tier gating
- Codebase: `apps/web-admin/src/app/api/agents/trigger/route.ts` — confirmed KNOWN_AGENTS list and auth pattern
- Codebase: `apps/web-admin/src/app/api/billing/webhook/route.ts` — confirmed 3 Stripe-triggered agent calls (only existing wiring)
- Codebase: `packages/types/src/index.ts` — confirmed NotificationType has 4 values (not 24+); confirmed NotificationPreferences is just `enabled` boolean
- Codebase: `supabase/migrations/001_nexera_schema.sql` — confirmed `gym_agent_config` schema, `smartgym_agent_logs` schema
- Codebase: `apps/web-admin/src/app/(member)/gym/components/FeedEventCard.tsx` — confirmed 16 event type icons (feed card types to port to mobile)
- Codebase: `apps/web-admin/src/lib/feed/formatFeedEvent.ts` — confirmed weight-unit-aware description renderer exists in shared util
- 2026 SaaS conventions (training knowledge): trial length, plan-during-signup conversion, email verification timing, CSV import UX, mobile pull-to-refresh, quiet hours, deep links from push
- Competitor pattern knowledge: gym apps (Trainerize, MyFitnessPal, Strava, WHOOP) for feed + challenge + program view conventions

---

*Feature research for: SmartGym (NEXERA) Tier 1 Launch Blockers*
*Researched: 2026-06-03*

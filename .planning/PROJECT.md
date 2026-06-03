# SmartGym (NEXERA)

## What This Is

SmartGym turns traditional gyms into AI-coached, data-rich environments. Members scan a QR code on any machine to get setup guidance, log sets with AI-suggested progression, and see their progress; trainers get a copilot for member coaching and check-ins; owners get retention, occupancy, and billing visibility. Multi-tenant SaaS for independent gyms and chains.

## Core Value

Members get instantly-personalized, AI-progressed workouts at the machine; gyms get the operating system that turns equipment usage into retention.

## Requirements

### Validated

<!-- Imported from existing codebase (pre-GSD). See NEXERA_FULL_CODEBASE_AUDIT.md for full inventory. -->

- ✓ QR scan → machine detail → set logging end-to-end (web + mobile) — pre-GSD
- ✓ AI progression engine (10 decision branches, fatigue detection, progressive overload) — pre-GSD
- ✓ AI guardrails (volume spike, fatigue, rep collapse, recovery overlap) — pre-GSD
- ✓ AI coaching tips (Gemini + fallback chain) — pre-GSD
- ✓ Performance DNA (5 dimensions, 12 archetypes, pentagon viz) — pre-GSD
- ✓ Readiness scoring (0-100, daily cache) — pre-GSD
- ✓ Muscle map (17 groups, SVG body map, recovery states) — pre-GSD
- ✓ Gamification: 39 achievements, 10 levels, streak system — pre-GSD
- ✓ Phone OTP auth + onboarding (mobile) — pre-GSD
- ✓ Staff email auth + role detection (web) — pre-GSD
- ✓ Trainer portal: assigned members, messaging, check-in editor, copilot notes — pre-GSD
- ✓ Owner billing (Stripe checkout, portal, webhooks) — pre-GSD
- ✓ Super admin dashboard (12 API routes, 10 pages, feature flags) — pre-GSD
- ✓ Machine CRUD + QR PDF generation — pre-GSD
- ✓ Occupancy heatmap (day × hour) — pre-GSD
- ✓ Web social feed (12 event types, reactions, comments) — pre-GSD
- ✓ Web challenges (join, track, leaderboard) — pre-GSD
- ✓ Web check-ins (member page + trainer editor with 48h SLA) — pre-GSD
- ✓ Mobile workout logging with AI suggestions, RPE, safety nudges — pre-GSD
- ✓ Mobile progress (1RM, volume, strength curve, exercise trends) — pre-GSD
- ✓ Mobile dark mode (40+ color tokens) — pre-GSD
- ✓ Mobile offline queue + sync on reconnect — pre-GSD
- ✓ Push notification infrastructure (Edge Function + device tokens) — pre-GSD
- ✓ Weight unit conversion (kg/lbs) throughout — pre-GSD
- ✓ CSRF + CORS middleware on all state-changing requests — pre-GSD
- ✓ Rate limiting (~40 routes, sliding window) — pre-GSD
- ✓ Zod input validation on all POST/PATCH — pre-GSD
- ✓ RLS multi-tenant isolation — pre-GSD

### Active

<!-- Milestone v1.0 — Tier 1 Launch Blockers. See REQUIREMENTS.md for REQ-IDs. -->

- [ ] Gym owner self-serve onboarding (4-step signup → Stripe → first machine wizard)
- [ ] Mobile social feed (consume existing gym_feed_events backend)
- [ ] Mobile challenges (join, track, leaderboard — consume existing backend)
- [ ] Mobile program view (full week/day, not just today)
- [ ] UptimizeAI agent connection (13 automations specified, webhook exists)
- [ ] Notification orchestration wiring (24+ trigger types defined, infra exists)

### Out of Scope

<!-- Tier 3-4 from audit. Deferred to post-launch milestones. -->

- Spanish localization — defer to post-launch (Tier 4)
- Playwright E2E tests — defer to post-launch (Tier 4)
- PWA offline (web) — defer; mobile offline already works (Tier 4)
- White-label rendering (Pro tier) — schema exists but UX is post-launch (Tier 3)
- Multi-location gym chains — schema exists, logic deferred (Tier 3)
- Monthly business report generation — Tier 3
- Member spotlights (AI-drafted recognition) — Tier 3
- Form videos on machine pages — Tier 3
- Program accept/reject flow — Tier 3
- Rest day streak protection (Growth+ feature) — Tier 4
- Travel grace period (Pro feature) — Tier 4

## Current Milestone: v1.0 Tier 1 Launch Blockers

**Goal:** Ship the 6 capabilities that block public launch — gym customer acquisition flow + core mobile engagement + automation layer.

**Target features:**
- Gym owner self-serve onboarding with Stripe + first-machine wizard + member CSV import
- Mobile social feed (gym community on phone)
- Mobile challenges (join + track + leaderboard from phone)
- Mobile program view (full plan visibility)
- UptimizeAI agent connection (13 automation triggers wired end-to-end)
- Notification orchestration (push triggers wired to existing event stream)

## Context

- **Brownfield import.** ~55-60% of the spec is already built (524 source files, 711 tests passing, TS compiles clean). Backend infrastructure for most Tier 1 items already exists — these are largely UI / wiring tasks rather than ground-up builds.
- **37 spec docs + 6 UPDATE docs + 10 UI enhancement docs** drove the prior build, plus `docs/PRD.md`, `docs/DATA_MODEL.md`, `docs/API.md`, `docs/WIREFRAMES.md`, `docs/RELEASE.md`.
- **Comprehensive audit available:** `NEXERA_FULL_CODEBASE_AUDIT.md` at repo root — full file-by-file inventory generated April 2026 by 12 parallel agents.
- **No prior GSD planning.** This is the first GSD-tracked milestone for the project; everything pre-GSD is captured via Validated requirements (audit-derived) rather than MILESTONES.md history.
- **Known dead code:** ~15 unused tables from migration 021 (`user_training_profiles`, `points_ledger`, `set_feedback`, etc.); code references 4 non-existent tables (`error_log`, `social_connections`, `platform_daily_metrics`, `admin_actions_log`). Address opportunistically, not in scope for Tier 1.

## Constraints

- **Tech stack**: pnpm monorepo · Next.js 14 (App Router) · Expo (React Native, ~SDK 52) · Supabase (Postgres + Auth + RLS + Edge Functions) · TypeScript strict · Stripe · Google Gemini for AI fallback — Locked, do not introduce new frameworks
- **Multi-tenancy**: Every query must respect gym_id isolation via RLS — Single biggest correctness risk
- **Mobile platform**: Expo SDK constraint, no bare React Native — Affects native module choices
- **Rate limiting state**: In-memory sliding window (resets on deploy) — Acceptable for now, durable store deferred
- **AI provider**: Gemini REST, rules engine always works without LLM — All AI features must degrade gracefully if Gemini fails
- **CI**: ESLint + tsc + tests must all pass (3 recent commits explicitly fixed CI breaks) — Don't disable lint/tsc to ship

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Brownfield import via audit, no MILESTONES.md history | Pre-GSD codebase too large to retroactively phase-track | — Pending |
| Tier 1 = milestone v1.0 (6 phases) | Audit-derived launch-blocker list, user-confirmed priority | — Pending |
| Plan Phase 1 (Owner Onboarding) first in detail | User asked for it; backend most novel here vs mobile-UI-on-existing-backend phases | — Pending |
| Rules engine pure functions, LLM optional | Determinism + offline + cost control | ✓ Good (pre-GSD) |
| Supabase RLS for multi-tenant boundary | Database-level enforcement vs app-level | ✓ Good (pre-GSD) |

---
*Last updated: 2026-06-03 after milestone v1.0 bootstrap from NEXERA_FULL_CODEBASE_AUDIT.md*

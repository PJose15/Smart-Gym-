---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: active
stopped_at: Completed 05-06-PLAN.md — atRiskScan shared helper + at-risk route per-member triggers + agent-weekly cron (420 tests, tsc clean)
last_updated: "2026-07-20T04:35:00.000Z"
last_activity: "2026-07-20 — Executed plan 05-06: shared atRiskScan helper + owner at-risk per-member retention triggers + agent-weekly cron (weekly-summary + at-risk early-warning, 420/420 tests, tsc clean)"
progress:
  total_phases: 6
  completed_phases: 3
  total_plans: 24
  completed_plans: 22
  percent: 92
---

# State

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-06-03)

**Core value:** Members get instantly-personalized, AI-progressed workouts at the machine; gyms get the operating system that turns equipment usage into retention.
**Current focus:** Milestone v1.0 — Tier 1 Launch Blockers, roadmap created, planning Phase 1

## Current Position

Phase: 5 of 6 — UptimizeAI Agent Connection (13 automations)
Plan: 6 of 7 complete (05-01 through 05-06 executed)
Status: Active — Wave 2 call sites: session-complete (level-up/streak-broken/leaderboard-updated), challenge-ended, upgrade-opportunity, new-gym-onboarded, daily cron (4 scans), weekly cron (weekly-summary + at-risk early-warning), at-risk route wired.
Progress: [█████████░] 92%
Last activity: 2026-07-20 — Executed plan 05-06: shared atRiskScan helper + owner at-risk per-member retention triggers + agent-weekly cron (weekly-summary + at-risk early-warning, 420/420 tests, tsc clean)
Next action: Plan 05-07 — Wave 2 remaining automations (coach-tips, member-joined, new-member-batch)

## Accumulated Context

- First GSD-tracked milestone. Pre-GSD codebase imported via Validated requirements in PROJECT.md, sourced from `NEXERA_FULL_CODEBASE_AUDIT.md`.
- 6 phases for v1.0 (see ROADMAP.md):
  1. Gym Owner Self-Serve Onboarding (PLAN FIRST)
  2. Mobile Social Feed — ✅ COMPLETE 2026-07-17 (commits `cba42c0` + `af69753`, delivered pre-roadmap)
  3. Mobile Challenges — ✅ COMPLETE (automated gate: mobile 189/189 + web-admin 347/347)
  4. Mobile Program View — ✅ COMPLETE 2026-07-19 (gate: mobile 227/227 + web-admin 347/347, tsc clean)
  5. UptimizeAI Agent Connection (13 automations)
  6. Notification Orchestration Wiring
- User priority: Plan Phase 1 (Owner Onboarding) in full executable detail first.
- Backend already exists for mobile phases (gym_challenges tables, member_program_assignments) — Phases 3-4 are primarily UI work.
- Most novel build is Phase 1 (Stripe-heavy, new auth+billing flow, CSV import). New deps needed: `react-hook-form`, `@hookform/resolvers`, `csv-parse`.
- **Database clean:** migrations 001-026. The "4 ghost tables" note in PROJECT.md Context is resolved (DOC_02 reconciliation via migrations 024-026; client grants restored).
- **Demo environment exists:** Iron Society, 50 members, deterministic UUIDs — `supabase/seed-bulk.sql` + `DEMO_SETUP.md`. Use for phase verification.
- **Design system (DOC_03) fully implemented:** brand fonts, purple `#7C5CFF` token palette, celebration components, skeletons. All new UI must use these tokens/components.
- **Test baseline:** 803 tests (399 ai-assist + 269 web-admin + 135 mobile). CI (ESLint + tsc + tests) must stay green.
- **Phase 5 ↔ 6 ordering tension:** agents (Phase 5) output pushes delivered by the Phase 6 dispatcher. Resolve in Phase 5 planning: build minimal dispatcher (NOTIF-01 core) as Phase 5's first plan, OR scope Phase 5 outputs to owner email + logs until Phase 6. Loop-safety dedup (AGENT-02) must precede any agent wiring.
- Key Phase 1 pitfalls (see research/PITFALLS.md): Stripe webhook idempotency (`stripe_events_processed` table first), atomic gym creation via RPC, RLS session refresh after signup, CSV BOM handling, validate-then-import.

## Decisions

- **01-01**: RPCs use SECURITY DEFINER + REVOKE FROM PUBLIC + GRANT TO service_role (service_role isolation pattern)
- **01-01**: complete_gym_onboarding uses loop-with-exception-catch for slug uniqueness (up to 3 retries with `-XXXX` suffix)
- **01-01**: bulk_import_members skips duplicates (not errors) — validate-then-import two-phase flow handles bad data before this runs
- **01-01**: stripe_events_processed has no RLS policies (service_role bypasses RLS entirely)
- [Phase 01-gym-owner-self-serve-onboarding]: Idempotency via insert-before-switch: empty/null data both treated as duplicate, never throw on 200 path
- [Phase 01-gym-owner-self-serve-onboarding]: checkout.session.completed sets trialing only — authoritative sync via customer.subscription.updated which fires immediately after
- [Phase 01-gym-owner-self-serve-onboarding]: checkout.session.expired keeps trialing (retryable) — owner can restart checkout without support intervention
- [Phase 01-gym-owner-self-serve-onboarding]: computeDaysRemaining exported as pure helper with injectable now param for deterministic tests
- [Phase 01-gym-owner-self-serve-onboarding]: SetupChecklist returns null when all 3 items complete; has_shared_qr derived from machine_scan_events count
- [Phase 01-gym-owner-self-serve-onboarding]: POST /api/machines uses pure generateMachineMistakes from @nexera/ai-assist (not edge-function client); machines/page.tsx submission path kept as-is; MachineForm minimal mode for wizard embed
- [Phase 01-gym-owner-self-serve-onboarding]: anon server client for signUp (fires email), admin client for all post-signUp DB ops — separates email delivery from privileged writes
- [Phase 01-gym-owner-self-serve-onboarding]: identities.length === 0 is the Supabase duplicate email signal — return 409 before any DB insertion, no orphaned users
- [Phase 01-gym-owner-self-serve-onboarding]: deleteUser rollback is best-effort (try/catch) — failed cleanup must not mask the original registration error
- **01-07**: Auth error (401/network) renders inline sign-in prompt — no redirect — keeps owner in wizard shell
- **01-07**: QR PDF download via plain anchor with download attribute to existing /api/machines/qr-pdf (no new query params needed)
- **01-07**: 3-step state machine (machine-form/creating/qr-ready) with Suspense wrapping for useSearchParams RSC boundary
- [Phase 01-gym-owner-self-serve-onboarding]: checkoutSchema context field onboarding enum — invalid values rejected 400; onboarding builds /setup success URL and /subscribe cancel URL
- [Phase 01-gym-owner-self-serve-onboarding]: prices route uses getSession light check (not verifyStaff) + module-level 1hr TTL cache; _resetPricesCache exported for test isolation
- [Phase 01-gym-owner-self-serve-onboarding]: PKCE code exchange: strip code param after exchange; always refreshSession before fetching protected data (Pitfall 3)
- [Phase 01-gym-owner-self-serve-onboarding]: Resume banner: has_customer && !has_subscription signals abandoned checkout; auto-redirect to /setup when has_subscription=true
- **01-08**: Switch jest.config.js from babel-jest to ts-jest — Babel 7.29.0 cannot parse TypeScript in jest.mock() factory bodies (all 59 suites were failing pre-fix)
- **01-08**: Claim email deferred — claim works via phone OTP; rows without phone get warning; no email provider in scope
- **01-08**: Import valid-only rows — owner sees per-row validation report and confirms; invalid rows skipped, invalid_count in response
- **01-08**: 'invited' treated same as 'pending' in findOrCreateMember status transition
- [Phase 01-gym-owner-self-serve-onboarding]: Route files must only export HTTP method handlers — test utilities and types extracted to adjacent modules (cache.ts/types.ts pattern)
- [Phase 03-mobile-challenges]: Bearer JWT falls through to cookie path on error — browser callers with unrelated Authorization headers are not broken
- [Phase 03-mobile-challenges]: verifyMember request param is optional — all 36 existing call sites compile unchanged; only join route forwards request
- [Phase 03-mobile-challenges]: expo-haptics pinned to ~14.0.1 (SDK 52 compatible — Expo CLI confirms; pnpm default 57.x was wrong)
- [Phase 03-mobile-challenges]: progressPct = my_score/top_score (no goal_value column in DB — research confirmed)
- [Phase 03-mobile-challenges]: fetchChallengeDetail returns null (not throw) for missing challenge — stale deep link graceful handling
- [Phase 03-mobile-challenges]: resolveMemberInfo exported from feedService.ts — challengeService reuses it for leaderboard name resolution
- [Phase 03-mobile-challenges]: Migration 028 applied to live DB — challenge_participants_member_gym_read policy confirmed; 115 rows visible for demo gym member
- [Phase 03-mobile-challenges]: Dynamic cache key strings cast to CacheKey for clearCache/setCache calls; static imports only (no dynamic import() in mobile tsconfig)
- [Phase 03-mobile-challenges]: useReducedMotion gates confetti; haptic fires unconditionally on join (haptics are non-visual per DOC_03)
- [Phase 03-mobile-challenges]: ChallengeCard uses Pressable not AnimatedCard — AnimatedCard triggers entrance animations on every list render; Pressable with opacity feedback is more appropriate for list items
- [Phase 03-mobile-challenges]: CHALLENGES_CACHE_KEY return cast as any — CacheKey type string & Record<string,never> trick does not widen to template literal strings in TypeScript 5.x
- [Phase 03-mobile-challenges — Gate 03-05]: Automated gate passed: mobile 189/189, web-admin 347/347, both tsc clean, zero hardcoded hex in challenge files; total test count 935
- [Phase 04-mobile-program-view]: resolveTodayDayNumber mirrors @nexera/utils getTodaysProgramDay with injected now — home-screen TodayZone consistency wins over DB day_number
- [Phase 04-mobile-program-view]: fetchProgram returns null (not throw) for no active program — PROG-04 empty state handled gracefully
- [Phase 04-mobile-program-view]: program_data parsed as { days?: ProgramDay[] } | null with ?? [] fallback — malformed jsonb never throws
- [Phase 04-mobile-program-view]: program/index is a Stack route (not tab) — tab bar is full at 6 items
- [Phase 04-mobile-program-view]: program.days.length === 0 treated same as null program — empty state (malformed jsonb guard)
- [Phase 04-mobile-program-view]: router.push('/program' as any) — Expo typed routes stale (gitignored .expo/types); as-any cast consistent with OverviewTab.tsx + ProfileHeader.tsx
- [Phase 05-uptimizeai-agent-connection]: Echo receiver records reception via action_taken='echo-received' (never status — CHECK constraint allows only sent/failed/pending/skipped)
- [Phase 05-uptimizeai-agent-connection]: DEMO_ECHO_AGENTS=true is the hard gate for echo route (returns 404 otherwise — never active in production)
- [Phase 05-uptimizeai-agent-connection]: pg_cron agent-daily/agent-weekly jobs 404 harmlessly until plans 05-04/05-05 deploy the routes — by design
- [Phase 05-uptimizeai-agent-connection]: is_agent_initiated lives in payload jsonb — no column migration needed; enforced at application layer
- [Phase 05-02-trigger-hardening]: PLATFORM_EVENTS (new-gym-onboarded, upgrade-opportunity) bypass checkAgentAccess — platform-growth events about the gym; tier gating would make them dead code
- [Phase 05-02-trigger-hardening]: Cooldown keyed by trigger_event (not agent_name) — each event has distinct semantic urgency (level-up=24h, member-at-risk=7d, weekly-summary=6d)
- [Phase 05-02-trigger-hardening]: Skipped rows do NOT extend the cooldown window — only status=sent rows are the reference; skips leave the original window open for legitimate retries
- [Phase 05-02-trigger-hardening]: UPTIMIZE_WEBHOOK_URL absent = no forwarding (staging-ready decision) — forwarding is optional; local dev and unset envs never break
- [Phase 05-uptimizeai-agent-connection]: machines.is_active filter confirmed in migration 001; per-gym machine_scan_events query uses idx_scan_events_gym_time index; challenge end_date compared as DATE string; dedup_key=challenge.id deduplicates cron + owner-complete paths via 24h cooldown
- [Phase 05-uptimizeai-agent-connection]: UPGRADE_NUDGE_FEATURES excludes leaderboards/social_feed/push_notifications/franchise_support: low-value gates never spam revenue agent
- [Phase 05-uptimizeai-agent-connection]: fireUpgradeOpportunity not inside checkFeatureAccess: only user-facing denial call sites trigger nudges, not internal/admin reads
- [Phase 05-06-at-risk-weekly]: Single shared helper (atRiskScan.ts) for at-risk detection — eliminates logic duplication between owner route and weekly cron
- [Phase 05-06-at-risk-weekly]: Zero-member gym suppression in agent-weekly — skip entirely if activeMembers === 0 (no weekly-summary, no at-risk scan)
- [Phase 05-06-at-risk-weekly]: 7-day cooldown in trigger route absorbs both owner-route fires and weekly cron early-warning fires — no additional dedup logic at call sites
- [Phase 05-06-at-risk-weekly]: gyms_scanned counter tracks only gyms that passed activeMembers > 0 check

## Session Continuity

Last session: 2026-07-20T04:35:00.000Z
Stopped at: Completed 05-06-PLAN.md — atRiskScan shared helper + at-risk route per-member triggers + agent-weekly cron (420 tests, tsc clean)
Resume with: Plan 05-07 — Wave 2 remaining automations (coach-tips, member-joined, new-member-batch) to complete AGENT-03/AGENT-04 remaining automations

---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: in_progress
stopped_at: Completed 01-gym-owner-self-serve-onboarding/01-07-PLAN.md
last_updated: "2026-07-19T17:39:30Z"
last_activity: "2026-07-19 — Executed plan 01-07: /setup first-machine wizard page + 4 behavior tests"
progress:
  total_phases: 6
  completed_phases: 0
  total_plans: 9
  completed_plans: 6
  percent: 67
---

# State

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-06-03)

**Core value:** Members get instantly-personalized, AI-progressed workouts at the machine; gyms get the operating system that turns equipment usage into retention.
**Current focus:** Milestone v1.0 — Tier 1 Launch Blockers, roadmap created, planning Phase 1

## Current Position

Phase: 1 of 6 — Gym Owner Self-Serve Onboarding (in progress)
Plan: 6 of 9 complete (01-01 through 01-05 + 01-07 done)
Status: Plans 01-01 through 01-05 + 01-07 complete; /setup wizard with first-machine flow + QR PDF download shipped; next: 01-08 (CSV member import) or 01-09 (onboarding checkpoint)
Progress: [███████░░░] 67%
Last activity: 2026-07-19 — Executed plan 01-07: /setup first-machine wizard page + 4 behavior tests
Next action: Execute plan 01-08 — CSV member import wizard step

## Accumulated Context

- First GSD-tracked milestone. Pre-GSD codebase imported via Validated requirements in PROJECT.md, sourced from `NEXERA_FULL_CODEBASE_AUDIT.md`.
- 6 phases for v1.0 (see ROADMAP.md):
  1. Gym Owner Self-Serve Onboarding (PLAN FIRST)
  2. Mobile Social Feed — ✅ COMPLETE 2026-07-17 (commits `cba42c0` + `af69753`, delivered pre-roadmap)
  3. Mobile Challenges
  4. Mobile Program View
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

## Session Continuity

Last session: 2026-07-19T17:39:30Z
Stopped at: Completed 01-gym-owner-self-serve-onboarding/01-07-PLAN.md
Resume with: Execute plan 01-08 — CSV member import wizard step

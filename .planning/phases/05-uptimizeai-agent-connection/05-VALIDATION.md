---
phase: 5
slug: uptimizeai-agent-connection
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-19
gate_completed: 2026-07-20
web_admin_tests: 426
mobile_tests: 227
ai_assist_tests: 399
total_tests: 1052
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest 30.x/ts-jest (web-admin) |
| **Config file** | `apps/web-admin/jest.config.js` |
| **Quick run command** | `cd apps/web-admin && npx jest --silent` |
| **Full suite command** | `cd apps/web-admin && npx tsc --noEmit && npx jest --silent` |
| **Estimated runtime** | ~25 seconds full, ~10 seconds quick |

---

## Sampling Rate

- **After every task commit:** Run the task's `<automated>` command, then `cd apps/web-admin && npx jest --silent`
- **After every plan wave:** Run full suite command
- **Before `/gsd:verify-work`:** Full suite green + tsc clean; mobile suite untouched but re-run once at gate
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

*Filled by gsd-planner 2026-07-19.*

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 05-01 T1 | 05-01 | 1 | AGENT-02 | script check | `node -e` grep of migration 029 contents | ✅ `supabase/migrations/029_agent_dedup_index.sql` | ✅ PASS |
| 05-01 T2 | 05-01 | 1 | AGENT-05 | typecheck | `cd apps/web-admin && npx tsc --noEmit` | ✅ trigger route + echo route + env.example | ✅ PASS |
| 05-01 T3 | 05-01 | 1 | AGENT-02/04 | checkpoint:human-action | db push + pg_indexes/cron.job inspection | — | ✅ PASS (migration applied per 05-01 checkpoint) |
| 05-02 T1 | 05-02 | 1 | AGENT-02 | unit (TDD RED-first) | `npx jest --testPathPattern="agents/trigger"` | ✅ `agents/trigger/__tests__/trigger.test.ts` | ✅ PASS |
| 05-02 T2 | 05-02 | 1 | AGENT-01 | unit (TDD RED-first) | `npx jest --testPathPattern="agents/trigger"` | ✅ same file | ✅ PASS |
| 05-03 T1 | 05-03 | 2 | AGENT-03 | unit (TDD RED-first) | `npx jest --testPathPattern="complete-agents"` | ✅ `sessions/[sessionId]/complete/__tests__/complete-agents.test.ts` | ✅ PASS (9/9) |
| 05-03 T2 | 05-03 | 2 | AGENT-03 | unit (TDD RED-first) | `npx jest --testPathPattern="challenges.*complete"` | ✅ `challenges/[challengeId]/complete/__tests__/complete.test.ts` | ✅ PASS |
| 05-04 T1 | 05-04 | 2 | AGENT-03 | unit (TDD RED-first) | `npx jest --testPathPattern="featureGate-upgrade"` | ✅ `lib/billing/__tests__/featureGate-upgrade.test.ts` | ✅ PASS |
| 05-04 T2 | 05-04 | 2 | AGENT-03 | unit (TDD RED-first) | `npx jest --testPathPattern="onboard"` | ✅ `onboard/__tests__/register.test.ts` | ✅ PASS |
| 05-05 T1 | 05-05 | 2 | AGENT-04 | unit (TDD RED-first) | `npx jest --testPathPattern="agent-daily"` | ✅ `cron/agent-daily/__tests__/agent-daily.test.ts` | ✅ PASS |
| 05-05 T2 | 05-05 | 2 | AGENT-04 | unit (TDD RED-first) | `npx jest --testPathPattern="agent-daily"` | ✅ same file | ✅ PASS |
| 05-06 T1 | 05-06 | 2 | AGENT-03 | unit (TDD RED-first) | `npx jest --testPathPattern="atRiskScan\|at-risk"` | ✅ `lib/agents/__tests__/atRiskScan.test.ts` + `owner/at-risk/__tests__/at-risk.test.ts` | ✅ PASS |
| 05-06 T2 | 05-06 | 2 | AGENT-04 | unit (TDD RED-first) | `npx jest --testPathPattern="agent-weekly"` | ✅ `cron/agent-weekly/__tests__/agent-weekly.test.ts` | ✅ PASS |
| 05-07 T1 | 05-07 | 3 | AGENT-01..05 | full gate | `cd apps/web-admin && npx tsc --noEmit && npx jest --silent` (+ mobile + ai-assist suites) | ✅ | ✅ PASS — web-admin 426/426, mobile 227/227, ai-assist 399/399, tsc clean both apps |
| 05-07 T2 | 05-07 | 3 | AGENT-05 | checkpoint:human-verify | 13-automation staging walkthrough vs Iron Society (echo receiver + logs + tier matrix + cooldown) | — | ⏳ awaiting human walkthrough |

---

## Wave 0 Requirements

- [x] Dedup/cooldown BEFORE any new trigger call sites (AGENT-02 first — Pitfall 7) → plan 05-02 is Wave 1; ALL call-site plans (05-03..05-06) declare `depends_on: ["05-01", "05-02"]`
- [x] Migration (next free number 029) — dedup partial indexes + pg_cron schedules; apply gated by checkpoint:human-action in plan 05-01 Task 3
- [x] UPTIMIZE_WEBHOOK_URL env contract + dev echo receiver (DEMO_ECHO_AGENTS gate) — plan 05-01 Task 2; staging-ready decision LOCKED by user 2026-07-19 honored (go-live = env var change only)
- [x] is_agent_initiated flag in payload schema (loop-safety contract consumed by Phase 6) — plan 05-02 Task 1; every new call site passes `is_agent_initiated: false`
- [x] Test stubs per-task via TDD — every code task above is tdd="true" RED-first; test files listed per row

Dispatcher resolution (roadmap open question): **Option B adopted** per 05-RESEARCH.md Pattern 7 — no notification dispatcher in Phase 5; agent outputs scoped to smartgym_agent_logs + echo verification; member push delivery activates in Phase 6.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| All 13 automations fire in staging vs demo gym | AGENT-03/04/05 | Needs dev server + echo receiver + event generation | Plan 05-07 Task 2 walkthrough: fire each trigger source, check echo log + smartgym_agent_logs (action_taken='echo-received') |
| Cooldown blocks duplicate fire in real time | AGENT-02 | Timing behavior | 05-07 Task 2 step 10: re-run agent-daily immediately; second wave is skip-logged |
| Tier matrix (starter 0 / growth subset / pro all) | AGENT-05 | Requires live tier flips on demo gym | 05-07 Task 2 step 11 |
| Migration 029 applied to live DB | AGENT-02/04 | Live db push requires user approval (repo convention) | Plan 05-01 Task 3 checkpoint |
| PLATFORM_EVENTS bypass design approval | AGENT-05 nuance | Planner-resolved spec contradiction needs human sign-off | 05-07 Task 2 step 12 |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or are explicit human checkpoints
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (every ❌ above is created RED-first by its own task)
- [x] No watch-mode flags
- [x] Feedback latency < 60s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** SIGNED OFF 2026-07-20 — automated gate green (Task 1 complete): web-admin 426/426 + mobile 227/227 + ai-assist 399/399 + tsc clean both apps. `wave_0_complete: true`. Task 2 (staging walkthrough) pending human verification.

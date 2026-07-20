---
phase: 5
slug: uptimizeai-agent-connection
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-19
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

*Filled by gsd-planner.*

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| — | — | — | AGENT-01..05 | unit + integration | `cd apps/web-admin && npx jest --silent` | ✅ | ⬜ pending |

---

## Wave 0 Requirements

- [ ] Dedup/cooldown BEFORE any new trigger call sites (AGENT-02 first — Pitfall 7)
- [ ] Migration (next free number 029) if dedup needs schema beyond gym_agent_config.last_fired_at — apply gated by user-approval checkpoint
- [ ] UPTIMIZE_WEBHOOK_URL env contract + dev echo receiver (DEMO_ECHO_AGENTS gate) — staging-ready decision LOCKED by user 2026-07-19
- [ ] is_agent_initiated flag in payload schema (loop-safety contract consumed by Phase 6)
- [ ] Test stubs per-task via TDD (trigger forwarding, cooldown logic, tier gating)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| All 13 automations fire in staging vs demo gym | AGENT-03 | Needs dev server + echo receiver + event generation | Staged walkthrough: fire each trigger source (Stripe test events, session complete, cron routes with x-internal-key) and check echo log + smartgym_agent_logs |
| Cooldown blocks duplicate fire in real time | AGENT-02 | Timing behavior | Fire same trigger twice within window, verify second is skip-logged |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or are explicit human checkpoints
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

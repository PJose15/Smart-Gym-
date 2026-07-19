---
phase: 01-gym-owner-self-serve-onboarding
plan: "07"
subsystem: onboarding-wizard
tags: [onboarding, machines, qr, wizard]
dependency_graph:
  requires: ["01-03", "01-05"]
  provides: [setup-wizard-page, first-machine-flow]
  affects: [onboarding-ux]
tech_stack:
  added: []
  patterns: [client-component-state-machine, suspense-search-params, tdd-behavior-tests]
key_files:
  created:
    - apps/web-admin/src/app/(onboard)/setup/page.tsx
    - apps/web-admin/src/app/(onboard)/setup/__tests__/setup-wizard.test.tsx
  modified: []
decisions:
  - "Suspense wraps SetupWizardContent to satisfy useSearchParams RSC boundary requirement"
  - "State machine uses 3 steps: machine-form → creating → qr-ready (no separate loading page)"
  - "checkout=success banner is dismissable and shown only when query param present"
  - "Auth error (401/network) renders inline sign-in prompt — no redirect — keeps owner in wizard shell"
  - "QR PDF download via plain anchor with download attribute to /api/machines/qr-pdf (existing route, no new params needed)"
metrics:
  duration_seconds: 490
  completed_date: "2026-07-19"
  tasks_completed: 2
  files_created: 2
  files_modified: 0
requirements_satisfied: [ONBD-04]
---

# Phase 1 Plan 07: First-Machine Wizard (/setup) Summary

**One-liner:** Client-side 3-step state machine (machine-form → creating → qr-ready) inside the `(onboard)/setup` wizard page — wires MachineForm minimal mode to POST /api/machines, then serves scan URL + printable QR PDF download.

## What Was Built

### Task 1 — /setup first-machine wizard page (`a3bc722`)

`apps/web-admin/src/app/(onboard)/setup/page.tsx` — 317 lines, Suspense-wrapped client component.

**State machine:** `'machine-form' | 'creating' | 'qr-ready'`

**Auth guard:** On mount, fetches `/api/onboard/status`. 401 or network error renders `sign-in-prompt` div with link to `/staff/login?next=/setup`. On success, stores `gym_name` for display.

**Checkout banner:** `?checkout=success` query param shows a dismissable "Subscription active — your 30-day trial has started" status banner on both form and success steps.

**Step A (machine-form):**
- `<WizardProgress currentStep={4} />`
- Heading "Add your first machine" / sub-copy matching the plan spec
- `<MachineForm minimal submitLabel="Create machine & QR code" .../>` with `submitting` and `error` props wired
- On submit → POST `/api/machines`; transitions to `creating` spinner; on 201 stores `{ id, name, qr_slug }` → `qr-ready`; on error returns to form with error message
- Muted "Skip for now" anchor → `/setup/import` (`data-testid="skip-link"`)

**Spinner (creating):** `role="status"` spinner with label; no dead end.

**Step B (qr-ready):**
- CheckCircleIcon SVG in accent circle
- `{machine.name} is live!` heading (`data-testid="machine-name"`)
- Copyable scan URL block (`data-testid="scan-url"`) with Copy button + Copied! feedback
- Primary CTA: `<a href="/api/machines/qr-pdf" download>Download printable QR PDF</a>` (`data-testid="qr-pdf-link"`)
- Secondary CTA: Import your members → `/setup/import`
- Tertiary: Go to my dashboard → `/owner/dashboard`
- "Add another machine" button resets state to Step A

All styling uses DOC_03 CSS tokens (`--accent`, `--color-bg-elevated`, `--color-text-*`, etc.).

### Task 2 — Wizard flow tests (`e1b9409`)

`apps/web-admin/src/app/(onboard)/setup/__tests__/setup-wizard.test.tsx` — 4 behaviors:

| Test | Behavior |
|------|----------|
| T1 | 401 from `/api/onboard/status` → sign-in prompt, no form |
| T2 | Happy path: status ok → form submit → POST called with name+muscles → QR step shows name/scan URL/PDF link |
| T3 | POST 500 → form re-renders with error message |
| T4 | Skip for now link present, href = `/setup/import` |

Mocks: `next/navigation` (useSearchParams/useRouter), `@/components/machines/MachineForm` (minimal stub with submit button), `../../components/WizardProgress`.

## Verification

- `npx tsc --noEmit` — no errors in new files (3 pre-existing errors in billing/import test files referencing unbuilt modules from plans 01-06/01-08; unchanged from baseline)
- `npx jest --testPathPattern="setup-wizard"` — 4/4 pass
- Full suite: 3 pre-existing failing suites unchanged; all 27 previously-passing suites still pass

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check

Files created:
- `apps/web-admin/src/app/(onboard)/setup/page.tsx` — FOUND
- `apps/web-admin/src/app/(onboard)/setup/__tests__/setup-wizard.test.tsx` — FOUND

Commits:
- `a3bc722` feat(01-07): add /setup first-machine wizard page — FOUND
- `e1b9409` test(01-07): add wizard flow tests for /setup page — FOUND

---
phase: 01-gym-owner-self-serve-onboarding
plan: 03
subsystem: api
tags: [zod, next.js, supabase, react, testing]

# Dependency graph
requires:
  - phase: 01-gym-owner-self-serve-onboarding
    provides: verifyStaff owner auth, rateLimit, generateQrSlug from @nexera/utils, generateMachineMistakes from @nexera/ai-assist
provides:
  - POST /api/machines route with owner auth, Zod validation, server-side qr_slug, collision retry
  - machineCreateSchema (lib/validation/machines.ts)
  - Shared MachineForm component with minimal mode for onboarding wizard
  - MOVEMENT_PATTERNS, EQUIPMENT_TYPES, DIFFICULTY_LEVELS, COMMON_MUSCLES constants exported
affects:
  - plan 01-07 (first-machine wizard uses POST /api/machines and MachineForm in minimal mode)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "verifyStaff('owner') guard at top of POST route before any other logic"
    - "machineCreateSchema: Zod schema with trimmed name, array validation, enum defaults"
    - "qr_slug collision: insert → if error.code === '23505' → retry with 4-char random suffix"
    - "MachineForm minimal prop: wizard-safe subset (name + muscles + equipment), full mode for admin CRUD"

key-files:
  created:
    - apps/web-admin/src/lib/validation/machines.ts
    - apps/web-admin/src/app/api/machines/route.ts
    - apps/web-admin/src/app/api/machines/__tests__/machines-post.test.ts
    - apps/web-admin/src/components/machines/MachineForm.tsx
    - apps/web-admin/src/components/machines/__tests__/MachineForm.test.tsx
  modified:
    - apps/web-admin/src/app/machines/page.tsx

key-decisions:
  - "POST /api/machines uses pure generateMachineMistakes (@nexera/ai-assist) not the edge-function client — edge-function calls are inappropriate from a server route"
  - "machines/page.tsx submission path kept as-is (client-side supabase insert with fetchMachineMistakes edge fallback) — converging admin page to new API is out of scope"
  - "MachineForm keeps gym selector OUT of component; page owns gym selection, wizard has none"
  - "qr_slug collision retry appends 4-char alphanumeric suffix (Math.random().toString(36).slice(2,6)) — simple, no extra dep"

patterns-established:
  - "MachineForm minimal prop: name + target muscles + equipment type only for wizard embed"
  - "API route test pattern: @jest-environment node, dynamic import of route after all mocks set up"

requirements-completed: [ONBD-04]

# Metrics
duration: 8min
completed: 2026-07-19
---

# Phase 01 Plan 03: POST /api/machines + Shared MachineForm Summary

**Owner-authenticated POST /api/machines with Zod validation, server-side qr_slug generation (with 23505 collision retry), and a shared MachineForm component with `minimal` mode for the onboarding wizard**

## Performance

- **Duration:** 8 min
- **Started:** 2026-07-19T00:59:37Z
- **Completed:** 2026-07-19T01:07:17Z
- **Tasks:** 2
- **Files modified:** 6 (3 created + 1 new + 2 new test files)

## Accomplishments
- `POST /api/machines` route: verifyStaff('owner'), rate limit, Zod validation, gym slug fetch, server-side qr_slug, template-based common_mistakes, 23505 collision retry, returns 201 with id/name/qr_slug
- `machineCreateSchema` in `lib/validation/machines.ts` with name max 80, target_muscles array, enum fields with defaults
- `MachineForm` shared component: minimal mode (name+muscles+equipment), full mode (all fields + movement pattern + difficulty + setup/safety textareas)
- `machines/page.tsx` inline form (~300 lines) replaced with `<MachineForm>` — behavior unchanged, gym selector retained in page
- 9 new tests (5 route + 4 component), all passing; full suite 300/300 green

## Task Commits

1. **Task 1: machineCreateSchema + POST /api/machines route** - `a35faa0` (feat)
2. **Task 2: Extract shared MachineForm component and wire into machines page** - `49c7e15` (feat)

**Plan metadata:** TBD (docs commit)

## Files Created/Modified
- `apps/web-admin/src/lib/validation/machines.ts` - machineCreateSchema + MachineCreateInput type
- `apps/web-admin/src/app/api/machines/route.ts` - POST handler with owner auth, Zod, qr_slug, collision retry
- `apps/web-admin/src/app/api/machines/__tests__/machines-post.test.ts` - 5 route tests
- `apps/web-admin/src/components/machines/MachineForm.tsx` - Shared form, minimal/full modes, exported constants
- `apps/web-admin/src/components/machines/__tests__/MachineForm.test.tsx` - 4 component tests
- `apps/web-admin/src/app/machines/page.tsx` - Replaced inline form JSX with MachineForm component

## Decisions Made
- Used pure `generateMachineMistakes` from `@nexera/ai-assist` in the server route (not the edge-function client) — edge-function HTTP calls are inappropriate from a Next.js route handler
- Kept `machines/page.tsx` on its existing client-side supabase insert path; converging to the new API is out of scope for this plan
- Gym selector lives in `machines/page.tsx` (admin admin context), not in `MachineForm` — wizard has no gym selector

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- TDD RED phase: `NextRequest` from `next/server` fails in jsdom test environment (`Request is not defined`). Fixed by adding `@jest-environment node` docblock to the route test file. The component tests keep the default jsdom environment.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `POST /api/machines` is ready for plan 01-07 (first-machine wizard) to call
- `MachineForm` with `minimal` mode is ready for wizard embed
- `machines/page.tsx` CRUD page behavior is unchanged

---
*Phase: 01-gym-owner-self-serve-onboarding*
*Completed: 2026-07-19*

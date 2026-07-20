---
phase: 04-mobile-program-view
plan: "01"
subsystem: mobile-data-layer
tags: [tdd, pure-logic, supabase, caching, program-service]
dependency_graph:
  requires: []
  provides: [programLogic, programService, CacheTTL.programData]
  affects: [04-02-program-screen-ui]
tech_stack:
  added: []
  patterns: [tdd-red-green, pure-function-module, supabase-direct-rls, cache-first-ttl]
key_files:
  created:
    - apps/mobile/src/lib/programLogic.ts
    - apps/mobile/src/lib/programService.ts
    - apps/mobile/src/lib/__tests__/programLogic.test.ts
    - apps/mobile/src/lib/__tests__/programService.test.ts
  modified:
    - apps/mobile/src/lib/cacheManager.ts
decisions:
  - "resolveTodayDayNumber mirrors @nexera/utils getTodaysProgramDay with injected now for determinism — home-screen TodayZone consistency wins over DB day_number"
  - "fetchProgram returns null (not throw) for no active program — PROG-04 empty state handled gracefully"
  - "Trainer lookup guarded by trainer_approved_by null check — AI-only programs skip users query entirely"
  - "program_data parsed as { days?: ProgramDay[] } | null with ?? [] fallback — malformed jsonb never throws"
  - "PROGRAM_CACHE_KEY returns string; callers cast as CacheKey per existing Dynamic CacheKey pattern (STATE.md)"
metrics:
  duration_minutes: 6
  completed_date: "2026-07-20"
  tasks_completed: 2
  files_created: 4
  files_modified: 1
  tests_added: 38
  test_baseline: 189
  test_total: 227
---

# Phase 4 Plan 01: Program Data Layer Summary

**One-liner:** Pure logic module + Supabase service for member active program with trainer name resolution, day cycling, and malformed-data guard.

## What Was Built

Two new lib modules implementing the data layer for the Phase 4 Mobile Program View:

**`programLogic.ts`** — pure module (no Supabase, no React):
- `programProgressPct(sessionsCompleted, sessionsTotal)` — clamped [0,100]
- `resolveTodayDayNumber(assignedAt, totalDays, now)` — deterministic mirror of `@nexera/utils getTodaysProgramDay` with injected `now`, same formula and guards
- `dayStatus(dayNumber, todayDayNumber)` — complete/today/upcoming classifier using day_number as cursor (not sessions_completed mapping)
- `weekLabel(weekNumber, durationWeeks)` — clamped "Week N of M" string
- `formatSetsReps(sets, reps)` — "N×M" with Unicode multiplication sign
- `buildMetaChips(program)` — goal chip (capitalized, omitted when null), duration, frequency, trainer or "AI Coach"

**`programService.ts`** — Supabase data layer:
- `ProgramExercise`, `ProgramDay`, `ActiveProgram` interfaces (exercise_name field confirmed from seed data, NOT name/machine_name)
- `PROGRAM_CACHE_KEY(memberId)` → `"program:{memberId}"`
- `fetchProgram(memberId)` — direct `ai_programs` SELECT under RLS, `.eq('is_active', true).order('created_at', {ascending: false}).limit(1).maybeSingle()`, trainer lookup guarded by `trainer_approved_by` null check, `program_data?.days ?? []` fallback

**`cacheManager.ts`** — added `programData: 5 * 60 * 1000` to CacheTTL.

## Test Results

| Suite | Tests | Result |
|-------|-------|--------|
| programLogic.test.ts | 23 | PASS |
| programService.test.ts | 15 | PASS |
| Full mobile suite | 227 | PASS |
| tsc --noEmit | — | CLEAN |

Baseline was 189. +38 new tests.

## Commits

| Hash | Type | Description |
|------|------|-------------|
| `753715d` | test | RED — failing tests for program data layer |
| `5d3e981` | feat | GREEN — programLogic + programService + CacheTTL.programData |

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check

Files created:
- [x] `apps/mobile/src/lib/programLogic.ts` — exists
- [x] `apps/mobile/src/lib/programService.ts` — exists
- [x] `apps/mobile/src/lib/__tests__/programLogic.test.ts` — exists (85+ lines)
- [x] `apps/mobile/src/lib/__tests__/programService.test.ts` — exists (180+ lines)
- [x] `apps/mobile/src/lib/cacheManager.ts` — modified (programData TTL added)

Commits:
- [x] `753715d` — test(04-01) RED commit
- [x] `5d3e981` — feat(04-01) GREEN commit

## Self-Check: PASSED

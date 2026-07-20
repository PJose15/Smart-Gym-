---
phase: 04-mobile-program-view
plan: "02"
subsystem: mobile-ui
tags: [mobile, program, expo-router, react-native, ui]
dependency_graph:
  requires: ["04-01"]
  provides: ["PROG-01", "PROG-02", "PROG-03", "PROG-04"]
  affects: ["app/program/index.tsx", "app/_layout.tsx"]
tech_stack:
  added: []
  patterns:
    - "discriminated ScreenState union (loading/empty/error/loaded)"
    - "cacheFirst + clearCache pull-to-refresh"
    - "fetchFeedContext for memberId resolution"
    - "resolveTodayDayNumber from created_at (home-screen parity)"
    - "encodeURIComponent exercise name navigation"
    - "expo-haptics on CTA press"
key_files:
  created:
    - apps/mobile/app/program/index.tsx
    - apps/mobile/src/components/program/ProgramHeader.tsx
    - apps/mobile/src/components/program/ProgramDayCard.tsx
    - apps/mobile/src/components/skeleton/ProgramScreenSkeleton.tsx
  modified:
    - apps/mobile/src/components/skeleton/index.ts
    - apps/mobile/app/_layout.tsx
decisions:
  - "Stack route (not tab) — tab bar is full at 6 items"
  - "program.days.length === 0 treated same as null → empty state (malformed jsonb guard)"
  - "mounted ref pattern for async load with cleanup to prevent setState on unmounted"
metrics:
  duration_seconds: 426
  tasks_completed: 2
  tasks_total: 2
  files_created: 4
  files_modified: 2
  tests_before: 227
  tests_after: 227
  completed_date: "2026-07-20"
---

# Phase 04 Plan 02: Program UI Screen Summary

**One-liner:** Full program screen with ProgramHeader (chips + progress bar), ProgramDayCard (today pill highlight + tappable exercise rows), ProgramScreenSkeleton, and a four-state route wired to the plan 04-01 data layer.

## What Was Built

### Task 1: Program Presentational Components

**ProgramHeader.tsx** (`src/components/program/`) — Renders the program's kicker ("YOUR PROGRAM"), title, optional description, meta chips from `buildMetaChips()` (goal, weeks, frequency, trainer/AI attribution), and a week progress bar driven by `programProgressPct()`. Shows a subtle "Catching up" hint when `on_track === false`. All tokens from `src/theme/*`.

**ProgramDayCard.tsx** (`src/components/program/`) — Single day card with DAY N mono label and day name. Status affordances: today gets a red pill ("TODAY") + primary `borderColor` accent; complete days get a green checkmark (✓); upcoming days have no badge. Exercise rows follow TodayZone's numbered-circle grammar, use `exercise.exercise_name` (not `.name`), and are `TouchableOpacity` with `accessibilityRole="link"` calling `onExercisePress()`.

**ProgramScreenSkeleton.tsx** (`src/components/skeleton/`) — Header block (kicker line + title line + chips row + progress rect) followed by 3 day-card rect bones at 110px height. Exported from `skeleton/index.ts` barrel.

### Task 2: Program Screen Route + Stack Registration

**app/program/index.tsx** — Stack route with four-state discriminated union. Load flow: `fetchFeedContext()` → `cacheFirst(PROGRAM_CACHE_KEY)` → null/empty-days → empty state; throw → error state; program with days → loaded state. Pull-to-refresh clears cache then re-fetches. Loaded render: `<ProgramHeader>` + "Start today's workout →" CTA (haptic + router.push `/(tabs)/scan`) + day list (`resolveTodayDayNumber(created_at, days.length, now)` for highlight, `dayStatus()` per card, `encodeURIComponent` for exercise navigation). Empty state (PROG-04) has copy + "Open Scanner →" CTA. Error state has "Try Again".

**app/_layout.tsx** — Added `<Stack.Screen name="program/index" options={{ title: 'Your Program' }} />` after the `challenges/[id]` entry, matching `coach-notes/index` precedent.

## Success Criteria Verification

- PROG-01: Header shows name, goal chip, weeks chip, sessions/week chip, trainer/AI chip, week progress bar — DONE
- PROG-02: All days scrollable as cards, sets×reps via `formatSetsReps`, today highlighted with pill + border, earlier-cycle days checkmarked — DONE
- PROG-03: Start CTA → `/(tabs)/scan` with haptic; exercise tap → `/exercise/${encodeURIComponent(name)}` — DONE
- PROG-04: null program → 'empty' state with freestyle scanner CTA — DONE
- Zero hardcoded hex — DONE (grep confirmed)
- 227/227 mobile tests pass, tsc clean — DONE

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check

- `apps/mobile/app/program/index.tsx` — FOUND
- `apps/mobile/src/components/program/ProgramHeader.tsx` — FOUND
- `apps/mobile/src/components/program/ProgramDayCard.tsx` — FOUND
- `apps/mobile/src/components/skeleton/ProgramScreenSkeleton.tsx` — FOUND
- Commits: `a489011` (Task 1), `9a14610` (Task 2) — FOUND

## Self-Check: PASSED

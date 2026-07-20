---
phase: 04-mobile-program-view
verified: 2026-07-19T02:00:00Z
status: human_needed
score: 9/9 must-haves verified
human_verification:
  - test: "Open home screen as a member with an active program. Scroll to TodayZone. Confirm 'View full program →' link is visible below the Start CTA (program-present branch) and tap it."
    expected: "Program screen opens showing title, goal chip, weeks chip, frequency chip, trainer/AI chip, week progress bar, and a scrollable list of all program days with today's card visually accented (red pill + border)."
    why_human: "Visual accent styling and navigation feel require on-device rendering to confirm."
  - test: "On the program screen, tap 'Start today's workout →'."
    expected: "Haptic fires and the scanner/workout tab opens."
    why_human: "Haptic feedback and tab-switch transition require on-device verification."
  - test: "Tap any exercise name in a day card."
    expected: "Exercise history screen opens for that exercise (URL-encoded name in route)."
    why_human: "Navigation correctness and exercise screen rendering require on-device verification."
  - test: "Open program screen as a member with no ai_programs row (or all rows have is_active = false)."
    expected: "Empty state shows 'No program assigned yet' with 'Open Scanner →' CTA — no blank screen or crash."
    why_human: "Requires a member account with no active program to exercise the null path."
  - test: "After the program screen loads, pull down to trigger a refresh."
    expected: "Spinner shows and the program reloads from network (cache cleared)."
    why_human: "Pull-to-refresh interaction requires on-device gesture."
---

# Phase 4: Mobile Program View Verification Report

**Phase Goal:** Members see their full training program — where they are, what's next, and what each day holds — not just today's slice
**Verified:** 2026-07-19T02:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | fetchProgram returns a fully-shaped ActiveProgram for a member with an active ai_programs row | VERIFIED | programService.ts lines 77-123: full SELECT, maybeSingle, all fields mapped |
| 2 | fetchProgram returns null (not a throw) when the member has no active program | VERIFIED | programService.ts line 89: `if (!program) return null` |
| 3 | trainer_name resolves from users.display_name when trainer_approved_by is set, stays null when not | VERIFIED | programService.ts lines 92-100: guarded second query with `?? null` fallback |
| 4 | Pure logic: week progress pct, which day is today, which days are complete — all deterministic via injected now | VERIFIED | programLogic.ts exports all 6 pure functions with injected `now`; 23 unit tests |
| 5 | Member opens /program and sees program name, goal, weeks, sessions/week, trainer attribution, and a week progress bar | VERIFIED | ProgramHeader.tsx: kicker, title, buildMetaChips, weekLabel, programProgressPct, ProgressBar all present |
| 6 | All program days render as scrollable cards with sets×reps; today's card is visually highlighted; earlier days show checkmarks | VERIFIED | ProgramDayCard.tsx: formatSetsReps, cardToday style with borderColor primary, checkmark in colors.success; program/index.tsx maps all days with dayStatus |
| 7 | Tapping 'Start today's workout' routes to the scan flow; tapping an exercise name opens /exercise/[name] | VERIFIED | program/index.tsx line 126: `router.push('/(tabs)/scan')`; line 133: `router.push('/exercise/${encodeURIComponent(exerciseName)}')` |
| 8 | Member with no active program sees a 'No program assigned yet' empty state — never a blank screen or crash | VERIFIED | program/index.tsx lines 140-158: full empty state with kicker, title, body copy, "Open Scanner →" CTA |
| 9 | TodayZone 'View full program →' link appears in both program-present branches, not in freestyle branch | VERIFIED | TodayZone.tsx lines 137, 179: ViewProgramLink rendered in todayDone (line 137) and todayWorkout (line 179) branches; absent from activeWorkoutId and freestyle branches |

**Score:** 9/9 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/mobile/src/lib/programLogic.ts` | Pure logic module (no Supabase, no React) | VERIFIED | 128 lines; exports programProgressPct, resolveTodayDayNumber, dayStatus, weekLabel, formatSetsReps, buildMetaChips |
| `apps/mobile/src/lib/programService.ts` | Data layer: fetchProgram + types + PROGRAM_CACHE_KEY | VERIFIED | 125 lines; exports all specified types and functions |
| `apps/mobile/src/lib/__tests__/programLogic.test.ts` | Unit tests for all pure functions incl. parity test | VERIFIED | Exists; imports getTodaysProgramDay from @nexera/utils for parity assertion |
| `apps/mobile/src/lib/__tests__/programService.test.ts` | Service tests: happy path, null path, trainer_name, malformed, cache key | VERIFIED | Exists; makeSupabaseMock helper present |
| `apps/mobile/app/program/index.tsx` | Full program screen: loading/empty/error/loaded states | VERIFIED | 319 lines; all four states implemented |
| `apps/mobile/src/components/program/ProgramHeader.tsx` | Name/goal/meta chips + week progress bar | VERIFIED | 163 lines; all required elements present |
| `apps/mobile/src/components/program/ProgramDayCard.tsx` | Day card with today highlight, checkmark, exercise rows, navigation | VERIFIED | 184 lines; exercise_name field used (not .name) |
| `apps/mobile/src/components/skeleton/ProgramScreenSkeleton.tsx` | Loading placeholder (SkeletonBone header + day card bones) | VERIFIED | 53 lines; header block + 3 day-card rects |
| `apps/mobile/src/components/home/TodayZone.tsx` | 'View full program →' entry link routing to /program | VERIFIED | ViewProgramLink component at line 53; rendered at lines 137 and 179 |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| programService.ts | ai_programs table | `supabase.from('ai_programs')` | WIRED | Line 79: `.from('ai_programs')` with full column select |
| programService.ts | users table | trainer_approved_by null check before users lookup | WIRED | Lines 93-100: guarded `supabase.from('users')` |
| cacheManager.ts | programService consumers | CacheTTL.programData constant | WIRED | cacheManager.ts line 27: `programData: 5 * 60 * 1000` |
| app/program/index.tsx | programService.ts | `cacheFirst(PROGRAM_CACHE_KEY(memberId) as CacheKey, () => fetchProgram(memberId), CacheTTL.programData)` | WIRED | Lines 87-91: exact call pattern |
| app/program/index.tsx | feedService.ts | `fetchFeedContext()` for memberId resolution | WIRED | Line 71: `const ctx = await fetchFeedContext()` |
| ProgramDayCard.tsx | /exercise/[name] | `router.push('/exercise/${encodeURIComponent(exercise_name)}')` | WIRED | program/index.tsx line 133 via handleExercisePress |
| app/program/index.tsx | scan flow | `router.push('/(tabs)/scan')` on Start CTA | WIRED | Line 126 |
| app/_layout.tsx | app/program/index.tsx | `Stack.Screen name="program/index"` registration | WIRED | _layout.tsx lines 191-194: title "Your Program" |
| TodayZone.tsx | app/program/index.tsx | `router.push('/program' as any)` on ViewProgramLink | WIRED | Lines 137 and 179 |
| skeleton/index.ts | ProgramScreenSkeleton.tsx | barrel export | WIRED | index.ts line 11 |

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| PROG-01 | 04-01, 04-02, 04-03 | Member can open a full program view showing plan metadata and overall progress | SATISFIED | ProgramHeader renders title, goal chip, weeks chip, frequency chip, trainer/AI chip; week progress bar via programProgressPct; entry point in TodayZone |
| PROG-02 | 04-01, 04-02 | Member sees every program day with its exercises, with today highlighted and past days marked complete | SATISFIED | ProgramDayCard renders all days; today gets red pill + primary borderColor; complete days show ✓ in colors.success |
| PROG-03 | 04-01, 04-02, 04-03 | Member can start today's workout or drill into an exercise from the program view | SATISFIED | "Start today's workout →" CTA pushes `/(tabs)/scan` with haptic; exercise rows push `/exercise/${encodeURIComponent(name)}` |
| PROG-04 | 04-01, 04-02 | Member with no assigned program sees a useful empty state | SATISFIED | null or days.length === 0 → 'empty' state with "No program assigned yet" + "Open Scanner →" CTA |

No orphaned requirements — only PROG-01 through PROG-04 are mapped to Phase 4 in REQUIREMENTS.md.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| ProgramScreenSkeleton.tsx | 2, 29 | "placeholder" in comments | Info | Legitimate skeleton component comments — not implementation stubs |

No blocker or warning anti-patterns found. The two "placeholder" hits describe the skeleton loading component's purpose, which is correct usage.

### Human Verification Required

The automated gate (mobile 227/227 tests + web-admin 347/347 tests, both tsc clean) passed before this verification. All code paths are substantively implemented and wired. The following items require on-device UAT per the PLAN's own deferral note:

#### 1. Program screen visual fidelity

**Test:** Open home screen as a member with an active program. Scroll to TodayZone. Confirm "View full program →" link is visible, then tap it.
**Expected:** Program screen opens showing title, goal chip, weeks chip, frequency chip, trainer/AI chip, week progress bar, and a scrollable list of all program days with today's card visually accented (red pill + border accent).
**Why human:** Visual accent styling and navigation feel require on-device rendering to confirm.

#### 2. "Start today's workout" haptic + navigation

**Test:** On the program screen, tap "Start today's workout →".
**Expected:** Haptic fires and the scanner/workout tab opens.
**Why human:** Haptic feedback and tab-switch transition require on-device verification.

#### 3. Exercise navigation

**Test:** Tap any exercise name in a day card.
**Expected:** Exercise history screen opens for that exercise (URL-encoded name in route).
**Why human:** Navigation correctness and exercise screen rendering require on-device verification.

#### 4. Empty state (no active program)

**Test:** Open the program screen as a member with no active ai_programs row.
**Expected:** "No program assigned yet" empty state with "Open Scanner →" CTA — no blank screen or crash.
**Why human:** Requires a member account with no active program to exercise the null code path.

#### 5. Pull-to-refresh

**Test:** After the program screen loads, pull down to trigger a refresh.
**Expected:** Spinner shows and the program reloads from network (cache cleared).
**Why human:** Pull-to-refresh gesture requires on-device interaction.

### Summary

All 9 observable truths are verified. All 9 required artifacts exist and are substantively implemented (not stubs). All 10 key links are wired. All 4 requirements (PROG-01 through PROG-04) are satisfied with direct code evidence. No hardcoded hex colors in any Phase 4 file. The program screen is a Stack route outside the tab group (confirmed: 7 entries in `app/(tabs)/`). The `exercise_name` field is used correctly throughout (not `.name`).

The phase goal — "Members see their full training program — where they are, what's next, and what each day holds — not just today's slice" — is achieved in code. The 5 deferred items are on-device UAT checks for visual/haptic/navigation feel, which cannot be verified programmatically and were explicitly deferred in the plan.

---

_Verified: 2026-07-19T02:00:00Z_
_Verifier: Claude (gsd-verifier)_

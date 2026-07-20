# Phase 4: Mobile Program View — Research

**Researched:** 2026-07-19
**Domain:** React Native / Expo Router — read-only program display on top of existing Supabase + web-admin API
**Confidence:** HIGH (all findings grounded in live codebase reads)

---

## Summary

Phase 4 is a pure UI wiring task with no net-new API surface. The member program route (`GET /api/member/[memberId]/program`) already exists, is auth-protected via `verifyMember`, returns the full `program_data` jsonb, and is rate-limited at 30 req/min. RLS on `ai_programs` has a `programs_own` policy (`member_id IN (SELECT id FROM members WHERE user_id = auth.uid())`) and `authenticated` role has blanket table grants restored in migration 026 — direct Supabase reads are fully available. The mobile app has been reading `ai_programs` directly since before Phase 1 (the home screen's `TodayZone` already does it), so no migration is needed for reading.

The program data lives entirely in `ai_programs.program_data` as a `{ days: ProgramDay[] }` jsonb blob. There are no separate `program_days` or `program_exercises` tables for AI-generated programs — those tables belong to trainer-template programs (`programs` → `program_days` → `program_exercises`) which are out of scope here; the active program path for members is always `ai_programs`. The home screen proves the safe query pattern: direct `.from('ai_programs').select(...).eq('member_id', memberRecord.id).eq('is_active', true)`.

The exercise detail screen (`app/exercise/[name].tsx`) already exists at the exact route the plan needs. Entry point for the program view should be the home screen's TodayZone "today" card — a "View full program" link there is the natural tap target. The program view itself should be a new Expo Router screen at `app/program/index.tsx` (or a tab on the Progress tab), not a bottom-tab (tab bar is full at 6 items already).

**Primary recommendation:** Build `programService.ts` (direct Supabase, cacheFirst 5-min TTL) + `app/program/index.tsx` (ScrollView with header + day cards + today highlight + empty state). No new API route, no migration. Entry point: tap "View full program" link in TodayZone or CommunityPulse area.

---

## Phase Requirements

<phase_requirements>

| ID | Description | Research Support |
|----|-------------|-----------------|
| PROG-01 | Program header (name, goal, weeks, sessions/week, trainer) + week progress bar | `GET /api/member/[memberId]/program` returns all fields; `progress_pct = sessions_completed / sessions_total * 100`; `trainer_name` resolved server-side from `trainer_approved_by`; direct Supabase has same data |
| PROG-02 | Day cards list exercises as sets×reps chips; today highlighted; past days show checkmarks | `program_data.days[]` has `day_number`, `name`, `exercises[]{exercise_name, default_sets, default_reps}`; `day_number` from API is current day; `sessions_completed` tells how many days are done |
| PROG-03 | "Start today's workout" CTA → scan flow; exercise name tap → `/exercise/[name]` screen | TodayZone already does `router.push('/(tabs)/scan')`; exercise screen exists at `app/exercise/[name].tsx` |
| PROG-04 | Empty state when no program assigned | `program: null` response from API; no `ai_programs` row with `is_active=true` |

</phase_requirements>

---

## Standard Stack

### Core — Already in the mobile app, no new installs

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@supabase/supabase-js` | installed | Direct DB reads under RLS | Established mobile data pattern; `ai_programs` RLS confirmed |
| `expo-router` | SDK 52 | File-based routing, `useLocalSearchParams`, `router.push` | All mobile navigation uses this |
| `react-native` ScrollView / FlatList | SDK 52 | Scrollable day card list | Pattern used in challenges.tsx and progress.tsx |
| `AsyncStorage` via `cacheManager.ts` | installed | `cacheFirst` / `CacheTTL` pattern | Used by challenges, feed, training profile |
| `@nexera/types` | workspace | `WeightUnit`, shared types | Already used by home/challenges |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `expo-haptics` | ~14.0.1 (SDK 52 compatible) | Haptic on "Start workout" tap | Used in challenges join; same pattern |
| `@react-navigation/native` `useFocusEffect` | installed | Re-load on tab focus | Used in home, exercise, challenges |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Direct Supabase read | Web-admin API route | API route requires EXPO_PUBLIC_API_URL + Bearer JWT; direct Supabase under RLS is simpler and proven for read-only data; challenges use API only for the write (join); program view is 100% read-only |

**Installation:** No new packages needed.

---

## Architecture Patterns

### Mobile Data Layer Pattern (from challengeService.ts)

The established mobile data-layer pattern:
1. `fetchFeedContext()` → resolves `{ memberId, gymId }` from `supabase.auth.getUser()` + `members` table
2. `cacheFirst(key, fetchFn, ttlMs)` → returns cached immediately, refreshes in background
3. Direct Supabase queries for reads; Bearer JWT API routes only for writes

Program service follows the same shape as `challengeService.ts` — a `programService.ts` in `apps/mobile/src/lib/`.

### Recommended File Structure

```
apps/mobile/
├── app/
│   └── program/
│       └── index.tsx            # Full program screen (Expo Router stack route)
└── src/
    ├── components/
    │   └── program/
    │       ├── ProgramHeader.tsx         # name / goal / meta chips + progress bar
    │       ├── ProgramDayCard.tsx        # single day card (exercises, today highlight, done check)
    │       └── ProgramScreenSkeleton.tsx # loading placeholder
    └── lib/
        ├── programService.ts            # data layer (fetchProgram, PROGRAM_CACHE_KEY)
        └── __tests__/
            └── programService.test.ts   # unit tests
```

### Pattern 1: Direct Supabase Read Under RLS (confirmed working)

The home screen already reads `ai_programs` directly — this is the ground truth:

```typescript
// Source: apps/mobile/app/(tabs)/index.tsx lines 306-326
const { data: memberRecord } = await supabase
  .from('members')
  .select('id')
  .eq('user_id', user.id)
  .eq('gym_id', gymId)
  .maybeSingle();

const { data: activeProgram } = await supabase
  .from('ai_programs')
  .select('id, program_data, sessions_per_week, day_number, created_at')
  .eq('member_id', memberRecord.id)
  .eq('is_active', true)
  .order('created_at', { ascending: false })
  .limit(1)
  .maybeSingle();
```

For the program screen, prefer the richer set of columns already used by `GET /api/member/[memberId]/program`:

```typescript
// Source: apps/web-admin/src/app/api/member/[memberId]/program/route.ts
.select('id, title, description, goal, duration_weeks, sessions_per_week, week_number, day_number, sessions_completed, sessions_total, on_track, program_data, generated_by, trainer_approved, trainer_approved_by, created_at')
```

`trainer_name` resolution requires a second query to `users` on `trainer_approved_by` — include this in the service layer.

### Pattern 2: CacheFirst with 5-min TTL

```typescript
// Source: apps/mobile/src/lib/cacheManager.ts
export async function cacheFirst<T>(key, fetchFn, ttlMs?): Promise<T>
// Usage pattern from challenges:
const data = await cacheFirst(PROGRAM_CACHE_KEY(memberId), () => fetchProgram(memberId), CacheTTL.challengesList);
```

Add `programData: 5 * 60 * 1000` to `CacheTTL` (or reuse `challengesList` value — same 5-min window is appropriate since program data changes infrequently mid-session).

### Pattern 3: FeedContext for memberId + gymId Resolution

```typescript
// Source: apps/mobile/src/lib/feedService.ts — fetchFeedContext()
// Returns { memberId, gymId, gymName } — the standard auth context for all mobile screens
const ctx = await fetchFeedContext();
if (!ctx) { setError(true); return; }
```

All new mobile screens use `fetchFeedContext()` instead of re-implementing the `auth.getUser() → members` lookup chain.

### Pattern 4: Entry Point — "View full program" in TodayZone

The TodayZone card already renders the program day name and exercises. Add a secondary link below the exercises list:

```typescript
// TodayZone.tsx: add below exerciseList view
<TouchableOpacity onPress={() => router.push('/program')} style={styles.viewProgramLink}>
  <Text style={styles.viewProgramText}>View full program →</Text>
</TouchableOpacity>
```

This is the natural discovery surface — member sees today's workout and taps to see the full week.

### Pattern 5: Navigation to Exercise Detail

```typescript
// Source: TodayZone already uses router.push('/(tabs)/scan')
// Exercise screen: app/exercise/[name].tsx — accepts URL-encoded name param
// Pattern: router.push(`/exercise/${encodeURIComponent(exercise.exercise_name)}`)
// Confirmed: exercise screen does decodeURIComponent(name) on line 59
```

### Pattern 6: "Today" Day Determination

The home screen uses `getTodaysProgramDay(assignment.assigned_at, days.length)` from `@nexera/utils`. The API route uses `(program.day_number - 1) % program.sessions_per_week`. For the program screen, use `day_number` directly from the API response (already computed server-side) rather than recalculating client-side.

### Anti-Patterns to Avoid

- **Re-implementing `fetchFeedContext`:** Never call `supabase.auth.getUser()` + `members` select directly in a screen component — use `fetchFeedContext()` which already handles this.
- **Using the web-admin API route for reads:** Direct Supabase under RLS is simpler, avoids Bearer JWT flow, and is proven. Use API route only if writing.
- **Querying `program_days` / `program_exercises` tables:** AI programs store everything in `program_data` jsonb. The relational tables are for trainer-template programs (different flow, out of scope).
- **Adding a 7th bottom tab:** Tab bar has 6 tabs (Home, Scan, Feed, Challenges, Progress, Profile). Program view must be a stack route, not a tab.
- **Hardcoded hex colors:** All colors must come from `colors` token (e.g. `colors.primary`, `colors.surfaceElevated`, `colors.border`). No `#7C5CFF` or raw hex strings.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Auth context (userId, memberId, gymId) | Custom `getUser()` + member query in screen | `fetchFeedContext()` from feedService | Already handles null/error, proven pattern |
| AsyncStorage cache with TTL | Custom cache map | `cacheFirst` / `getCached` / `setCache` / `CacheTTL` from `cacheManager.ts` | Version-stamped, TTL-aware, background refresh |
| Weight formatting | `${weight} kg` string concat | `formatWeight()` from `@nexera/utils` (used in exercise screen) | Handles unit, decimal precision, edge cases |
| Skeleton loading placeholder | ActivityIndicator | `SkeletonBone` + `Shimmer` pattern (see `ChallengesScreenSkeleton.tsx`) | Design system convention; no blank-screen flicker |
| Reduced motion check | Hardcode animations | `AccessibilityInfo.isReduceMotionEnabled()` | Used in challenges.tsx; required for a11y |
| Exercise detail navigation | Custom exercise modal | `router.push('/exercise/${encodeURIComponent(name)}')` | Screen already exists, works with URL params |

**Key insight:** This phase is ~95% component work. The data layer is a thin service file; everything else (auth, cache, navigation, design tokens, skeleton) is already in place and must be reused verbatim.

---

## Common Pitfalls

### Pitfall 1: program_data jsonb shape — exercise_name not machine_name

**What goes wrong:** Developer assumes exercises have a `name` field or reads `machine_name`. The jsonb has `exercise_name`.

**Why it happens:** `program_exercises` relational table uses `exercise_name`; jsonb mirrors this but it's easy to miss.

**How to avoid:** Interface definition:
```typescript
interface ProgramExercise {
  exercise_name: string;   // NOT name, NOT machine_name
  machine_id: string | null;
  default_sets: number;
  default_reps: number;
}
interface ProgramDay {
  day_number: number;
  name: string;
  exercises: ProgramExercise[];
}
interface ProgramData {
  days: ProgramDay[];
}
```

**Warning signs:** TypeScript error on `exercise.name` access; exercises all showing "Unknown".

### Pitfall 2: "Today" vs `day_number` — off-by-one

**What goes wrong:** Using `(day_number - 1) % sessions_per_week` to index into `days[]` array (zero-indexed) when `day_number` values in the jsonb are 1-indexed. Carlos's seed data has `day_number: 1` through `day_number: 4`.

**How to avoid:** `days.find(d => d.day_number === program.day_number)` — match by value, not array index. This is what the home screen does.

**Warning signs:** Wrong day highlighted; day 1 shows day 2's exercises.

### Pitfall 3: `trainer_approved_by` null → trainer name query crashes

**What goes wrong:** Fetching trainer name from `users` when `trainer_approved_by` is null (most AI-only programs have no trainer approval).

**How to avoid:** Guard: `trainerName = program.trainer_approved_by ? await fetchTrainerName(program.trainer_approved_by) : null`. The API route does this correctly (line 47: `if (program.trainer_approved_by)`).

**Warning signs:** Supabase returns 0 rows + empty string; UI shows "null" as trainer name.

### Pitfall 4: `sessions_completed` vs days-done counting

**What goes wrong:** Assuming `sessions_completed = 5` means days 1 through 5 are done. The API tracks cumulative session count across the entire program, not which specific day IDs are completed.

**How to avoid:** For "past days checked" visual, use `day_number` as the cursor: days with `d.day_number < program.day_number` are treated as done in the current week cycle. This matches the home screen's pattern (it calculates `todayDayNumber = getTodaysProgramDay(assignment.assigned_at, days.length)` and highlights that day).

**Warning signs:** All days show checked even on day 1; or no days show checked.

### Pitfall 5: Missing CacheKey type for template literal keys

**What goes wrong:** TypeScript error `Type 'string' is not assignable to type 'CacheKey'` when using `PROGRAM_CACHE_KEY(memberId)` as a template literal.

**How to avoid:** Follow the challenge service pattern: `as CacheKey` cast, or use a dedicated `const` key string. The STATE.md decision documents this: "Dynamic cache key strings cast to `CacheKey` for clearCache/setCache calls".

```typescript
export function PROGRAM_CACHE_KEY(memberId: string): string {
  return `program:${memberId}`;
}
// Usage: cacheFirst(PROGRAM_CACHE_KEY(memberId) as CacheKey, ...)
```

### Pitfall 6: Tab navigation vs stack navigation for new screen

**What goes wrong:** Adding `app/program.tsx` as a tabs file gets picked up by Expo Router as a tab screen and breaks the tab bar layout.

**How to avoid:** Create `app/program/index.tsx` (stack route under the root stack, not inside `(tabs)/`). The tab layout at `app/(tabs)/_layout.tsx` only renders the 6 named screens inside `(tabs)/`. Stack routes outside that group are rendered as modal/stack screens. Confirm by checking: `app/(tabs)/` has `index`, `scan`, `feed`, `challenges`, `progress`, `profile` — `program` must NOT be added here.

---

## Code Examples

### fetchProgram Service Function

```typescript
// apps/mobile/src/lib/programService.ts
import { supabase } from './supabase';
import { fetchFeedContext } from './feedService';
import type { WeightUnit } from '@nexera/types';

export interface ProgramExercise {
  exercise_name: string;
  machine_id: string | null;
  default_sets: number;
  default_reps: number;
}

export interface ProgramDay {
  day_number: number;
  name: string;
  exercises: ProgramExercise[];
}

export interface ActiveProgram {
  id: string;
  title: string;
  description: string | null;
  goal: string | null;
  duration_weeks: number;
  sessions_per_week: number;
  week_number: number;
  day_number: number;         // current day in rotation (1-indexed)
  sessions_completed: number;
  sessions_total: number;
  on_track: boolean | null;
  days: ProgramDay[];
  generated_by: string | null;
  trainer_approved: boolean;
  trainer_name: string | null;
  created_at: string;
}

export function PROGRAM_CACHE_KEY(memberId: string): string {
  return `program:${memberId}`;
}

export async function fetchProgram(memberId: string): Promise<ActiveProgram | null> {
  const { data: program } = await supabase
    .from('ai_programs')
    .select(
      'id, title, description, goal, duration_weeks, sessions_per_week, week_number, day_number, sessions_completed, sessions_total, on_track, program_data, generated_by, trainer_approved, trainer_approved_by, created_at',
    )
    .eq('member_id', memberId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!program) return null;

  // Resolve trainer name if program was trainer-approved
  let trainerName: string | null = null;
  if (program.trainer_approved_by) {
    const { data: trainer } = await supabase
      .from('users')
      .select('display_name')
      .eq('id', program.trainer_approved_by)
      .maybeSingle();
    trainerName = trainer?.display_name ?? null;
  }

  const programData = program.program_data as { days?: ProgramDay[] } | null;
  const days = programData?.days ?? [];

  return {
    id: program.id,
    title: program.title,
    description: program.description,
    goal: program.goal,
    duration_weeks: program.duration_weeks,
    sessions_per_week: program.sessions_per_week,
    week_number: program.week_number,
    day_number: program.day_number,
    sessions_completed: program.sessions_completed,
    sessions_total: program.sessions_total,
    on_track: program.on_track,
    days,
    generated_by: program.generated_by,
    trainer_approved: program.trainer_approved ?? false,
    trainer_name: trainerName,
    created_at: program.created_at,
  };
}
```

### "Today" Day Determination (no hand-roll)

```typescript
// In program/index.tsx — match by value, not index
const todayDay = program.days.find((d) => d.day_number === program.day_number) ?? program.days[0];
// A day is "done" if its day_number is less than the current day_number in the cycle
const isDayDone = (d: ProgramDay) =>
  d.day_number < program.day_number ||
  (program.sessions_completed > 0 && d.day_number < program.day_number);
// Simpler: any day with day_number < program.day_number is considered done in current cycle
```

### "Start today's workout" CTA navigation

```typescript
// Source: apps/mobile/src/components/home/TodayZone.tsx line 157
// Exact same pattern used in TodayZone
<TouchableOpacity
  onPress={() => router.push('/(tabs)/scan')}
  accessibilityRole="button"
  accessibilityLabel="Start today's workout"
>
  <Text>Start today's workout →</Text>
</TouchableOpacity>
```

### Exercise name tap → detail screen

```typescript
// Source: apps/mobile/app/exercise/[name].tsx line 59: decodeURIComponent(name)
<TouchableOpacity
  onPress={() => router.push(`/exercise/${encodeURIComponent(exercise.exercise_name)}`)}
  accessibilityRole="link"
  accessibilityLabel={`View ${exercise.exercise_name} history`}
>
  <Text>{exercise.exercise_name}</Text>
</TouchableOpacity>
```

### Skeleton Bone Pattern

```typescript
// Source: apps/mobile/src/components/skeleton/ChallengesScreenSkeleton.tsx
import { SkeletonBone } from './SkeletonBone';
// Usage for a program header placeholder:
<SkeletonBone variant="line" width="60%" height={22} />
<SkeletonBone variant="rect" width="100%" height={8} borderRadius={4} /> // progress bar
// Day card placeholder:
<SkeletonBone variant="rect" width="100%" height={80} borderRadius={14} />
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `uuid_generate_v4()` | `gen_random_uuid()` | migration 001 | New insert policies must use `gen_random_uuid()` |
| Separate `program_days` / `program_exercises` tables for member programs | `ai_programs.program_data` jsonb `{ days: [] }` | Phase 8.2 build | The jsonb is the source of truth; do not query relational tables |
| Mobile queries failing silently | Migration 026 restored `authenticated` role grants | Migration 026 | All direct Supabase reads from mobile now work under RLS |
| Trainer-template programs via `programs` table | AI-generated programs via `ai_programs` | Phase 3 build | Member assignment is `ai_programs.is_active = true`; `member_program_assignments` maps `ai_program_id` |

**`member_program_assignments` table note:** This table exists (created in migration 001) and stores `{ member_id, ai_program_id, assigned_by, assigned_at }`. However, the home screen and all existing program queries use `ai_programs` directly (filtering by `member_id` + `is_active = true`). The assignment table is supplementary. Do NOT add a JOIN to it — the direct `ai_programs` query is the ground-truth pattern.

---

## Open Questions

1. **"View full program" entry point placement**
   - What we know: Tab bar is full (6 tabs). TodayZone card is the primary program surface on home.
   - What's unclear: Should the program route be reachable from Profile or from a link in TodayZone only?
   - Recommendation: Add a "View full program →" text link at the bottom of the TodayZone card when `todayWorkout !== null`. This requires a one-line change to TodayZone. Profile is the secondary entry point (the progress/profile tab could link to it). Plan both but TodayZone link is the primary.

2. **Days "done" determination — `sessions_completed` count vs `day_number`**
   - What we know: `sessions_completed` is a cumulative count (5 sessions done in a 16-session program). `day_number` is the current day in the active rotation (1-4 for Carlos's 4-day program).
   - What's unclear: Whether `sessions_completed` maps cleanly to specific day indices across program weeks, or only tracks totals.
   - Recommendation: Use `day_number` as the cursor. Days `< day_number` in the current rotation = done this cycle. This matches home screen behavior and avoids complex week-cycle math. Planner should confirm this is sufficient for the "completed days show checkmarks" requirement.

3. **Program screen navigation entry in tab bar `_layout.tsx`**
   - What we know: `app/program/index.tsx` as a stack route will work. It needs a `Stack.Screen` options override for the header title.
   - What's unclear: Whether the `app/_layout.tsx` root Stack needs any explicit `<Stack.Screen name="program/index">` entry or if Expo Router auto-discovers it.
   - Recommendation: Expo Router auto-discovers all files under `app/` outside `(tabs)/`; no explicit Stack.Screen entry needed in the root layout. Planner can proceed without a layout change — but Wave 0 should verify this builds without a header title override issue.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Jest (ts-jest preset, node environment) |
| Config file | `apps/mobile/jest.config.js` |
| Quick run command | `cd apps/mobile && npx jest --testPathPattern=programService --passWithNoTests --run` |
| Full suite command | `cd apps/mobile && npx jest` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PROG-01 | `fetchProgram` returns structured program with title/goal/weeks/trainer_name | unit | `cd apps/mobile && npx jest --testPathPattern=programService -t "fetchProgram"` | ❌ Wave 0 |
| PROG-01 | `fetchProgram` resolves trainer_name from `users` when trainer_approved_by is set | unit | `cd apps/mobile && npx jest --testPathPattern=programService -t "trainer_name"` | ❌ Wave 0 |
| PROG-01 | `fetchProgram` returns null when no active program | unit | `cd apps/mobile && npx jest --testPathPattern=programService -t "null"` | ❌ Wave 0 |
| PROG-02 | `program.days.find(d => d.day_number === program.day_number)` correctly identifies today | unit | `cd apps/mobile && npx jest --testPathPattern=programService -t "today"` | ❌ Wave 0 |
| PROG-03 | `PROGRAM_CACHE_KEY` produces expected string | unit | `cd apps/mobile && npx jest --testPathPattern=programService -t "cache key"` | ❌ Wave 0 |
| PROG-04 | Empty state renders when program is null | manual | On-device: sign in as member without program, open program screen | N/A |

### Sampling Rate

- **Per task commit:** `cd apps/mobile && npx jest --testPathPattern=programService`
- **Per wave merge:** `cd apps/mobile && npx jest`
- **Phase gate:** Full suite green + web-admin suite green (`cd apps/web-admin && npx jest`) before verification

### Wave 0 Gaps

- [ ] `apps/mobile/src/lib/__tests__/programService.test.ts` — covers PROG-01 through PROG-03 (fetchProgram happy path, null path, trainer_name resolution, PROGRAM_CACHE_KEY)
- [ ] `CacheTTL.programData` constant in `cacheManager.ts` — add `programData: 5 * 60 * 1000` entry

---

## Sources

### Primary (HIGH confidence)

- `apps/web-admin/src/app/api/member/[memberId]/program/route.ts` — confirmed response shape (all fields), `verifyMember` auth, `admin` client pattern
- `apps/mobile/app/(tabs)/index.tsx` — confirmed direct Supabase `ai_programs` query, `fetchFeedContext`-equivalent pattern, `program_data.days` parsing
- `supabase/migrations/001_nexera_schema.sql` lines 1200-1219 — `programs_own` RLS policy confirmed (`member_id IN (SELECT id FROM members WHERE user_id = auth.uid())`)
- `supabase/migrations/026_restore_client_grants.sql` — `GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated` confirmed; direct mobile reads work
- `apps/mobile/src/lib/cacheManager.ts` — `cacheFirst`, `CacheTTL`, `CacheKey` type pattern
- `apps/mobile/src/lib/feedService.ts` — `fetchFeedContext()` returns `{ memberId, gymId }`
- `apps/mobile/app/exercise/[name].tsx` line 59 — `decodeURIComponent(name)` confirmed; route is `exercise/[name]`
- `apps/mobile/app/(tabs)/_layout.tsx` — 6 tabs confirmed; `program` must be a stack route outside `(tabs)/`
- `apps/mobile/src/lib/challengeService.ts` — canonical data-layer pattern to copy
- `supabase/seed-bulk.sql` lines 595-619 — Carlos's program data; `program_data.days` exact jsonb shape confirmed

### Secondary (MEDIUM confidence)

- `apps/web-admin/src/app/api/programs/active/route.ts` — cross-references `day_number` as cursor for today's day; `(day_number-1) % sessions_per_week` index (for array access, not value-match); confirms `program_data?.days` shape
- Feature research `FEATURES.md` — confirmed `progress_pct = sessions_completed / sessions_total * 100`; `duration_weeks`, `sessions_per_week` fields; `program_data.days[].exercises` shape

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries confirmed installed in package.json, all patterns confirmed in existing files
- Architecture: HIGH — grounded in live code (challengeService, feedService, home screen, exercise screen)
- Pitfalls: HIGH — all pitfall examples confirmed from actual code (e.g. `decodeURIComponent` in exercise screen, `as CacheKey` cast in challengeService, jsonb field names from seed data)
- RLS/grants: HIGH — migration files read directly

**Research date:** 2026-07-19
**Valid until:** 2026-09-19 (stable stack; RLS policies won't change without a new migration)

/**
 * Smart Program Generation — AI-assisted workout program creation.
 * Phase A: Rules-based split determination and exercise filtering.
 * Phase B: Optional LLM enhancement for exercise selection.
 * Fallback: Deterministic default program if LLM fails.
 */

import type { LLMProvider } from '../providers/llmProvider';

// ─── Types ────────────────────────────────────────────────

export interface GeneratedExercise {
  exercise_name: string;
  machine_id: string | null;
  default_sets: number;
  default_reps: number;
}

export interface GeneratedProgramDay {
  day_number: number;
  name: string;
  exercises: GeneratedExercise[];
}

export interface GeneratedProgram {
  name: string;
  description: string;
  days: GeneratedProgramDay[];
  overall_rationale: string;
  source: 'ai' | 'rules';
}

export interface ProgramGenerationInput {
  goal: string;
  experience: 'beginner' | 'intermediate' | 'advanced';
  daysPerWeek: number;
  limitations: string[];
  availableMachines: Array<{
    id: string;
    name: string;
    target_muscles: string[];
    difficulty: string;
    equipment_type: string;
  }>;
}

// ─── Split Templates ──────────────────────────────────────

interface SplitTemplate {
  name: string;
  days: Array<{ name: string; muscleGroups: string[] }>;
}

function getSplitTemplate(daysPerWeek: number): SplitTemplate {
  if (daysPerWeek <= 2) {
    return {
      name: 'Full Body',
      days: Array.from({ length: daysPerWeek }, (_, i) => ({
        name: `Full Body ${String.fromCharCode(65 + i)}`,
        muscleGroups: ['chest', 'back', 'shoulders', 'legs', 'arms', 'core'],
      })),
    };
  }
  if (daysPerWeek === 3) {
    return {
      name: 'Push/Pull/Legs',
      days: [
        { name: 'Push (Chest, Shoulders, Triceps)', muscleGroups: ['chest', 'shoulders', 'triceps'] },
        { name: 'Pull (Back, Biceps)', muscleGroups: ['back', 'biceps', 'lats', 'rear delts'] },
        { name: 'Legs & Core', muscleGroups: ['quads', 'hamstrings', 'glutes', 'calves', 'core'] },
      ],
    };
  }
  if (daysPerWeek === 4) {
    return {
      name: 'Upper/Lower',
      days: [
        { name: 'Upper A', muscleGroups: ['chest', 'back', 'shoulders', 'arms'] },
        { name: 'Lower A', muscleGroups: ['quads', 'hamstrings', 'glutes', 'calves', 'core'] },
        { name: 'Upper B', muscleGroups: ['chest', 'back', 'shoulders', 'triceps', 'biceps'] },
        { name: 'Lower B', muscleGroups: ['quads', 'hamstrings', 'glutes', 'core'] },
      ],
    };
  }
  // 5-6 days
  return {
    name: 'Body Part Split',
    days: [
      { name: 'Chest & Triceps', muscleGroups: ['chest', 'triceps'] },
      { name: 'Back & Biceps', muscleGroups: ['back', 'biceps', 'lats'] },
      { name: 'Shoulders & Arms', muscleGroups: ['shoulders', 'biceps', 'triceps'] },
      { name: 'Legs', muscleGroups: ['quads', 'hamstrings', 'glutes', 'calves'] },
      { name: 'Core & Conditioning', muscleGroups: ['core', 'full body'] },
      ...(daysPerWeek >= 6
        ? [{ name: 'Full Body', muscleGroups: ['chest', 'back', 'legs', 'shoulders'] }]
        : []),
    ].slice(0, daysPerWeek),
  };
}

// ─── Rules-Based Generation ───────────────────────────────

function matchesMuscleGroup(
  machineTargets: string[],
  dayMuscles: string[],
): boolean {
  const lower = machineTargets.map((m) => m.toLowerCase());
  return dayMuscles.some((group) =>
    lower.some((t) => t.includes(group) || group.includes(t)),
  );
}

function rulesBasedProgram(input: ProgramGenerationInput): GeneratedProgram {
  const split = getSplitTemplate(input.daysPerWeek);
  const expSets = input.experience === 'beginner' ? 3 : input.experience === 'advanced' ? 4 : 3;
  const expReps = input.experience === 'beginner' ? 12 : input.experience === 'advanced' ? 8 : 10;
  const exercisesPerDay = input.experience === 'beginner' ? 4 : input.experience === 'advanced' ? 6 : 5;

  // Filter out machines matching limitations
  const limitLower = input.limitations.map((l) => l.toLowerCase());
  const filtered = input.availableMachines.filter((m) => {
    if (input.experience === 'beginner' && m.difficulty === 'advanced') return false;
    return !limitLower.some(
      (lim) =>
        m.target_muscles.some((t) => t.toLowerCase().includes(lim)) ||
        m.name.toLowerCase().includes(lim),
    );
  });

  const days: GeneratedProgramDay[] = split.days.map((dayTemplate, di) => {
    // Find machines that match this day's muscle groups
    const candidates = filtered.filter((m) =>
      matchesMuscleGroup(m.target_muscles, dayTemplate.muscleGroups),
    );

    // Pick top N, preferring variety
    const used = new Set<string>();
    const selected: GeneratedExercise[] = [];
    for (const machine of candidates) {
      if (selected.length >= exercisesPerDay) break;
      if (used.has(machine.id)) continue;
      used.add(machine.id);
      selected.push({
        exercise_name: machine.name,
        machine_id: machine.id,
        default_sets: expSets,
        default_reps: expReps,
      });
    }

    return {
      day_number: di + 1,
      name: dayTemplate.name,
      exercises: selected,
    };
  });

  return {
    name: `${split.name} — ${input.goal}`,
    description: `${input.daysPerWeek}-day ${split.name.toLowerCase()} program for ${input.experience} level. Goal: ${input.goal}.`,
    days,
    overall_rationale: `This ${split.name.toLowerCase()} split is well-suited for ${input.daysPerWeek} training days per week at the ${input.experience} level. Exercises are selected from available equipment, filtered for difficulty and any limitations.`,
    source: 'rules',
  };
}

// ─── Main Entry ───────────────────────────────────────────

export async function generateProgram(
  input: ProgramGenerationInput,
  llm?: LLMProvider,
): Promise<GeneratedProgram> {
  const fallback = rulesBasedProgram(input);

  if (llm?.enabled) {
    try {
      const result = await llm.generateProgram({
        goal: input.goal,
        experience: input.experience,
        daysPerWeek: input.daysPerWeek,
        limitations: input.limitations,
        availableMachines: input.availableMachines.map((m) => ({
          id: m.id,
          name: m.name,
          target_muscles: m.target_muscles,
        })),
      });

      if (result.days.length > 0) {
        return {
          ...result,
          source: 'ai',
        };
      }
    } catch {
      // Fall through to rules-based
    }
  }

  return fallback;
}

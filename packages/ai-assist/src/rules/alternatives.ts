/**
 * Machine Alternatives — "Machine Busy?" feature.
 * Deterministic similarity scoring to suggest 2–3 alternatives
 * from the same gym when a machine is occupied.
 *
 * Phase 2.5.4: movement equivalency map, tradeoff text,
 * limitation filtering, busy swap mode.
 */

import type {
  Machine,
  AlternativeResult,
  ExperienceLevel,
  MovementPattern,
  EquipmentType,
} from '@smartgym/types';

// ─── Scoring Constants ──────────────────────────────────

const SCORE_PRIMARY_MUSCLE_OVERLAP = 5;
const SCORE_MOVEMENT_MATCH = 3;
const SCORE_MOVEMENT_EQUIVALENCY = 2;
const SCORE_EQUIPMENT_MATCH = 2;
const SCORE_SECONDARY_MUSCLE_OVERLAP = 1;
const SCORE_BUSY_SWAP_DIFFERENT_EQUIPMENT = 1;
const PENALTY_DIFFICULTY_MISMATCH = -2;

const MAX_RESULTS = 3;

// Difficulty ordering for mismatch check
const DIFFICULTY_RANK: Record<string, number> = {
  beginner: 0,
  intermediate: 1,
  advanced: 2,
};

// ─── Movement Equivalency Map ───────────────────────────
// Cross-equipment pattern matching: squat↔hinge, carry↔core

const MOVEMENT_EQUIVALENCY: Record<MovementPattern, MovementPattern[]> = {
  push: ['push'],
  pull: ['pull'],
  squat: ['squat', 'hinge'],
  hinge: ['hinge', 'squat'],
  carry: ['carry', 'core'],
  core: ['core', 'carry'],
  isolation: ['isolation'],
  unknown: [],
};

// ─── Tradeoff Text Templates ────────────────────────────
// Deterministic templates for equipment transitions

const TRADEOFF_TEMPLATES: Record<string, string> = {
  'machine→cable': 'Cable version provides constant tension through the full range of motion.',
  'machine→dumbbell': 'Dumbbells engage more stabilizer muscles but require more coordination.',
  'machine→barbell': 'Barbell version allows heavier loads with bilateral movement.',
  'machine→bodyweight': 'Bodyweight version builds functional strength and core stability.',
  'machine→smith': 'Smith machine provides guided movement with some stabilization.',
  'cable→machine': 'Machine version is more stable, good for isolating the target muscle.',
  'cable→dumbbell': 'Dumbbells allow more natural movement arc and unilateral training.',
  'cable→barbell': 'Barbell allows heavier loads with a fixed movement path.',
  'dumbbell→machine': 'Machine version removes balance demands for focused muscle work.',
  'dumbbell→cable': 'Cable provides constant tension that dumbbells lack at certain angles.',
  'dumbbell→barbell': 'Barbell allows heavier bilateral loading.',
  'barbell→machine': 'Machine provides guided movement and built-in safety.',
  'barbell→dumbbell': 'Dumbbells address imbalances and increase stabilizer involvement.',
  'barbell→cable': 'Cable provides constant tension throughout the movement.',
  'bodyweight→machine': 'Machine version allows precise load progression.',
  'smith→machine': 'Machine provides full guidance without needing a spotter.',
  'smith→barbell': 'Free barbell requires more stabilization and engages more muscles.',
};

// ─── Limitation Body Area Mapping ───────────────────────

const LIMITATION_BODY_AREAS: Record<string, string[]> = {
  knee_sensitive: ['quadriceps', 'quads', 'hamstrings', 'glutes', 'calves'],
  shoulder_sensitive: ['front deltoids', 'rear deltoids', 'deltoids', 'shoulders'],
  back_sensitive: ['lats', 'rhomboids', 'traps', 'lower back', 'erectors'],
  wrist_sensitive: ['forearms'],
  neck_sensitive: ['traps', 'neck'],
};

// ─── Input ──────────────────────────────────────────────

export interface AlternativesInput {
  /** The machine the user is currently at */
  machine: Machine;
  /** All machines in the same gym */
  machinesInGym: Machine[];
  /** User experience level (for difficulty penalty) */
  experience?: ExperienceLevel;
  /** User limitations from training profile */
  limitations?: string[];
  /** When true, prefer different equipment type (user wants to avoid the busy one) */
  isBusySwap?: boolean;
}

// ─── Engine ─────────────────────────────────────────────

export function getMachineAlternatives(input: AlternativesInput): AlternativeResult[] {
  const {
    machine,
    machinesInGym,
    experience = 'intermediate',
    limitations = [],
    isBusySwap = false,
  } = input;

  let candidates = machinesInGym.filter((m) => m.id !== machine.id);

  if (candidates.length === 0) {
    return [];
  }

  // Filter out machines that hit limited body areas
  if (limitations.length > 0) {
    candidates = filterByLimitations(candidates, limitations);
  }

  if (candidates.length === 0) {
    return [];
  }

  // Use primary_muscles if available, fall back to target_muscles
  const sourcePrimary = machine.primary_muscles.length > 0
    ? machine.primary_muscles
    : machine.target_muscles;

  const sourceSecondary = machine.secondary_muscles;
  const sourceMovement = machine.movement_pattern;
  const sourceEquipment = machine.equipment_type;

  const scored: AlternativeResult[] = candidates.map((candidate) => {
    let score = 0;
    const reasons: string[] = [];

    const candidatePrimary = candidate.primary_muscles.length > 0
      ? candidate.primary_muscles
      : candidate.target_muscles;

    // Primary muscle overlap (+5 per overlap)
    const primaryOverlap = arrayOverlap(sourcePrimary, candidatePrimary);
    if (primaryOverlap > 0) {
      score += SCORE_PRIMARY_MUSCLE_OVERLAP * primaryOverlap;
      reasons.push(`Same primary muscle${primaryOverlap > 1 ? 's' : ''}`);
    }

    // Movement pattern match (+3 exact, +2 equivalent)
    if (sourceMovement !== 'unknown' && candidate.movement_pattern !== 'unknown') {
      if (sourceMovement === candidate.movement_pattern) {
        score += SCORE_MOVEMENT_MATCH;
        reasons.push('Same movement pattern');
      } else {
        const equivalents = MOVEMENT_EQUIVALENCY[sourceMovement] ?? [];
        if (equivalents.includes(candidate.movement_pattern)) {
          score += SCORE_MOVEMENT_EQUIVALENCY;
          reasons.push('Equivalent movement pattern');
        }
      }
    }

    // Equipment type match (+2)
    if (
      sourceEquipment !== 'unknown' &&
      candidate.equipment_type !== 'unknown' &&
      sourceEquipment === candidate.equipment_type
    ) {
      score += SCORE_EQUIPMENT_MATCH;
      reasons.push('Same equipment type');
    }

    // Busy swap: bonus for different equipment type
    if (
      isBusySwap &&
      sourceEquipment !== 'unknown' &&
      candidate.equipment_type !== 'unknown' &&
      sourceEquipment !== candidate.equipment_type
    ) {
      score += SCORE_BUSY_SWAP_DIFFERENT_EQUIPMENT;
      reasons.push('Different equipment (available)');
    }

    // Secondary muscle overlap (+1 per overlap)
    const secondaryOverlap = arrayOverlap(sourceSecondary, candidate.secondary_muscles);
    if (secondaryOverlap > 0) {
      score += SCORE_SECONDARY_MUSCLE_OVERLAP * secondaryOverlap;
    }

    // Difficulty penalty (-2 if much harder than user)
    const userRank = DIFFICULTY_RANK[experience] ?? 1;
    const candidateRank = DIFFICULTY_RANK[candidate.difficulty] ?? 1;
    if (candidateRank > userRank) {
      score += PENALTY_DIFFICULTY_MISMATCH;
      reasons.push('Higher difficulty');
    }

    // Generate tradeoff text for cross-equipment alternatives
    const tradeoff_text = generateTradeoffText(sourceEquipment, candidate.equipment_type);

    return { machine: candidate, score, reasons, tradeoff_text };
  });

  // Sort by score descending, tie-break by total muscle overlap
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    // Tie-break: total muscle overlap (primary + secondary)
    const overlapA = totalMuscleOverlap(machine, a.machine);
    const overlapB = totalMuscleOverlap(machine, b.machine);
    return overlapB - overlapA;
  });

  // Filter out zero/negative scores
  const filtered = scored.filter((r) => r.score > 0);

  if (filtered.length === 0 && scored.length > 0) {
    // Return the best candidate even if low score, with a note
    const best = scored[0];
    best.reasons.push('Limited alternatives available');
    return [best];
  }

  return filtered.slice(0, MAX_RESULTS);
}

// ─── Helpers ────────────────────────────────────────────

function filterByLimitations(candidates: Machine[], limitations: string[]): Machine[] {
  const riskyMuscles = new Set<string>();
  for (const limitation of limitations) {
    const areas = LIMITATION_BODY_AREAS[limitation];
    if (areas) {
      for (const area of areas) {
        riskyMuscles.add(area.toLowerCase());
      }
    }
  }

  if (riskyMuscles.size === 0) return candidates;

  return candidates.filter((m) => {
    const primary = m.primary_muscles.length > 0 ? m.primary_muscles : m.target_muscles;
    // Exclude machines whose primary muscles are all in the risky set
    const allPrimaryRisky = primary.length > 0 &&
      primary.every((muscle) => riskyMuscles.has(muscle.toLowerCase()));
    return !allPrimaryRisky;
  });
}

function generateTradeoffText(
  sourceEquipment: EquipmentType,
  candidateEquipment: EquipmentType,
): string | undefined {
  if (sourceEquipment === candidateEquipment) return undefined;
  if (sourceEquipment === 'unknown' || candidateEquipment === 'unknown') return undefined;

  const key = `${sourceEquipment}→${candidateEquipment}`;
  return TRADEOFF_TEMPLATES[key] ?? undefined;
}

function arrayOverlap(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const setB = new Set(b.map((s) => s.toLowerCase()));
  return a.filter((item) => setB.has(item.toLowerCase())).length;
}

function totalMuscleOverlap(source: Machine, candidate: Machine): number {
  const sp = source.primary_muscles.length > 0 ? source.primary_muscles : source.target_muscles;
  const cp = candidate.primary_muscles.length > 0 ? candidate.primary_muscles : candidate.target_muscles;
  return arrayOverlap(sp, cp) + arrayOverlap(source.secondary_muscles, candidate.secondary_muscles);
}

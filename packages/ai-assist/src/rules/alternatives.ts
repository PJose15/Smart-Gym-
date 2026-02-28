/**
 * Machine Alternatives — "Machine Busy?" feature.
 * Deterministic similarity scoring to suggest 2–3 alternatives
 * from the same gym when a machine is occupied.
 */

import type {
  Machine,
  AlternativeResult,
  ExperienceLevel,
} from '@smartgym/types';

// ─── Scoring Constants ──────────────────────────────────

const SCORE_PRIMARY_MUSCLE_OVERLAP = 5;
const SCORE_MOVEMENT_MATCH = 3;
const SCORE_EQUIPMENT_MATCH = 2;
const SCORE_SECONDARY_MUSCLE_OVERLAP = 1;
const PENALTY_DIFFICULTY_MISMATCH = -2;

const MAX_RESULTS = 3;

// Difficulty ordering for mismatch check
const DIFFICULTY_RANK: Record<string, number> = {
  beginner: 0,
  intermediate: 1,
  advanced: 2,
};

// ─── Input ──────────────────────────────────────────────

export interface AlternativesInput {
  /** The machine the user is currently at */
  machine: Machine;
  /** All machines in the same gym */
  machinesInGym: Machine[];
  /** User experience level (for difficulty penalty) */
  experience?: ExperienceLevel;
}

// ─── Engine ─────────────────────────────────────────────

export function getMachineAlternatives(input: AlternativesInput): AlternativeResult[] {
  const { machine, machinesInGym, experience = 'intermediate' } = input;

  const candidates = machinesInGym.filter((m) => m.id !== machine.id);

  if (candidates.length === 0) {
    return [];
  }

  // Use primary_muscles if available, fall back to target_muscles
  const sourcePrimary = machine.primary_muscles.length > 0
    ? machine.primary_muscles
    : machine.target_muscles;

  const sourceSecondary = machine.secondary_muscles;

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

    // Movement pattern match (+3)
    if (
      machine.movement_pattern !== 'unknown' &&
      candidate.movement_pattern !== 'unknown' &&
      machine.movement_pattern === candidate.movement_pattern
    ) {
      score += SCORE_MOVEMENT_MATCH;
      reasons.push('Same movement pattern');
    }

    // Equipment type match (+2)
    if (
      machine.equipment_type !== 'unknown' &&
      candidate.equipment_type !== 'unknown' &&
      machine.equipment_type === candidate.equipment_type
    ) {
      score += SCORE_EQUIPMENT_MATCH;
      reasons.push('Same equipment type');
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

    return { machine: candidate, score, reasons };
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

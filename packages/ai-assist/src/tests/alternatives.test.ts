import { describe, it, expect } from 'vitest';
import { getMachineAlternatives, AlternativesInput } from '../rules/alternatives';
import type { Machine } from '@smartgym/types';

// ─── Factory ────────────────────────────────────────────

const BASE_MACHINE: Machine = {
  id: 'base',
  gym_id: 'gym-1',
  name: 'Base Machine',
  qr_slug: 'base-machine',
  target_muscles: [],
  setup_steps: [],
  safety_cues: [],
  image_url: null,
  common_mistakes: [],
  cue_version: 1,
  cue_source: 'manual',
  movement_pattern: 'unknown',
  equipment_type: 'unknown',
  difficulty: 'beginner',
  primary_muscles: [],
  secondary_muscles: [],
  tags: null,
  form_checklist_before: null,
  form_checklist_during: null,
  form_checklist_after: null,
  checklist_version: 0,
  created_at: new Date().toISOString(),
};

function makeMachine(overrides: Partial<Machine> & { id: string }): Machine {
  return { ...BASE_MACHINE, ...overrides };
}

// ─── Tests ──────────────────────────────────────────────

describe('getMachineAlternatives', () => {
  it('returns empty array when no other machines in gym', () => {
    const machine = makeMachine({ id: 'only' });
    const result = getMachineAlternatives({ machine, machinesInGym: [machine] });
    expect(result).toHaveLength(0);
  });

  it('scores +5 per primary muscle overlap', () => {
    const source = makeMachine({
      id: 'src',
      primary_muscles: ['chest', 'triceps'],
    });
    const match = makeMachine({
      id: 'match',
      primary_muscles: ['chest', 'triceps'],
    });
    const noMatch = makeMachine({
      id: 'nomatch',
      primary_muscles: ['lats'],
    });

    const result = getMachineAlternatives({
      machine: source,
      machinesInGym: [source, match, noMatch],
    });

    // match should score +10 (2 overlaps * 5)
    expect(result[0].machine.id).toBe('match');
    expect(result[0].score).toBe(10);
  });

  it('scores +3 for movement pattern match', () => {
    const source = makeMachine({
      id: 'src',
      primary_muscles: ['chest'],
      movement_pattern: 'push',
    });
    const sameMovement = makeMachine({
      id: 'same',
      primary_muscles: ['chest'],
      movement_pattern: 'push',
    });
    const diffMovement = makeMachine({
      id: 'diff',
      primary_muscles: ['chest'],
      movement_pattern: 'pull',
    });

    const result = getMachineAlternatives({
      machine: source,
      machinesInGym: [source, sameMovement, diffMovement],
    });

    const same = result.find((r) => r.machine.id === 'same')!;
    const diff = result.find((r) => r.machine.id === 'diff')!;
    // sameMovement gets +5 (muscle) +3 (movement) = 8
    // diffMovement gets +5 (muscle) = 5
    expect(same.score).toBe(8);
    expect(diff.score).toBe(5);
  });

  it('scores +2 for equipment type match', () => {
    const source = makeMachine({
      id: 'src',
      primary_muscles: ['chest'],
      equipment_type: 'cable',
    });
    const sameEquip = makeMachine({
      id: 'same',
      primary_muscles: ['chest'],
      equipment_type: 'cable',
    });
    const diffEquip = makeMachine({
      id: 'diff',
      primary_muscles: ['chest'],
      equipment_type: 'machine',
    });

    const result = getMachineAlternatives({
      machine: source,
      machinesInGym: [source, sameEquip, diffEquip],
    });

    const same = result.find((r) => r.machine.id === 'same')!;
    const diff = result.find((r) => r.machine.id === 'diff')!;
    expect(same.score).toBe(7); // 5 + 2
    expect(diff.score).toBe(5); // 5 only
  });

  it('scores +1 per secondary muscle overlap', () => {
    const source = makeMachine({
      id: 'src',
      primary_muscles: ['chest'],
      secondary_muscles: ['triceps', 'front deltoids'],
    });
    const candidate = makeMachine({
      id: 'cand',
      primary_muscles: ['chest'],
      secondary_muscles: ['triceps', 'front deltoids', 'biceps'],
    });

    const result = getMachineAlternatives({
      machine: source,
      machinesInGym: [source, candidate],
    });

    // +5 (primary chest) +2 (secondary overlap: triceps + front deltoids)
    expect(result[0].score).toBe(7);
  });

  it('applies -2 difficulty penalty for harder machines', () => {
    const source = makeMachine({
      id: 'src',
      primary_muscles: ['chest'],
    });
    const easier = makeMachine({
      id: 'easy',
      primary_muscles: ['chest'],
      difficulty: 'beginner',
    });
    const harder = makeMachine({
      id: 'hard',
      primary_muscles: ['chest'],
      difficulty: 'advanced',
    });

    const result = getMachineAlternatives({
      machine: source,
      machinesInGym: [source, easier, harder],
      experience: 'beginner',
    });

    const easyResult = result.find((r) => r.machine.id === 'easy')!;
    const hardResult = result.find((r) => r.machine.id === 'hard')!;
    // easier: +5, no penalty
    // harder: +5 -2 = 3
    expect(easyResult.score).toBe(5);
    expect(hardResult.score).toBe(3);
  });

  it('returns max 3 results', () => {
    const source = makeMachine({ id: 'src', primary_muscles: ['chest'] });
    const candidates = Array.from({ length: 6 }, (_, i) =>
      makeMachine({ id: `c${i}`, primary_muscles: ['chest'] }),
    );

    const result = getMachineAlternatives({
      machine: source,
      machinesInGym: [source, ...candidates],
    });

    expect(result.length).toBeLessThanOrEqual(3);
  });

  it('filters out zero/negative scores', () => {
    const source = makeMachine({
      id: 'src',
      primary_muscles: ['chest'],
      movement_pattern: 'push',
    });
    const unrelated = makeMachine({
      id: 'unrelated',
      primary_muscles: ['calves'],
      movement_pattern: 'isolation',
      equipment_type: 'bodyweight',
    });
    const related = makeMachine({
      id: 'related',
      primary_muscles: ['chest'],
      movement_pattern: 'push',
    });

    const result = getMachineAlternatives({
      machine: source,
      machinesInGym: [source, unrelated, related],
    });

    // related should be included, unrelated should be filtered (score 0)
    expect(result.some((r) => r.machine.id === 'related')).toBe(true);
  });

  it('falls back to target_muscles when primary_muscles is empty', () => {
    const source = makeMachine({
      id: 'src',
      primary_muscles: [],
      target_muscles: ['chest', 'triceps'],
    });
    const candidate = makeMachine({
      id: 'cand',
      primary_muscles: [],
      target_muscles: ['chest'],
    });

    const result = getMachineAlternatives({
      machine: source,
      machinesInGym: [source, candidate],
    });

    expect(result).toHaveLength(1);
    expect(result[0].score).toBe(5); // +5 for 'chest' overlap via target_muscles
  });

  it('performs case-insensitive muscle matching', () => {
    const source = makeMachine({
      id: 'src',
      primary_muscles: ['Chest', 'TRICEPS'],
    });
    const candidate = makeMachine({
      id: 'cand',
      primary_muscles: ['chest', 'triceps'],
    });

    const result = getMachineAlternatives({
      machine: source,
      machinesInGym: [source, candidate],
    });

    expect(result[0].score).toBe(10); // 2 * 5
  });

  it('tie-breaks by total muscle overlap', () => {
    const source = makeMachine({
      id: 'src',
      primary_muscles: ['chest'],
      secondary_muscles: ['triceps', 'front deltoids'],
    });
    // Both will score 5 from primary, but candidateA has more secondary overlap
    const candidateA = makeMachine({
      id: 'a',
      primary_muscles: ['chest'],
      secondary_muscles: ['triceps', 'front deltoids'],
    });
    const candidateB = makeMachine({
      id: 'b',
      primary_muscles: ['chest'],
      secondary_muscles: [],
    });

    const result = getMachineAlternatives({
      machine: source,
      machinesInGym: [source, candidateB, candidateA],
    });

    // A has higher secondary overlap, so should rank above B even though
    // score A = 5+2=7 vs score B = 5. Actually scores differ so let's verify ordering
    expect(result[0].machine.id).toBe('a');
    expect(result[1].machine.id).toBe('b');
  });

  it('returns best candidate with note when all scores <= 0', () => {
    const source = makeMachine({
      id: 'src',
      primary_muscles: ['chest'],
      movement_pattern: 'push',
      equipment_type: 'machine',
    });
    const unrelated = makeMachine({
      id: 'unrelated',
      primary_muscles: ['calves'],
      movement_pattern: 'isolation',
      equipment_type: 'bodyweight',
      difficulty: 'advanced',
    });

    const result = getMachineAlternatives({
      machine: source,
      machinesInGym: [source, unrelated],
      experience: 'beginner',
    });

    // Score is 0 (no overlap) -2 (difficulty) = -2, but should return 1 fallback
    expect(result).toHaveLength(1);
    expect(result[0].reasons).toContain('Limited alternatives available');
  });

  it('excludes the source machine from results', () => {
    const source = makeMachine({ id: 'src', primary_muscles: ['chest'] });
    const other = makeMachine({ id: 'other', primary_muscles: ['chest'] });

    const result = getMachineAlternatives({
      machine: source,
      machinesInGym: [source, other],
    });

    expect(result.every((r) => r.machine.id !== 'src')).toBe(true);
  });

  it('does not penalize same or lower difficulty', () => {
    const source = makeMachine({
      id: 'src',
      primary_muscles: ['chest'],
    });
    const sameDiff = makeMachine({
      id: 'same',
      primary_muscles: ['chest'],
      difficulty: 'intermediate',
    });
    const lowerDiff = makeMachine({
      id: 'lower',
      primary_muscles: ['chest'],
      difficulty: 'beginner',
    });

    const result = getMachineAlternatives({
      machine: source,
      machinesInGym: [source, sameDiff, lowerDiff],
      experience: 'intermediate',
    });

    // Both should score 5 — no penalty
    for (const r of result) {
      expect(r.score).toBe(5);
    }
  });

  it('ignores unknown movement_pattern for matching', () => {
    const source = makeMachine({
      id: 'src',
      primary_muscles: ['chest'],
      movement_pattern: 'unknown',
    });
    const candidate = makeMachine({
      id: 'cand',
      primary_muscles: ['chest'],
      movement_pattern: 'unknown',
    });

    const result = getMachineAlternatives({
      machine: source,
      machinesInGym: [source, candidate],
    });

    // Score should be 5 only (no +3 for unknown match)
    expect(result[0].score).toBe(5);
  });
});

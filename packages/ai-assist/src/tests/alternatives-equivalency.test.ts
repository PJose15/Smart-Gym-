import { describe, it, expect } from 'vitest';
import { getMachineAlternatives } from '../rules/alternatives';
import type { Machine } from '@nexera/types';

function makeMachine(overrides: Partial<Machine> & { id: string; name: string }): Machine {
  return {
    gym_id: 'gym-1',
    qr_slug: `slug-${overrides.id}`,
    target_muscles: [],
    setup_steps: [],
    safety_cues: [],
    image_url: null,
    common_mistakes: [],
    cue_version: 1,
    cue_source: 'manual',
    movement_pattern: 'unknown',
    equipment_type: 'unknown',
    difficulty: 'intermediate',
    primary_muscles: [],
    secondary_muscles: [],
    tags: null,
    form_checklist_before: null,
    form_checklist_during: null,
    form_checklist_after: null,
    checklist_version: 1,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

describe('Movement Pattern Equivalency', () => {
  it('gives +2 for squat↔hinge equivalency', () => {
    const source = makeMachine({
      id: '1', name: 'Leg Press',
      movement_pattern: 'squat', equipment_type: 'machine',
      primary_muscles: ['quadriceps'],
    });
    const candidate = makeMachine({
      id: '2', name: 'Romanian Deadlift',
      movement_pattern: 'hinge', equipment_type: 'barbell',
      primary_muscles: ['quadriceps'],
    });

    const results = getMachineAlternatives({
      machine: source,
      machinesInGym: [source, candidate],
    });

    expect(results).toHaveLength(1);
    // Score: 5 (primary) + 2 (equivalent movement) = 7
    expect(results[0].score).toBe(7);
    expect(results[0].reasons).toContain('Equivalent movement pattern');
  });

  it('gives +3 for exact movement match (not equivalency)', () => {
    const source = makeMachine({
      id: '1', name: 'Chest Press',
      movement_pattern: 'push', equipment_type: 'machine',
      primary_muscles: ['chest'],
    });
    const candidate = makeMachine({
      id: '2', name: 'Incline Press',
      movement_pattern: 'push', equipment_type: 'barbell',
      primary_muscles: ['chest'],
    });

    const results = getMachineAlternatives({
      machine: source,
      machinesInGym: [source, candidate],
    });

    expect(results[0].score).toBe(8); // 5 + 3
    expect(results[0].reasons).toContain('Same movement pattern');
    expect(results[0].reasons).not.toContain('Equivalent movement pattern');
  });

  it('gives +2 for carry↔core equivalency', () => {
    const source = makeMachine({
      id: '1', name: 'Farmer Walk',
      movement_pattern: 'carry', equipment_type: 'dumbbell',
      primary_muscles: ['core'],
    });
    const candidate = makeMachine({
      id: '2', name: 'Plank Station',
      movement_pattern: 'core', equipment_type: 'bodyweight',
      primary_muscles: ['core'],
    });

    const results = getMachineAlternatives({
      machine: source,
      machinesInGym: [source, candidate],
    });

    expect(results[0].reasons).toContain('Equivalent movement pattern');
  });

  it('no equivalency bonus for push vs pull', () => {
    const source = makeMachine({
      id: '1', name: 'Bench Press',
      movement_pattern: 'push', equipment_type: 'barbell',
      primary_muscles: ['chest'],
    });
    const candidate = makeMachine({
      id: '2', name: 'Row Machine',
      movement_pattern: 'pull', equipment_type: 'machine',
      primary_muscles: ['chest'], // same primary for simplicity
    });

    const results = getMachineAlternatives({
      machine: source,
      machinesInGym: [source, candidate],
    });

    expect(results[0].reasons).not.toContain('Same movement pattern');
    expect(results[0].reasons).not.toContain('Equivalent movement pattern');
  });
});

describe('Tradeoff Text', () => {
  it('generates tradeoff text for machine→dumbbell transition', () => {
    const source = makeMachine({
      id: '1', name: 'Chest Press Machine',
      movement_pattern: 'push', equipment_type: 'machine',
      primary_muscles: ['chest'],
    });
    const candidate = makeMachine({
      id: '2', name: 'Dumbbell Press',
      movement_pattern: 'push', equipment_type: 'dumbbell',
      primary_muscles: ['chest'],
    });

    const results = getMachineAlternatives({
      machine: source,
      machinesInGym: [source, candidate],
    });

    expect(results[0].tradeoff_text).toBeDefined();
    expect(results[0].tradeoff_text).toContain('stabilizer');
  });

  it('no tradeoff text for same equipment type', () => {
    const source = makeMachine({
      id: '1', name: 'Chest Press A',
      equipment_type: 'machine', movement_pattern: 'push',
      primary_muscles: ['chest'],
    });
    const candidate = makeMachine({
      id: '2', name: 'Chest Press B',
      equipment_type: 'machine', movement_pattern: 'push',
      primary_muscles: ['chest'],
    });

    const results = getMachineAlternatives({
      machine: source,
      machinesInGym: [source, candidate],
    });

    expect(results[0].tradeoff_text).toBeUndefined();
  });
});

describe('Limitation Filtering', () => {
  it('filters out machines whose primary muscles all match limited body areas', () => {
    const source = makeMachine({
      id: '1', name: 'Chest Press',
      movement_pattern: 'push', equipment_type: 'machine',
      primary_muscles: ['chest'],
    });
    const legMachine = makeMachine({
      id: '2', name: 'Leg Extension',
      movement_pattern: 'isolation', equipment_type: 'machine',
      primary_muscles: ['quadriceps', 'hamstrings'],
    });
    const chestAlt = makeMachine({
      id: '3', name: 'Dumbbell Press',
      movement_pattern: 'push', equipment_type: 'dumbbell',
      primary_muscles: ['chest'],
    });

    const results = getMachineAlternatives({
      machine: source,
      machinesInGym: [source, legMachine, chestAlt],
      limitations: ['knee_sensitive'], // filters leg machines
    });

    // legMachine should be filtered out (quadriceps + hamstrings are knee-related)
    const machineNames = results.map((r) => r.machine.name);
    expect(machineNames).toContain('Dumbbell Press');
    expect(machineNames).not.toContain('Leg Extension');
  });

  it('keeps machines with mixed primary muscles (not all limited)', () => {
    const source = makeMachine({
      id: '1', name: 'Machine A',
      primary_muscles: ['chest'],
    });
    const mixed = makeMachine({
      id: '2', name: 'Mixed Machine',
      primary_muscles: ['chest', 'quadriceps'], // only quad is knee-related, chest is not
    });

    const results = getMachineAlternatives({
      machine: source,
      machinesInGym: [source, mixed],
      limitations: ['knee_sensitive'],
    });

    // mixed is kept because not ALL primary muscles are in the limited set
    expect(results).toHaveLength(1);
    expect(results[0].machine.name).toBe('Mixed Machine');
  });
});

describe('Busy Swap Mode', () => {
  it('gives +1 bonus for different equipment type in busy swap mode', () => {
    const source = makeMachine({
      id: '1', name: 'Cable Fly',
      movement_pattern: 'push', equipment_type: 'cable',
      primary_muscles: ['chest'],
    });
    const sameEquip = makeMachine({
      id: '2', name: 'Cable Press',
      movement_pattern: 'push', equipment_type: 'cable',
      primary_muscles: ['chest'],
    });
    const diffEquip = makeMachine({
      id: '3', name: 'Dumbbell Fly',
      movement_pattern: 'push', equipment_type: 'dumbbell',
      primary_muscles: ['chest'],
    });

    // Without busy swap
    const normal = getMachineAlternatives({
      machine: source,
      machinesInGym: [source, sameEquip, diffEquip],
      isBusySwap: false,
    });

    // With busy swap
    const busy = getMachineAlternatives({
      machine: source,
      machinesInGym: [source, sameEquip, diffEquip],
      isBusySwap: true,
    });

    // In busy mode, diffEquip gets +1 bonus
    const diffEquipBusy = busy.find((r) => r.machine.id === '3')!;
    const diffEquipNormal = normal.find((r) => r.machine.id === '3')!;
    expect(diffEquipBusy.score).toBe(diffEquipNormal.score + 1);
    expect(diffEquipBusy.reasons).toContain('Different equipment (available)');
  });
});

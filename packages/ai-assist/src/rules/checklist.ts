/**
 * Form Checklist — deterministic before/during/finish cues per machine.
 * Uses machine-stored checklists when available, falls back to
 * generated checklists based on movement_pattern + equipment_type.
 */

import type {
  Machine,
  FormChecklist,
  MovementPattern,
  EquipmentType,
} from '@smartgym/types';

// ─── Template Banks ─────────────────────────────────────

const BEFORE_BY_PATTERN: Record<MovementPattern, string[]> = {
  push: ['Retract shoulder blades', 'Brace core', 'Grip firmly'],
  pull: ['Depress shoulders', 'Engage lats', 'Neutral wrist position'],
  squat: ['Feet shoulder-width apart', 'Brace core tightly', 'Chest up'],
  hinge: ['Soft knee bend', 'Flat back — neutral spine', 'Hinge at hips'],
  carry: ['Shoulders packed down', 'Core braced', 'Even grip'],
  core: ['Neutral spine', 'Engage pelvic floor', 'Breathe steadily'],
  isolation: ['Seat adjusted to fit', 'Light warm-up set first', 'Focus on target muscle'],
  unknown: ['Check seat/pad adjustment', 'Start with light weight', 'Confirm range of motion'],
};

const DURING_BY_PATTERN: Record<MovementPattern, string[]> = {
  push: ['Shoulders down — not shrugged', 'Control the eccentric', 'Full range of motion'],
  pull: ['Squeeze at the bottom', 'Control the return', 'No momentum swinging'],
  squat: ['Knees track over toes', 'Depth to parallel or below', 'Drive through heels'],
  hinge: ['Hips back first', 'Bar close to body', 'Squeeze glutes at top'],
  carry: ['Walk with controlled steps', 'Breathe steadily', 'No leaning to one side'],
  core: ['No neck strain', 'Breathe through the movement', 'Control each rep'],
  isolation: ['Slow and controlled', 'Feel the target muscle working', 'No compensating with other muscles'],
  unknown: ['Controlled tempo', 'Breathe steadily', 'Stay within pain-free range'],
};

const AFTER_BY_PATTERN: Record<MovementPattern, string[]> = {
  push: ['Rack weight safely', 'Stretch chest and shoulders', 'Note any discomfort'],
  pull: ['Lower weight stack gently', 'Stretch lats', 'Check grip fatigue'],
  squat: ['Re-rack bar carefully', 'Walk it off', 'Stretch hip flexors'],
  hinge: ['Lower weight to floor controlled', 'Stretch hamstrings', 'Assess lower back feel'],
  carry: ['Set weight down — don\'t drop', 'Shake out grip', 'Check for imbalance'],
  core: ['Relax and breathe', 'Gentle stretch', 'Note any lower back tightness'],
  isolation: ['Return to start position', 'Stretch target muscle', 'Wipe down equipment'],
  unknown: ['Return weight safely', 'Light stretch', 'Note how it felt'],
};

// Additional cues by equipment
const BEFORE_BY_EQUIPMENT: Partial<Record<EquipmentType, string[]>> = {
  machine: ['Check pin is secure in weight stack'],
  cable: ['Confirm cable is smooth — no fraying'],
  barbell: ['Check clips are secure'],
  smith: ['Verify safety catches are set'],
  dumbbell: ['Verify you have matching weights'],
};

// ─── Engine ─────────────────────────────────────────────

export interface ChecklistInput {
  machine: Machine;
}

export function getFormChecklist(input: ChecklistInput): FormChecklist {
  const { machine } = input;

  // Use stored checklists if present and non-empty
  if (
    machine.form_checklist_before?.length &&
    machine.form_checklist_during?.length &&
    machine.form_checklist_after?.length
  ) {
    return {
      before: machine.form_checklist_before,
      during: machine.form_checklist_during,
      after: machine.form_checklist_after,
    };
  }

  const pattern = machine.movement_pattern || 'unknown';
  const equipment = machine.equipment_type || 'machine';

  // Build before checklist
  const before = [...(BEFORE_BY_PATTERN[pattern] ?? BEFORE_BY_PATTERN.unknown)];
  const equipBefore = BEFORE_BY_EQUIPMENT[equipment];
  if (equipBefore) {
    before.unshift(...equipBefore);
  }

  // Incorporate setup_steps if present (first 2 max)
  if (machine.setup_steps.length > 0) {
    const setupCues = machine.setup_steps.slice(0, 2);
    for (const cue of setupCues) {
      if (!before.some((b) => b.toLowerCase() === cue.toLowerCase())) {
        before.unshift(cue);
      }
    }
  }

  // Build during checklist
  const during = [...(DURING_BY_PATTERN[pattern] ?? DURING_BY_PATTERN.unknown)];

  // Incorporate safety_cues if present (first 2 max)
  if (machine.safety_cues.length > 0) {
    const safetyCues = machine.safety_cues.slice(0, 2);
    for (const cue of safetyCues) {
      if (!during.some((d) => d.toLowerCase() === cue.toLowerCase())) {
        during.push(cue);
      }
    }
  }

  // Build after checklist
  const after = [...(AFTER_BY_PATTERN[pattern] ?? AFTER_BY_PATTERN.unknown)];

  return { before, during, after };
}

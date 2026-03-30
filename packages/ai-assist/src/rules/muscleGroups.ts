import type { MuscleGroupInfo, MuscleGroupKey, MachineMuscleMappings } from '@nexera/types';

// ============================================================================
// 16+1 Muscle Groups (calves = 17, but front/back body mapping = 16 visible)
// ============================================================================

export const MUSCLE_GROUPS: MuscleGroupInfo[] = [
  // ── Front Body ──
  { key: 'chest',       label: 'Chest',        side: 'front', recoveryBaseHours: 48 },
  { key: 'front_delts', label: 'Front Delts',  side: 'front', recoveryBaseHours: 36 },
  { key: 'side_delts',  label: 'Side Delts',   side: 'front', recoveryBaseHours: 36 },
  { key: 'biceps',      label: 'Biceps',       side: 'front', recoveryBaseHours: 36 },
  { key: 'forearms',    label: 'Forearms',     side: 'front', recoveryBaseHours: 24 },
  { key: 'abs',         label: 'Abs',          side: 'front', recoveryBaseHours: 24 },
  { key: 'obliques',    label: 'Obliques',     side: 'front', recoveryBaseHours: 24 },
  { key: 'quads',       label: 'Quads',        side: 'front', recoveryBaseHours: 48 },
  { key: 'hip_flexors', label: 'Hip Flexors',  side: 'front', recoveryBaseHours: 36 },
  // ── Back Body ──
  { key: 'rear_delts',  label: 'Rear Delts',   side: 'back',  recoveryBaseHours: 36 },
  { key: 'triceps',     label: 'Triceps',      side: 'back',  recoveryBaseHours: 36 },
  { key: 'upper_back',  label: 'Upper Back',   side: 'back',  recoveryBaseHours: 48 },
  { key: 'lats',        label: 'Lats',         side: 'back',  recoveryBaseHours: 48 },
  { key: 'lower_back',  label: 'Lower Back',   side: 'back',  recoveryBaseHours: 48 },
  { key: 'glutes',      label: 'Glutes',       side: 'back',  recoveryBaseHours: 48 },
  { key: 'hamstrings',  label: 'Hamstrings',   side: 'back',  recoveryBaseHours: 48 },
  { key: 'calves',      label: 'Calves',       side: 'back',  recoveryBaseHours: 24 },
];

export const MUSCLE_GROUP_MAP: Record<MuscleGroupKey, MuscleGroupInfo> =
  Object.fromEntries(MUSCLE_GROUPS.map(g => [g.key, g])) as Record<MuscleGroupKey, MuscleGroupInfo>;

// ============================================================================
// Machine → Muscle Mappings (~25 common gym machines)
// ============================================================================

export const MACHINE_MUSCLE_MAP: Record<string, MachineMuscleMappings> = {
  'bench press':           { primary: ['chest'],       secondary: ['front_delts', 'triceps'] },
  'incline bench press':   { primary: ['chest'],       secondary: ['front_delts', 'triceps'] },
  'decline bench press':   { primary: ['chest'],       secondary: ['triceps'] },
  'chest fly':             { primary: ['chest'],       secondary: ['front_delts'] },
  'pec deck':              { primary: ['chest'],       secondary: ['front_delts'] },
  'cable crossover':       { primary: ['chest'],       secondary: ['front_delts'] },
  'overhead press':        { primary: ['front_delts'], secondary: ['side_delts', 'triceps'] },
  'shoulder press':        { primary: ['front_delts', 'side_delts'], secondary: ['triceps'] },
  'lateral raise':         { primary: ['side_delts'],  secondary: ['front_delts'] },
  'face pull':             { primary: ['rear_delts'],  secondary: ['upper_back'] },
  'reverse fly':           { primary: ['rear_delts'],  secondary: ['upper_back'] },
  'bicep curl':            { primary: ['biceps'],      secondary: ['forearms'] },
  'preacher curl':         { primary: ['biceps'],      secondary: ['forearms'] },
  'hammer curl':           { primary: ['biceps'],      secondary: ['forearms'] },
  'tricep pushdown':       { primary: ['triceps'],     secondary: [] },
  'tricep extension':      { primary: ['triceps'],     secondary: [] },
  'lat pulldown':          { primary: ['lats'],        secondary: ['biceps', 'upper_back'] },
  'seated row':            { primary: ['upper_back'],  secondary: ['lats', 'biceps'] },
  'cable row':             { primary: ['upper_back'],  secondary: ['lats', 'biceps'] },
  'back extension':        { primary: ['lower_back'],  secondary: ['glutes'] },
  'deadlift':              { primary: ['lower_back', 'glutes', 'hamstrings'], secondary: ['upper_back', 'forearms'] },
  'squat':                 { primary: ['quads', 'glutes'], secondary: ['hamstrings', 'lower_back'] },
  'leg press':             { primary: ['quads'],       secondary: ['glutes', 'hamstrings'] },
  'leg extension':         { primary: ['quads'],       secondary: [] },
  'leg curl':              { primary: ['hamstrings'],  secondary: ['calves'] },
  'hip thrust':            { primary: ['glutes'],      secondary: ['hamstrings'] },
  'calf raise':            { primary: ['calves'],      secondary: [] },
  'ab crunch machine':     { primary: ['abs'],         secondary: ['obliques'] },
  'cable woodchop':        { primary: ['obliques'],    secondary: ['abs'] },
  'plank':                 { primary: ['abs'],         secondary: ['obliques', 'lower_back'] },
  'hip adductor':          { primary: ['hip_flexors'], secondary: ['quads'] },
  'hip abductor':          { primary: ['glutes'],      secondary: ['hip_flexors'] },
};

// ============================================================================
// Machine Name Normalization
// ============================================================================

export function normalizeMachineName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Look up which muscles a machine targets.
 * Falls back to empty arrays if machine is unknown.
 */
export function getMachineMuscleMappings(machineName: string): MachineMuscleMappings {
  const normalized = normalizeMachineName(machineName);

  // Exact match first
  if (MACHINE_MUSCLE_MAP[normalized]) {
    return MACHINE_MUSCLE_MAP[normalized];
  }

  // Partial match: find a key that is contained in the normalized name
  for (const [key, mapping] of Object.entries(MACHINE_MUSCLE_MAP)) {
    if (normalized.includes(key)) {
      return mapping;
    }
  }

  return { primary: [], secondary: [] };
}

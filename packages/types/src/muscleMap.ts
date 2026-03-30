// ============================================================================
// Phase 8.2 — Muscle Map Types (DOC_24)
// ============================================================================

export type MuscleGroupKey =
  | 'chest'
  | 'front_delts'
  | 'side_delts'
  | 'rear_delts'
  | 'biceps'
  | 'triceps'
  | 'forearms'
  | 'abs'
  | 'obliques'
  | 'quads'
  | 'hip_flexors'
  | 'upper_back'
  | 'lats'
  | 'lower_back'
  | 'glutes'
  | 'hamstrings'
  | 'calves';

export type MuscleRecoveryStateLabel = 'fresh' | 'primed' | 'recovering' | 'fatigued';

export type BodySide = 'front' | 'back';

export interface MuscleGroupInfo {
  key: MuscleGroupKey;
  label: string;
  side: BodySide;
  recoveryBaseHours: number;
}

export interface MachineMuscleMappings {
  primary: MuscleGroupKey[];
  secondary: MuscleGroupKey[];
}

export interface MuscleRecoveryState {
  key: MuscleGroupKey;
  label: string;
  state: MuscleRecoveryStateLabel;
  hoursSinceTraining: number | null;
  recoveryPct: number;
  lastTrainedAt: string | null;
  color: string;
}

export interface MuscleMapRecommendations {
  readyToTrain: MuscleGroupKey[];
  needsRecovery: MuscleGroupKey[];
  suggestedFocus: MuscleGroupKey[];
  message: string;
}

export interface MuscleMapResult {
  memberId: string;
  computedAt: string;
  states: Record<MuscleGroupKey, MuscleRecoveryState>;
  recommendations: MuscleMapRecommendations;
  balanceScore: number;
}

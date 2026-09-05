// ============================================================================
// Phase 8.5 — Performance DNA Types (DOC_27)
// ============================================================================

/** The five DNA dimensions */
export type DNADimension = 'power' | 'consistency' | 'progression' | 'balance' | 'mindset';

/** Scores for all five dimensions, each 0-100 */
export interface DNAScores {
  power: number;
  consistency: number;
  progression: number;
  balance: number;
  mindset: number;
}

/** Result from a single dimension calculator */
export interface DNADimensionScore {
  score: number;
  is_building: boolean;
  signals: Record<string, number | string | null>;
}

/** Archetype identity */
export interface DNAArchetype {
  id: string;
  name: string;
  description: string;
  color: string;
  icon: string;
  coaching_focus: string;
}

/** A weekly DNA snapshot for history chart */
export interface DNASnapshot {
  date: string;
  scores: DNAScores;
}

/** Full DNA result returned by the compute pipeline */
export interface DNAResult {
  scores: DNAScores;
  previous_scores: DNAScores | null;
  archetype: DNAArchetype;
  previous_archetype: DNAArchetype | null;
  archetype_changed: boolean;
  is_building: boolean;
  sessions_logged: number;
  distinct_machines: number;
  signals: Record<DNADimension, Record<string, number | string | null>>;
  history: DNASnapshot[];
  computed_at: string;
}

/** Inputs gathered from DB for DNA computation */
export interface DNASignals {
  // Power signals
  recentSessions: Array<{
    machine_id: string | null;
    best_weight_lbs: number;
    total_volume_lbs: number;
    /** True only when the session actually set a personal best */
    is_personal_best?: boolean;
  }>;
  olderSessions: Array<{
    machine_id: string | null;
    best_weight_lbs: number;
  }>;

  // Consistency signals
  sessionDatesLast30: string[];
  currentStreak: number;
  bestStreak: number;
  readinessEntries: Array<{ score: number; zone: string }>;

  // Progression signals
  allSessions60d: Array<{
    machine_id: string | null;
    session_date: string;
    best_weight_lbs: number;
    total_volume_lbs: number;
  }>;
  programs: Array<{
    sessions_completed: number;
    sessions_total: number;
  }>;
  goals: Array<{
    is_achieved: boolean;
  }>;

  // Balance — uses existing calculateBalanceScore
  balanceScore: number;

  // Mindset signals
  allSets: Array<{ rpe: number | null }>;
  checkIns: Array<{ member_replied: boolean }>;
  goalsSet: number;
  goalsAchieved: number;
  reactionCount: number;
  shareCount: number;

  // Meta
  totalSessionCount: number;
  distinctMachineCount: number;
}

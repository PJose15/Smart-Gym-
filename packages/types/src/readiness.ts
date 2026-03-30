// ============================================================================
// Phase 8.1 — Training Readiness Score Types (DOC_23)
// ============================================================================

export type ReadinessZone = 'peak' | 'ready' | 'moderate' | 'rest';

export interface ReadinessInputs {
  sessionCountLast3Days: number;
  lastSessionRPEAverage: number | null;
  daysSinceLastSession: number;
  currentStreak: number;
  volumeTrend: 'increasing' | 'stable' | 'decreasing' | 'insufficient';
}

export interface ReadinessSignalBreakdown {
  session_count: number;
  rpe: number;
  rest_days: number;
  streak: number;
  volume_trend: number;
}

export interface ReadinessResult {
  score: number;
  zone: ReadinessZone;
  color: string;
  headline: string;
  subline: string;
  dominant_signal: string;
  signals: ReadinessSignalBreakdown;
}

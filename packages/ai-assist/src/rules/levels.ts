// ─── Level Computation Module ──────────────────────────
// Pure function — maps SmartGym Score to 10 levels.

export interface LevelInfo {
  level: number;
  name: string;
  minScore: number;
  maxScore: number; // Infinity for Legend
  color: string;
}

export interface LevelProgress {
  current: LevelInfo;
  next: LevelInfo | null;
  score: number;
  progressPct: number; // 0-100 within current level
  pointsToNext: number; // 0 if Legend
}

const LEVELS: LevelInfo[] = [
  { level: 1,  name: 'Newcomer',    minScore: 0,     maxScore: 100,    color: '#9CA3AF' },
  { level: 2,  name: 'Regular',     minScore: 100,   maxScore: 300,    color: '#6EE7B7' },
  { level: 3,  name: 'Dedicated',   minScore: 300,   maxScore: 600,    color: '#34D399' },
  { level: 4,  name: 'Committed',   minScore: 600,   maxScore: 1000,   color: '#60A5FA' },
  { level: 5,  name: 'Warrior',     minScore: 1000,  maxScore: 1800,   color: '#818CF8' },
  { level: 6,  name: 'Veteran',     minScore: 1800,  maxScore: 3000,   color: '#A78BFA' },
  { level: 7,  name: 'Elite',       minScore: 3000,  maxScore: 5000,   color: '#F59E0B' },
  { level: 8,  name: 'Champion',    minScore: 5000,  maxScore: 7500,   color: '#F97316' },
  { level: 9,  name: 'Master',      minScore: 7500,  maxScore: 10000,  color: '#EF4444' },
  { level: 10, name: 'Legend',       minScore: 10000, maxScore: Infinity, color: '#EC4899' },
];

/**
 * Returns the LevelInfo for a given SmartGym score.
 * Scores below 0 or NaN are treated as 0.
 */
export function computeLevel(score: number): LevelInfo {
  const s = Math.max(0, Number.isFinite(score) ? score : 0);
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (s >= LEVELS[i].minScore) {
      return LEVELS[i];
    }
  }
  return LEVELS[0];
}

/**
 * Returns full progress info: current level, next level, % progress, points to next.
 */
export function computeLevelProgress(score: number): LevelProgress {
  const s = Math.max(0, Number.isFinite(score) ? score : 0);
  const current = computeLevel(s);
  const nextIdx = LEVELS.findIndex((l) => l.level === current.level) + 1;
  const next = nextIdx < LEVELS.length ? LEVELS[nextIdx] : null;

  if (!next) {
    // Legend — no further progress
    return { current, next: null, score: s, progressPct: 100, pointsToNext: 0 };
  }

  const range = next.minScore - current.minScore;
  const within = s - current.minScore;
  const progressPct = Math.min(100, Math.round((within / range) * 100));
  const pointsToNext = next.minScore - s;

  return { current, next, score: s, progressPct, pointsToNext };
}

/** All 10 levels exposed for UI rendering */
export const ALL_LEVELS: readonly Readonly<LevelInfo>[] = LEVELS;

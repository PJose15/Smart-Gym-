import type { ReadinessInputs, ReadinessResult, ReadinessZone } from '@nexera/types';

// ─── Zone Configuration ────────────────────────────────────────

export const ZONE_COLORS: Record<ReadinessZone, string> = {
  peak: '#639922',
  ready: '#3B8BD4',
  moderate: '#D85A30',
  rest: '#888780',
};

const ZONE_CONFIG: Record<ReadinessZone, { color: string; headline: string }> = {
  peak: {
    color: '#639922',
    headline: 'Peak day — train hard',
  },
  ready: {
    color: '#3B8BD4',
    headline: 'Ready to train',
  },
  moderate: {
    color: '#D85A30',
    headline: 'Lighter session today',
  },
  rest: {
    color: '#888780',
    headline: 'Rest day recommended',
  },
};

// ─── Subline Builder ───────────────────────────────────────────

function buildSubline(
  inputs: ReadinessInputs,
  dominantSignal: string
): string {
  switch (dominantSignal) {
    case 'recent_sessions':
      return inputs.sessionCountLast3Days >= 3
        ? 'You have trained 3 days in a row — recovery will boost your next session'
        : 'Your body is well rested and ready to perform';
    case 'last_rpe':
      return inputs.lastSessionRPEAverage !== null && inputs.lastSessionRPEAverage >= 9
        ? 'Your last session was at max effort — today calls for recovery'
        : 'Your last session was comfortable — you have energy in reserve';
    case 'rest_days':
      return inputs.daysSinceLastSession >= 2
        ? `${inputs.daysSinceLastSession} days of rest — your muscles are fully recovered`
        : 'Give your body a little more time before pushing hard again';
    case 'volume_trend':
      return inputs.volumeTrend === 'increasing'
        ? 'Your training volume has been rising — a lighter day prevents overtraining'
        : 'Your training load is balanced — you are in a good rhythm';
    default:
      return 'Based on your recent training history';
  }
}

// ─── Main Calculation ──────────────────────────────────────────

export function calculateReadinessScore(
  inputs: ReadinessInputs
): ReadinessResult {
  let score = 50; // baseline

  // Signal 1: Sessions in last 3 days
  const sessionMap: Record<number, number> = {
    0: +25,
    1: +10,
    2: 0,
    3: -10,
    4: -20,
  };
  const sessionAdjustment = sessionMap[Math.min(inputs.sessionCountLast3Days, 4)] ?? -20;
  score += sessionAdjustment;

  // Signal 2: Last session RPE
  let rpeAdjustment = 0;
  if (inputs.lastSessionRPEAverage !== null) {
    if (inputs.lastSessionRPEAverage <= 7) rpeAdjustment = +15;
    else if (inputs.lastSessionRPEAverage <= 8) rpeAdjustment = +5;
    else if (inputs.lastSessionRPEAverage <= 9) rpeAdjustment = -5;
    else rpeAdjustment = -15;
  }
  score += rpeAdjustment;

  // Signal 3: Days since last session
  let restAdjustment = 0;
  if (inputs.daysSinceLastSession === 0) restAdjustment = -5;
  else if (inputs.daysSinceLastSession === 1) restAdjustment = +10;
  else if (inputs.daysSinceLastSession === 2) restAdjustment = +20;
  else if (inputs.daysSinceLastSession >= 3) restAdjustment = +25;
  score += restAdjustment;

  // Signal 4: Streak momentum
  let streakAdjustment = 0;
  if (inputs.currentStreak >= 14) streakAdjustment = +5;
  else if (inputs.currentStreak >= 7) streakAdjustment = +3;
  else if (inputs.currentStreak >= 3) streakAdjustment = +1;
  score += streakAdjustment;

  // Signal 5: Volume trend
  const volumeMap: Record<string, number> = {
    increasing: -5,
    stable: 0,
    decreasing: +5,
    insufficient: 0,
  };
  const volumeAdjustment = volumeMap[inputs.volumeTrend];
  score += volumeAdjustment;

  // Clamp and determine zone
  const finalScore = Math.max(0, Math.min(100, Math.round(score)));

  const zone: ReadinessZone =
    finalScore >= 80 ? 'peak'
    : finalScore >= 60 ? 'ready'
    : finalScore >= 40 ? 'moderate'
    : 'rest';

  const zoneConfig = ZONE_CONFIG[zone];

  // Determine dominant signal (include streak, use reduce for stable tie-breaking)
  const signalAdjustments = [
    { signal: 'recent_sessions', adjustment: Math.abs(sessionAdjustment) },
    { signal: 'last_rpe', adjustment: Math.abs(rpeAdjustment) },
    { signal: 'rest_days', adjustment: Math.abs(restAdjustment) },
    { signal: 'streak', adjustment: Math.abs(streakAdjustment) },
    { signal: 'volume_trend', adjustment: Math.abs(volumeAdjustment) },
  ];
  const dominant = signalAdjustments.reduce((max, cur) =>
    cur.adjustment > max.adjustment ? cur : max
  );

  return {
    score: finalScore,
    zone,
    color: zoneConfig.color,
    headline: zoneConfig.headline,
    subline: buildSubline(inputs, dominant.signal),
    dominant_signal: dominant.signal,
    signals: {
      session_count: sessionAdjustment,
      rpe: rpeAdjustment,
      rest_days: restAdjustment,
      streak: streakAdjustment,
      volume_trend: volumeAdjustment,
    },
  };
}

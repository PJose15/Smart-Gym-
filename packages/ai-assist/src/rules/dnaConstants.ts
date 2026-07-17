import type { DNAArchetype } from '@nexera/types';

// ============================================================================
// DNA Dimension Configuration
// ============================================================================

export const DIMENSION_CONFIG = {
  power: {
    label: 'Power',
    icon: '\u26A1',
    improvementTip: (score: number) =>
      score < 50
        ? 'Focus on progressive overload \u2014 add weight when you hit the upper rep target two sessions in a row.'
        : 'Your power is strong. Maintain and push for PRs on your key machines.',
  },
  consistency: {
    label: 'Consistency',
    icon: '\uD83D\uDD04',
    improvementTip: (score: number) =>
      score < 50
        ? 'Add one more session per week. Frequency is the single biggest driver of this score.'
        : 'Your consistency is excellent. Train even on days when readiness is moderate \u2014 that builds the score further.',
  },
  progression: {
    label: 'Progression',
    icon: '\uD83D\uDCC8',
    improvementTip: (score: number) =>
      score < 50
        ? 'Follow your AI program \u2014 the progressive overload is calculated to improve this score over 4-8 weeks.'
        : 'Keep the progressive overload consistent. Your trajectory is strong.',
  },
  balance: {
    label: 'Balance',
    icon: '\u2696',
    improvementTip: (score: number) =>
      score < 50
        ? 'Train a machine from a different muscle group this week. Your push/pull ratio is the quickest win.'
        : 'Your training variety is good. Aim for at least 2 lower body sessions per week to maintain balance.',
  },
  mindset: {
    label: 'Mindset',
    icon: '\uD83E\uDDE0',
    improvementTip: (score: number) =>
      score < 50
        ? 'Log your RPE on your sets. It takes 2 seconds and is the biggest contributor to this score.'
        : 'Your engagement is excellent. Keep replying to your weekly check-ins \u2014 that signals compound over time.',
  },
} as const;

// ============================================================================
// 12 Archetypes
// ============================================================================

export const ARCHETYPES: Record<string, DNAArchetype> = {
  complete_athlete: {
    id: 'complete_athlete',
    name: 'The Complete Athlete',
    description: 'You have built something rare. Every dimension reflects a well-developed athlete.',
    color: '#FFD700',
    icon: '\uD83C\uDFC6',
    coaching_focus: 'Maintain across all dimensions. Consider setting a PR target to push power further.',
  },

  iron_regular: {
    id: 'iron_regular',
    name: 'The Iron Regular',
    description: 'You show up no matter what. The gym is non-negotiable. Your consistency is your superpower.',
    color: '#3B82F6',
    icon: '\uD83D\uDD04',
    coaching_focus: 'Channel your consistency into intensity. Push weight harder on your reliable training days.',
  },

  specialist: {
    id: 'specialist',
    name: 'The Specialist',
    description: 'You have mastered specific movements and built real strength there. Your weak links are untested.',
    color: '#FF6B35',
    icon: '\u26A1',
    coaching_focus: 'Introduce new machine groups. Your strength will transfer faster than you think.',
  },

  climber: {
    id: 'climber',
    name: 'The Climber',
    description: 'You are always improving. Your progression rate is exceptional. The ceiling has not found you yet.',
    color: '#00C896',
    icon: '\uD83D\uDCC8',
    coaching_focus: 'Trust the process. Keep the progressive overload consistent and your power score will follow.',
  },

  foundation_builder: {
    id: 'foundation_builder',
    name: 'The Foundation Builder',
    description: 'You train everything. Nothing is neglected. Your foundation is solid. Now it is time to push.',
    color: '#7C5CFF',
    icon: '\u2696',
    coaching_focus: 'Pick 2-3 machines and prioritize them. Focused effort will raise your power score significantly.',
  },

  warrior: {
    id: 'warrior',
    name: 'The Warrior',
    description: 'When you show up, you go all in. Your sessions are intense and purposeful. The challenge is showing up more.',
    color: '#FF4D6A',
    icon: '\u2694',
    coaching_focus: 'One more session per week. That is the single change that unlocks everything else for you.',
  },

  streak_hunter: {
    id: 'streak_hunter',
    name: 'The Streak Hunter',
    description: 'Your attendance record is elite. You are in the gym more than almost anyone.',
    color: '#3B82F6',
    icon: '\uD83D\uDD25',
    coaching_focus: 'Your frequency is excellent. Focus on intensity now. Add weight on your next 3 sessions.',
  },

  sporadic_climber: {
    id: 'sporadic_climber',
    name: 'The Sporadic Climber',
    description: 'Your sessions are few but powerful. Every time you train, you improve. Imagine what more frequency would do.',
    color: '#00C896',
    icon: '\u26A1',
    coaching_focus: 'Add one session per week to your current schedule. Your progression will compound dramatically.',
  },

  explorer: {
    id: 'explorer',
    name: 'The Explorer',
    description: 'You try everything and engage deeply with your training. You just need to commit to a direction.',
    color: '#7C5CFF',
    icon: '\uD83D\uDD2D',
    coaching_focus: 'Pick a 6-week program and follow it completely. Your engagement will accelerate your results.',
  },

  rising_athlete: {
    id: 'rising_athlete',
    name: 'The Rising Athlete',
    description: 'Everything is developing together. You are in the best phase \u2014 active growth across every dimension.',
    color: '#A0A0B0',
    icon: '\uD83C\uDF31',
    coaching_focus: 'Keep showing up. At this stage, consistency matters more than anything else.',
  },

  newcomer: {
    id: 'newcomer',
    name: 'The Newcomer',
    description: 'You are just getting started. Every session you log builds your DNA.',
    color: '#606070',
    icon: '\uD83D\uDE80',
    coaching_focus: 'Log 10 sessions on at least 3 machines. Your DNA will reveal itself.',
  },

  dedicated_grinder: {
    id: 'dedicated_grinder',
    name: 'The Dedicated Grinder',
    description: 'You show up and you improve every time. The results are inevitable for people like you.',
    color: '#FFD700',
    icon: '\u2699',
    coaching_focus: 'Add balance to your training variety. Your consistency will turn new machines into strengths fast.',
  },
};

// ============================================================================
// Archetype Prestige Hierarchy (for feed event gating)
// ============================================================================

export const ARCHETYPE_PRESTIGE: Record<string, number> = {
  newcomer: 0,
  rising_athlete: 1,
  streak_hunter: 2,
  sporadic_climber: 2,
  foundation_builder: 3,
  explorer: 3,
  climber: 3,
  warrior: 3,
  specialist: 4,
  iron_regular: 4,
  dedicated_grinder: 5,
  complete_athlete: 6,
};

// ============================================================================
// Pentagon Chart Axes (clockwise from top)
// ============================================================================

export const DNA_AXES = [
  { key: 'power' as const, label: 'Power', icon: '\u26A1', angle: -90 },
  { key: 'consistency' as const, label: 'Consistency', icon: '\uD83D\uDD04', angle: -18 },
  { key: 'balance' as const, label: 'Balance', icon: '\u2696', angle: 54 },
  { key: 'mindset' as const, label: 'Mindset', icon: '\uD83E\uDDE0', angle: 126 },
  { key: 'progression' as const, label: 'Progression', icon: '\uD83D\uDCC8', angle: 198 },
] as const;

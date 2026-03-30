export { getNextSetSuggestion } from './rules/progression';
export { detectPRs } from './rules/prs';
export { getWorkoutInsight } from './rules/summary';
export { convertWeight, toKg, fromKg } from './rules/units';
export { localCache } from './cache/localCache';
export { generateMachineMistakes } from './generators/machineMistakes';
export type { LLMProvider } from './providers/llmProvider';
export { DisabledProvider } from './providers/disabled';
export { GeminiProvider } from './providers/geminiProvider';
export { getTodayExplanation } from './rules/todayExplanation';
export { getMachineAlternatives } from './rules/alternatives';
export { getFormChecklist } from './rules/checklist';
export { computeGuardrails } from './rules/guardrails';
export type { WorkoutRecord, GuardrailInput } from './rules/guardrails';
export type { AlternativesInput } from './rules/alternatives';
export type { ChecklistInput } from './rules/checklist';

// Safety Nudge
export { getSafetyNudge } from './rules/safetyNudge';
export type { SafetyNudgeInput, SafetyNudge, NudgeLevel } from './rules/safetyNudge';

// Progression input type
export type { ProgressionInput } from './rules/progression';

// Trainer Co-Pilot
export { buildWorkoutDraft } from './trainerCopilot/buildWorkoutDraft';
export { buildWeeklyDraft } from './trainerCopilot/buildWeeklyDraft';
export { computeAtRiskMembers } from './trainerCopilot/atRiskBatch';
export type { WorkoutDraftInput, WeeklyDraftInput, DraftOutput, StyleSettings, FeedbackTrends, AdherenceVsPlan } from './trainerCopilot/types';
export type { AtRiskMember, AtRiskReason, MemberData } from './trainerCopilot/atRiskBatch';

// Style templates
export { applyTone, applyVerbosity, feedbackTrendNote, adherenceNote } from './trainerCopilot/templates';

// Streaks
export { computeStreak } from './rules/streaks';
export type { StreakInput, StreakResult } from './rules/streaks';

// Badges
export { checkBadgeUnlocks } from './rules/badges';
export type { BadgeCheckInput } from './rules/badges';

// Member Context & Coaching
export { buildMemberContext } from './rules/memberContext';
export type { MemberContextInput, MemberContext, MemberContextWorkout } from './rules/memberContext';
export { getCoachingInsight } from './rules/coaching';
export type { CoachingInsight, CoachingInput } from './rules/coaching';

// Program Generation
export { generateProgram } from './generators/programGenerator';
export type { GeneratedProgram, GeneratedProgramDay, GeneratedExercise, ProgramGenerationInput } from './generators/programGenerator';

// Hero State (Phase 4)
export { computeHeroState } from './rules/heroState';
export type { HeroInput, HeroState, HeroVariant } from './rules/heroState';

// Sunday Anticipation (UI_009)
export { isSundayAnticipation, getMinutesUntilSixPM, checkSundayAnticipation } from './rules/sundayAnticipation';

// Levels (Phase 4)
export { computeLevel, computeLevelProgress, ALL_LEVELS } from './rules/levels';
export type { LevelInfo, LevelProgress } from './rules/levels';

// Readiness Score (Phase 8.1)
export { calculateReadinessScore, ZONE_COLORS } from './rules/readiness';

// Muscle Recovery (Phase 8.2)
export { MUSCLE_GROUPS, MUSCLE_GROUP_MAP, MACHINE_MUSCLE_MAP, normalizeMachineName, getMachineMuscleMappings } from './rules/muscleGroups';
export { getRecoveryHoursRequired, calculateMuscleState, buildMuscleRecommendations, calculateBalanceScore } from './rules/muscleRecovery';

// Performance DNA (Phase 8.5)
export { calculatePowerScore } from './rules/dna/calculatePowerScore';
export { calculateConsistencyScore } from './rules/dna/calculateConsistencyScore';
export { calculateProgressionScore, calculateWeightSlope } from './rules/dna/calculateProgressionScore';
export { calculateMindsetScore } from './rules/dna/calculateMindsetScore';
export { determineArchetype } from './rules/dna/determineArchetype';
export { ARCHETYPES, ARCHETYPE_PRESTIGE, DIMENSION_CONFIG, DNA_AXES } from './rules/dnaConstants';

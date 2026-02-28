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

// Trainer Co-Pilot
export { buildWorkoutDraft } from './trainerCopilot/buildWorkoutDraft';
export { buildWeeklyDraft } from './trainerCopilot/buildWeeklyDraft';
export type { WorkoutDraftInput, WeeklyDraftInput, DraftOutput } from './trainerCopilot/types';

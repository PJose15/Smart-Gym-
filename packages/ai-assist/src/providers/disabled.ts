import type { LLMProvider } from './llmProvider';

/**
 * Default fallback provider — returns deterministic defaults.
 * System works fully without any LLM.
 */
export class DisabledProvider implements LLMProvider {
  readonly name = 'disabled';
  readonly enabled = false;

  async generateMachineMistakes(_input: {
    machineName: string;
    targetMuscles: string[];
    setupSteps: string[];
  }): Promise<string[]> {
    // Return empty — will use template-based generation instead
    return [];
  }

  async rewriteInsightText(input: {
    insightText: string;
    suggestionText: string;
  }): Promise<{ insightText: string; suggestionText: string }> {
    // Pass through unchanged
    return {
      insightText: input.insightText,
      suggestionText: input.suggestionText,
    };
  }

  async generateCoachingInsight(_input: {
    memberName: string;
    contextSummary: string;
    gaps: string[];
    risks: string[];
    recentPRs: string[];
  }): Promise<{ message: string; action_items: string[] }> {
    // Return empty — coaching module will use rules-based fallback
    return { message: '', action_items: [] };
  }

  async generateProgram(_input: {
    goal: string;
    experience: string;
    daysPerWeek: number;
    limitations: string[];
    availableMachines: Array<{ id: string; name: string; target_muscles: string[] }>;
  }): Promise<{
    name: string;
    description: string;
    days: Array<{
      day_number: number;
      name: string;
      exercises: Array<{
        exercise_name: string;
        machine_id: string | null;
        default_sets: number;
        default_reps: number;
      }>;
    }>;
    overall_rationale: string;
  }> {
    // Return empty — program generator will use rules-based fallback
    return { name: '', description: '', days: [], overall_rationale: '' };
  }
}

/**
 * LLM Provider interface for optional AI text generation.
 * Strictly limited to:
 *   - Generating machine common_mistakes (one-time, cached)
 *   - Rewriting insight text in a friendly tone (numbers unchanged)
 */
export interface LLMProvider {
  readonly name: string;
  readonly enabled: boolean;

  /**
   * Generate common mistakes for a machine based on its name and target muscles.
   * Returns an array of mistake strings.
   */
  generateMachineMistakes(input: {
    machineName: string;
    targetMuscles: string[];
    setupSteps: string[];
  }): Promise<string[]>;

  /**
   * Rewrite insight text in a friendlier tone.
   * MUST NOT change any numbers, recommendations, or factual claims.
   */
  rewriteInsightText(input: {
    insightText: string;
    suggestionText: string;
  }): Promise<{ insightText: string; suggestionText: string }>;

  /**
   * Generate a personalized coaching insight based on member context.
   */
  generateCoachingInsight(input: {
    memberName: string;
    contextSummary: string;
    gaps: string[];
    risks: string[];
    recentPRs: string[];
  }): Promise<{ message: string; action_items: string[] }>;

  /**
   * Generate a workout program based on goals, experience, and available equipment.
   */
  generateProgram(input: {
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
  }>;
}

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
}

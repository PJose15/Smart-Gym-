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
}

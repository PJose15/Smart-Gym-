import type { LLMProvider } from './llmProvider';

/**
 * Google Gemini LLM provider.
 * Requires GEMINI_API_KEY environment variable.
 * Uses the Gemini 1.5 Flash model via REST API.
 */
export class GeminiProvider implements LLMProvider {
    readonly name = 'gemini';
    readonly enabled: boolean;

    private readonly apiKey: string;
    private readonly model: string;
    private readonly apiBase = 'https://generativelanguage.googleapis.com/v1beta/models';

    constructor(options?: { model?: string }) {
        const key =
            process.env.GEMINI_API_KEY ??
            process.env.EXPO_PUBLIC_GEMINI_API_KEY ??
            '';
        this.apiKey = key;
        this.enabled = key.length > 0;
        this.model = options?.model ?? 'gemini-1.5-flash';
    }

    private async complete(prompt: string, maxTokens = 512): Promise<string> {
        const url = `${this.apiBase}/${this.model}:generateContent?key=${this.apiKey}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    maxOutputTokens: maxTokens,
                    temperature: 0.4,
                },
            }),
            signal: AbortSignal.timeout(10_000),
        });

        if (!response.ok) {
            throw new Error(`Gemini API error: ${response.status} ${response.statusText}`);
        }

        const data = (await response.json()) as {
            candidates?: Array<{
                content?: { parts?: Array<{ text?: string }> };
            }>;
        };

        return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    }

    async generateMachineMistakes(input: {
        machineName: string;
        targetMuscles: string[];
        setupSteps: string[];
    }): Promise<string[]> {
        const { machineName, targetMuscles, setupSteps } = input;

        const prompt = `You are a certified personal trainer. List exactly 5 common mistakes people make when using the "${machineName}" gym machine.

Target muscles: ${targetMuscles.join(', ')}
Setup steps: ${setupSteps.slice(0, 3).join('; ')}

Rules:
- Each mistake must be a single sentence (max 15 words)
- Be specific and actionable
- Output ONLY a JSON array of 5 strings, no other text
- Example format: ["Mistake one.", "Mistake two.", ...]`;

        const raw = await this.complete(prompt, 400);

        // Extract JSON array from response
        const match = raw.match(/\[[\s\S]*?\]/);
        if (!match) return [];

        const parsed = JSON.parse(match[0]) as unknown;
        if (!Array.isArray(parsed)) return [];

        return parsed
            .filter((item): item is string => typeof item === 'string')
            .slice(0, 5);
    }

    async rewriteInsightText(input: {
        insightText: string;
        suggestionText: string;
    }): Promise<{ insightText: string; suggestionText: string }> {
        const { insightText, suggestionText } = input;

        const prompt = `Rewrite the following gym workout insight in a friendly, encouraging tone. 
IMPORTANT: Do NOT change any numbers, weights, reps, or factual claims. Only change the tone.

Insight: "${insightText}"
Suggestion: "${suggestionText}"

Output ONLY a JSON object with keys "insightText" and "suggestionText", no other text.`;

        try {
            const raw = await this.complete(prompt, 300);
            const match = raw.match(/\{[\s\S]*?\}/);
            if (!match) return input;

            const parsed = JSON.parse(match[0]) as unknown;
            if (
                typeof parsed === 'object' &&
                parsed !== null &&
                'insightText' in parsed &&
                'suggestionText' in parsed
            ) {
                return {
                    insightText: String((parsed as Record<string, unknown>).insightText),
                    suggestionText: String((parsed as Record<string, unknown>).suggestionText),
                };
            }
        } catch {
            // Fall through to return original
        }

        return input;
    }
}

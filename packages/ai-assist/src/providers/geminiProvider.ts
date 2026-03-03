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

        let parsed: unknown;
        try {
            parsed = JSON.parse(match[0]);
        } catch {
            return [];
        }
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

    async generateCoachingInsight(input: {
        memberName: string;
        contextSummary: string;
        gaps: string[];
        risks: string[];
        recentPRs: string[];
    }): Promise<{ message: string; action_items: string[] }> {
        const { memberName, contextSummary, gaps, risks, recentPRs } = input;

        const prompt = `You are a friendly, motivating personal fitness coach. Write a short personalized coaching message for a gym member.

Member name: ${memberName}
Recent activity: ${contextSummary}
${gaps.length > 0 ? `Areas to address: ${gaps.join('; ')}` : ''}
${risks.length > 0 ? `Risks: ${risks.join('; ')}` : ''}
${recentPRs.length > 0 ? `Recent PRs: ${recentPRs.join(', ')}` : ''}

Rules:
- Address them by first name
- Be encouraging but honest
- Keep the message to 2-3 sentences max
- Include 1-3 specific, actionable tips
- Output ONLY a JSON object with keys "message" (string) and "action_items" (string array), no other text`;

        try {
            const raw = await this.complete(prompt, 400);
            const match = raw.match(/\{[\s\S]*\}/);
            if (!match) return { message: '', action_items: [] };

            const parsed = JSON.parse(match[0]) as unknown;
            if (
                typeof parsed === 'object' &&
                parsed !== null &&
                'message' in parsed &&
                'action_items' in parsed
            ) {
                const obj = parsed as Record<string, unknown>;
                return {
                    message: String(obj.message),
                    action_items: Array.isArray(obj.action_items)
                        ? obj.action_items.filter((i): i is string => typeof i === 'string')
                        : [],
                };
            }
        } catch {
            // Fall through
        }

        return { message: '', action_items: [] };
    }

    async generateProgram(input: {
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
        const machineList = input.availableMachines
            .map((m) => `- ${m.name} (ID: ${m.id}, targets: ${m.target_muscles.join(', ')})`)
            .join('\n');

        const prompt = `You are an expert personal trainer. Design a ${input.daysPerWeek}-day workout program.

Goal: ${input.goal}
Experience level: ${input.experience}
${input.limitations.length > 0 ? `Limitations/injuries: ${input.limitations.join(', ')}` : 'No limitations.'}

Available equipment:
${machineList}

Rules:
- Use ONLY machines from the list above
- Each day should have 4-6 exercises
- Include the machine ID (from the list) for each exercise
- Appropriate sets/reps for the experience level
- Output ONLY a JSON object with keys: "name" (string), "description" (string), "days" (array of {day_number, name, exercises: [{exercise_name, machine_id, default_sets, default_reps}]}), "overall_rationale" (string)`;

        try {
            const raw = await this.complete(prompt, 1500);
            const match = raw.match(/\{[\s\S]*\}/);
            if (!match) return { name: '', description: '', days: [], overall_rationale: '' };

            const parsed = JSON.parse(match[0]) as Record<string, unknown>;
            if (!parsed.days || !Array.isArray(parsed.days)) {
                return { name: '', description: '', days: [], overall_rationale: '' };
            }

            return {
                name: String(parsed.name ?? ''),
                description: String(parsed.description ?? ''),
                days: (parsed.days as Array<Record<string, unknown>>).map((d, i) => ({
                    day_number: Number(d.day_number ?? i + 1),
                    name: String(d.name ?? `Day ${i + 1}`),
                    exercises: Array.isArray(d.exercises)
                        ? (d.exercises as Array<Record<string, unknown>>).map((e) => ({
                            exercise_name: String(e.exercise_name ?? ''),
                            machine_id: e.machine_id ? String(e.machine_id) : null,
                            default_sets: Number(e.default_sets ?? 3),
                            default_reps: Number(e.default_reps ?? 10),
                        }))
                        : [],
                })),
                overall_rationale: String(parsed.overall_rationale ?? ''),
            };
        } catch {
            // Fall through
        }

        return { name: '', description: '', days: [], overall_rationale: '' };
    }
}

/**
 * Edge Function: POST /ai-generate
 * Body: { action: 'coaching_insight' | 'generate_program' | 'machine_mistakes' | 'rewrite_insight', payload: {...} }
 *
 * Proxies all LLM (Gemini) calls so the API key stays server-side.
 * Each action mirrors a method from GeminiProvider in @smartgym/ai-assist.
 * Feature-flagged and rate-limited per user.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') ?? '';
const GEMINI_MODEL = 'gemini-1.5-flash';
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

// ─── Rate Limiting (in-memory sliding window) ────────────

const rateLimitMap = new Map<string, number[]>();
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX: Record<string, number> = {
  coaching_insight: 5,
  generate_program: 3,
  machine_mistakes: 10,
  rewrite_insight: 10,
};

function checkRateLimit(userId: string, action: string): boolean {
  const key = `${userId}:${action}`;
  const now = Date.now();
  const max = RATE_LIMIT_MAX[action] ?? 5;
  const timestamps = (rateLimitMap.get(key) ?? []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  if (timestamps.length >= max) return false;
  timestamps.push(now);
  rateLimitMap.set(key, timestamps);
  return true;
}

// ─── Gemini API Helper ───────────────────────────────────

async function complete(prompt: string, maxTokens = 512): Promise<string> {
  const url = `${GEMINI_API_BASE}/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

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
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    throw new Error(`Gemini API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}

// ─── Action Handlers ─────────────────────────────────────

async function handleCoachingInsight(payload: {
  memberName: string;
  contextSummary: string;
  gaps: string[];
  risks: string[];
  recentPRs: string[];
}): Promise<{ message: string; action_items: string[] }> {
  const { memberName, contextSummary, gaps, risks, recentPRs } = payload;

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

  const raw = await complete(prompt, 400);
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return { message: '', action_items: [] };

  const parsed = JSON.parse(match[0]);
  if (
    typeof parsed === 'object' &&
    parsed !== null &&
    'message' in parsed &&
    'action_items' in parsed
  ) {
    return {
      message: String(parsed.message),
      action_items: Array.isArray(parsed.action_items)
        ? parsed.action_items.filter((i: unknown): i is string => typeof i === 'string')
        : [],
    };
  }

  return { message: '', action_items: [] };
}

async function handleGenerateProgram(payload: {
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
  const machineList = payload.availableMachines
    .map((m) => `- ${m.name} (ID: ${m.id}, targets: ${m.target_muscles.join(', ')})`)
    .join('\n');

  const prompt = `You are an expert personal trainer. Design a ${payload.daysPerWeek}-day workout program.

Goal: ${payload.goal}
Experience level: ${payload.experience}
${payload.limitations.length > 0 ? `Limitations/injuries: ${payload.limitations.join(', ')}` : 'No limitations.'}

Available equipment:
${machineList}

Rules:
- Use ONLY machines from the list above
- Each day should have 4-6 exercises
- Include the machine ID (from the list) for each exercise
- Appropriate sets/reps for the experience level
- Output ONLY a JSON object with keys: "name" (string), "description" (string), "days" (array of {day_number, name, exercises: [{exercise_name, machine_id, default_sets, default_reps}]}), "overall_rationale" (string)`;

  const raw = await complete(prompt, 1500);
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
}

async function handleMachineMistakes(payload: {
  machineName: string;
  targetMuscles: string[];
  setupSteps: string[];
}): Promise<string[]> {
  const { machineName, targetMuscles, setupSteps } = payload;

  const prompt = `You are a certified personal trainer. List exactly 5 common mistakes people make when using the "${machineName}" gym machine.

Target muscles: ${targetMuscles.join(', ')}
Setup steps: ${setupSteps.slice(0, 3).join('; ')}

Rules:
- Each mistake must be a single sentence (max 15 words)
- Be specific and actionable
- Output ONLY a JSON array of 5 strings, no other text
- Example format: ["Mistake one.", "Mistake two.", ...]`;

  const raw = await complete(prompt, 400);
  const match = raw.match(/\[[\s\S]*?\]/);
  if (!match) return [];

  const parsed = JSON.parse(match[0]);
  if (!Array.isArray(parsed)) return [];

  return parsed
    .filter((item: unknown): item is string => typeof item === 'string')
    .slice(0, 5);
}

async function handleRewriteInsight(payload: {
  insightText: string;
  suggestionText: string;
}): Promise<{ insightText: string; suggestionText: string }> {
  const { insightText, suggestionText } = payload;

  const prompt = `Rewrite the following gym workout insight in a friendly, encouraging tone.
IMPORTANT: Do NOT change any numbers, weights, reps, or factual claims. Only change the tone.

Insight: "${insightText}"
Suggestion: "${suggestionText}"

Output ONLY a JSON object with keys "insightText" and "suggestionText", no other text.`;

  const raw = await complete(prompt, 300);
  const match = raw.match(/\{[\s\S]*?\}/);
  if (!match) return payload;

  const parsed = JSON.parse(match[0]);
  if (
    typeof parsed === 'object' &&
    parsed !== null &&
    'insightText' in parsed &&
    'suggestionText' in parsed
  ) {
    return {
      insightText: String(parsed.insightText),
      suggestionText: String(parsed.suggestionText),
    };
  }

  return payload;
}

// ─── Feature flag → action mapping ───────────────────────

const ACTION_FLAG_MAP: Record<string, string> = {
  coaching_insight: 'ai_coaching',
  generate_program: 'ai_program_gen',
  machine_mistakes: 'ai_coaching',
  rewrite_insight: 'ai_coaching',
};

// ─── Main Handler ────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    // Auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const userClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Parse body
    const { action, payload } = await req.json();
    if (!action || !payload) {
      return new Response(JSON.stringify({ error: 'action and payload are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Check Gemini API key
    if (!GEMINI_API_KEY) {
      return new Response(JSON.stringify({ error: 'AI service not configured', code: 'AI_DISABLED' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Rate limit
    if (!checkRateLimit(user.id, action)) {
      return new Response(JSON.stringify({ error: 'Rate limit exceeded', code: 'RATE_LIMITED' }), {
        status: 429,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Feature flag check
    const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const flagKey = ACTION_FLAG_MAP[action];
    if (flagKey) {
      const { data: flags } = await serviceClient
        .from('feature_flags')
        .select('enabled, profile_id')
        .eq('key', flagKey)
        .or(`profile_id.eq.${user.id},profile_id.is.null`);

      if (flags && flags.length > 0) {
        // User-specific override takes precedence over global
        const userFlag = flags.find((f: { profile_id: string | null }) => f.profile_id === user.id);
        const globalFlag = flags.find((f: { profile_id: string | null }) => f.profile_id === null);
        const flag = userFlag ?? globalFlag;
        if (flag && flag.enabled === false) {
          return new Response(JSON.stringify({ error: 'Feature disabled', code: 'FEATURE_DISABLED' }), {
            status: 403,
            headers: { 'Content-Type': 'application/json' },
          });
        }
      }
    }

    // Dispatch to handler
    let result: unknown;
    switch (action) {
      case 'coaching_insight':
        result = await handleCoachingInsight(payload);
        break;
      case 'generate_program':
        result = await handleGenerateProgram(payload);
        break;
      case 'machine_mistakes':
        result = await handleMachineMistakes(payload);
        break;
      case 'rewrite_insight':
        result = await handleRewriteInsight(payload);
        break;
      default:
        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
    }

    // Audit log (fire-and-forget)
    serviceClient
      .from('ai_audit_logs')
      .insert({
        profile_id: user.id,
        context: action === 'coaching_insight' ? 'coaching'
          : action === 'generate_program' ? 'program_gen'
          : action,
        inputs: payload,
        outputs: result,
      })
      .then(() => {})
      .catch(() => {});

    return new Response(JSON.stringify({ data: result }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('ai-generate error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});

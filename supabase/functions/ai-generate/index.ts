/**
 * Edge Function: POST /ai-generate
 * Body: { action: 'coaching_insight' | 'coaching_tip' | 'generate_program' | 'machine_mistakes' | 'rewrite_insight', payload: {...} }
 *
 * Proxies all LLM (Gemini) calls so the API key stays server-side.
 * Each action mirrors a method from GeminiProvider in @nexera/ai-assist.
 * Feature-flagged and rate-limited per user.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ─── CORS Headers ────────────────────────────────────────
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') ?? '';
const GEMINI_MODEL = Deno.env.get('GEMINI_MODEL') ?? 'gemini-2.5-flash';
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

// ─── Rate Limiting (in-memory sliding window) ────────────
// NOTE: This map resets when the edge function cold-starts or restarts.
// For MVP this is acceptable — the ai_audit_logs table tracks all calls
// so abuse can be detected retroactively. TODO: migrate to persistent
// rate limiting (e.g. Redis or DB-based) for production scale.

const rateLimitMap = new Map<string, number[]>();
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX: Record<string, number> = {
  coaching_insight: 5,
  coaching_tip: 10,
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

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(match[0]);
  } catch {
    return { message: '', action_items: [] };
  }
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

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(match[0]);
  } catch {
    return { name: '', description: '', days: [], overall_rationale: '' };
  }
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

  let parsed: unknown;
  try {
    parsed = JSON.parse(match[0]);
  } catch {
    return [];
  }
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

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(match[0]);
  } catch {
    return payload;
  }
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

async function handleCoachingTip(
  payload: {
    member_id: string;
    gym_id: string;
    machine_id: string;
    machine_name: string;
    muscle_groups: string[];
    category: string;
    experience_level: string;
    sets_logged: number;
  },
  serviceClient: ReturnType<typeof createClient>,
): Promise<{ tip_text: string; cached: boolean }> {
  const { member_id, machine_id, machine_name, muscle_groups, category, experience_level, sets_logged } = payload;
  const today = new Date().toISOString().split('T')[0];

  // Check cache first
  const { data: cached } = await serviceClient
    .from('ai_tip_cache')
    .select('tip_text')
    .eq('member_id', member_id)
    .eq('machine_id', machine_id)
    .eq('cache_date', today)
    .maybeSingle();

  if (cached?.tip_text) {
    return { tip_text: cached.tip_text, cached: true };
  }

  // Generate via Gemini
  const prompt = `You are a friendly gym coach. Write ONE short post-set tip for a member using the "${machine_name}" machine.

Context:
- Machine category: ${category}
- Target muscles: ${muscle_groups.join(', ')}
- Member experience: ${experience_level}
- Sets logged today: ${sets_logged}

Rules:
- Max 60 words
- Be specific to this machine and muscles
- Actionable and encouraging
- Do NOT start with "As an AI" or similar phrases
- Output ONLY the tip text, nothing else`;

  let tipText = await complete(prompt, 150);

  // Strip "as an AI" type phrases
  tipText = tipText.replace(/\b(as an ai|as a language model|as an artificial)\b[^.]*[.,]?\s*/gi, '').trim();

  // Enforce 60-word max
  const words = tipText.split(/\s+/);
  if (words.length > 60) {
    tipText = words.slice(0, 60).join(' ') + '.';
  }

  // Cache result (fire-and-forget)
  serviceClient
    .from('ai_tip_cache')
    .upsert(
      { member_id, machine_id, cache_date: today, tip_text: tipText, tip_source: 'ai' },
      { onConflict: 'member_id,machine_id,cache_date' },
    )
    .then(() => {})
    .catch((err: Error) => console.error('[tip-cache] upsert failed:', err.message));

  return { tip_text: tipText, cached: false };
}

// ─── Feature flag → action mapping ───────────────────────

const ACTION_FLAG_MAP: Record<string, string> = {
  coaching_insight: 'ai_coaching',
  coaching_tip: 'ai_coaching',
  generate_program: 'ai_program_gen',
  machine_mistakes: 'ai_coaching',
  rewrite_insight: 'ai_coaching',
};

// ─── Main Handler ────────────────────────────────────────

Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 204, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    // Auth
    const headers = { ...corsHeaders, 'Content-Type': 'application/json' };

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401,
        headers,
      });
    }

    const userClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers,
      });
    }

    // Parse body
    const { action, payload } = await req.json();
    if (!action || !payload) {
      return new Response(JSON.stringify({ error: 'action and payload are required' }), {
        status: 400,
        headers,
      });
    }

    // Check Gemini API key
    if (!GEMINI_API_KEY) {
      return new Response(JSON.stringify({ error: 'AI service not configured', code: 'AI_DISABLED' }), {
        status: 503,
        headers,
      });
    }

    // Rate limit
    if (!checkRateLimit(user.id, action)) {
      return new Response(JSON.stringify({ error: 'Rate limit exceeded', code: 'RATE_LIMITED' }), {
        status: 429,
        headers,
      });
    }

    // Feature flag check
    const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const flagKey = ACTION_FLAG_MAP[action];
    if (flagKey) {
      const { data: flag, error: flagError } = await serviceClient
        .from('feature_flags')
        .select('is_enabled')
        .eq('flag_key', flagKey)
        .maybeSingle();

      // Deny access if flag query itself errors
      if (flagError) {
        return new Response(JSON.stringify({ error: 'Service unavailable', code: 'FLAG_CHECK_FAILED' }), {
          status: 503,
          headers,
        });
      }

      if (flag && flag.is_enabled === false) {
        return new Response(JSON.stringify({ error: 'Feature disabled', code: 'FEATURE_DISABLED' }), {
          status: 403,
          headers,
        });
      }
    }

    // Per-action payload validation (check fields each handler accesses)
    const missing = (field: string) =>
      new Response(JSON.stringify({ error: `Missing required payload field: ${field}` }), {
        status: 400,
        headers,
      });

    if (action === 'coaching_insight' && (!payload.memberName || !payload.contextSummary)) {
      return missing('memberName / contextSummary');
    }
    if (action === 'generate_program') {
      if (!payload.goal || !payload.experience || !payload.daysPerWeek || !Array.isArray(payload.availableMachines)) {
        return missing('goal / experience / daysPerWeek / availableMachines');
      }
    }
    if (action === 'machine_mistakes' && (!payload.machineName || !Array.isArray(payload.targetMuscles))) {
      return missing('machineName / targetMuscles');
    }
    if (action === 'coaching_tip' && (!payload.member_id || !payload.machine_id || !payload.machine_name)) {
      return missing('member_id / machine_id / machine_name');
    }
    if (action === 'rewrite_insight' && (!payload.insightText || !payload.suggestionText)) {
      return missing('insightText / suggestionText');
    }

    // Dispatch to handler
    let result: unknown;
    switch (action) {
      case 'coaching_insight':
        result = await handleCoachingInsight(payload);
        break;
      case 'coaching_tip':
        result = await handleCoachingTip(payload, serviceClient);
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
          headers,
        });
    }

    // Audit log (fire-and-forget — Issue 11: log errors instead of swallowing)
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
      .catch((err: Error) => console.error('[audit] insert failed:', err.message));

    return new Response(JSON.stringify({ data: result }), {
      status: 200,
      headers,
    });

  } catch (err) {
    console.error('ai-generate error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

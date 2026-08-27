import type { CheckInWeekData } from '@nexera/types';
import { GeminiProvider } from '@nexera/ai-assist';
import { getFallbackCheckIn } from './checkInFallbacks';

const gemini = new GeminiProvider();

/**
 * Generate a weekly check-in message using Gemini.
 * Falls back to template if Gemini is unavailable.
 */
export async function generateAICheckIn(
  weekData: CheckInWeekData
): Promise<string> {
  if (!gemini.enabled) {
    return getFallbackCheckIn(weekData);
  }

  const systemPrompt = `You are a personal trainer writing a weekly check-in message for a gym member.
You have access to their exact workout data from this past week.
Write in a direct, warm, knowledgeable coaching voice.

CRITICAL RULES:
1. Reference SPECIFIC numbers — exact weights, exact sessions, exact PRs.
   Never say "great job" without saying what specifically was great.
2. Three parts: what they did / what it means / what comes next.
3. Maximum 7 sentences total across all three parts.
4. One closing line: "See you on the floor. — Your Nexera Coach"
5. Never use the word "journey". Never say "keep it up" generically.
6. Never make medical claims or diagnose anything.
7. If the member had a bad week, acknowledge it honestly but without
   guilt. Frame it as data, not failure.
8. If the member had a great week, be specific about why it was great —
   not just that it was great.
9. Tone: like a trainer who knows you, respects your time,
   and says exactly what needs to be said — no more, no less.
10. Language: ${weekData.gym_language === 'es' ? 'Write in Spanish.' : 'Write in English.'}

THE THREE-PART STRUCTURE:
Part 1 (What you did): 2-3 sentences. Exact numbers. Facts only.
Part 2 (What it means): 1-2 sentences. One coaching observation.
Part 3 (What comes next): 1-2 sentences. One specific focus.
Closing: "See you on the floor. — Your Nexera Coach"`;

  const userPrompt = buildCheckInDataPrompt(weekData);
  const fullPrompt = `${systemPrompt}\n\n${userPrompt}`;

  try {
    // Use the internal complete method via a public wrapper
    const raw = await callGemini(fullPrompt);
    const text = raw.trim();
    if (text.length > 30) return text;
    return getFallbackCheckIn(weekData);
  } catch {
    return getFallbackCheckIn(weekData);
  }
}

/**
 * Call Gemini API directly for check-in generation.
 * Uses the same REST pattern as GeminiProvider but with higher token limit.
 */
async function callGemini(prompt: string): Promise<string> {
  const apiKey =
    process.env.GEMINI_API_KEY ??
    process.env.EXPO_PUBLIC_GEMINI_API_KEY ??
    '';

  if (!apiKey) throw new Error('GEMINI_API_KEY not set');

  const model = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        maxOutputTokens: 400,
        temperature: 0.7,
      },
    }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    throw new Error(`Gemini API error: ${response.status}`);
  }

  const data = (await response.json()) as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
    }>;
  };

  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}

/** Strip control chars and prompt-injection markers from user-controlled strings */
function sanitize(input: string | null | undefined): string {
  if (!input) return '';
  return input
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .slice(0, 200);
}

function buildCheckInDataPrompt(data: CheckInWeekData): string {
  const prLine =
    data.pr_details.length > 0
      ? `PR details: ${data.pr_details
          .map(
            pr =>
              `${pr.machine_name} — ${pr.weight_lbs} lbs (+${pr.improvement_lbs} lbs)`
          )
          .join(', ')}`
      : '';

  return `Write a weekly check-in for ${sanitize(data.member_first_name)}.

MEMBER PROFILE:
  Goal: ${sanitize(data.primary_goal)}
  Experience: ${sanitize(data.experience_level)}
  Member since: ${data.months_as_member} months ago
  Current program: ${sanitize(data.program_title) || 'Free training (no program)'}
  Program week: ${data.program_week_number ?? 'N/A'}

THIS WEEK (${data.week_start} to ${data.week_end}):
  Sessions logged: ${data.sessions_this_week}
  Sessions scheduled (if on program): ${data.sessions_scheduled ?? 'N/A'}
  Total volume: ${data.total_volume_lbs.toLocaleString()} lbs
  PRs hit: ${data.prs_this_week}
  ${prLine}
  Machines trained: ${data.machines_trained.join(', ') || 'None'}
  Average RPE: ${data.avg_rpe ?? 'Not logged'}
  Streak: ${data.current_streak} days

COMPARED TO LAST WEEK:
  Sessions: ${data.sessions_this_week} vs ${data.sessions_last_week} last week
  Volume: ${data.total_volume_lbs.toLocaleString()} vs ${data.volume_last_week.toLocaleString()} last week
  PRs: ${data.prs_this_week} vs ${data.prs_last_week} last week

READINESS:
  Average readiness score this week: ${data.avg_readiness_score ?? 'Insufficient data'}
  Readiness zone most common: ${data.dominant_readiness_zone ?? 'N/A'}

MUSCLE RECOVERY:
  Most trained muscle groups: ${data.most_trained_muscles.join(', ') || 'N/A'}
  Undertrained (need more attention): ${data.undertrained_muscles.join(', ') || 'None'}
  Push/pull balance: ${data.push_pull_balance}% (100% = perfect balance)

INJURIES OR LIMITATIONS ON FILE:
  ${sanitize(data.injuries_or_limitations) || 'None'}

Write the check-in now. Three parts + closing. Maximum 7 sentences.`;
}

/**
 * AI Coaching — generates personalized coaching insights.
 * Tries LLM first, falls back to deterministic rules.
 */

import type { LLMProvider } from '../providers/llmProvider';
import { buildMemberContext } from './memberContext';
import type { MemberContextInput, MemberContext } from './memberContext';

// ─── Types ────────────────────────────────────────────────

export interface CoachingInsight {
  message: string;
  action_items: string[];
  source: 'ai' | 'rules';
}

export interface CoachingInput extends MemberContextInput {
  memberName: string;
}

// ─── Deterministic Fallback ───────────────────────────────

function rulesBasedInsight(ctx: MemberContext, name: string): CoachingInsight {
  const firstName = name.split(' ')[0] || 'there';
  const actions: string[] = [];
  let message: string;

  if (ctx.totalWorkouts30d === 0) {
    message = `Hey ${firstName}, it's been a while! Getting back to the gym is the hardest part — let's start with a light session to rebuild the habit.`;
    actions.push('Start with a light session this week');
    actions.push('Focus on form over weight');
  } else if (ctx.gaps.length > 0 && ctx.volumeTrend === 'decreasing') {
    message = `${firstName}, your volume has been trending down recently. That's okay — let's focus on consistency. Even shorter sessions keep the momentum going.`;
    actions.push('Aim for at least 2 sessions this week');
    if (!ctx.streak.currentWeekActive) {
      actions.push('Train today to maintain your streak');
    }
  } else if (ctx.risks.length > 0) {
    message = `Great effort lately, ${firstName}! Just keep an eye on recovery — your body builds muscle during rest, not during workouts.`;
    actions.push('Include at least 1 rest day between sessions');
    if (ctx.risks.some((r) => r.includes('discomfort'))) {
      actions.push('Review form on exercises causing discomfort');
    }
  } else if (ctx.recentPRs.length > 0) {
    const prList = ctx.recentPRs.slice(0, 2).join(' and ');
    message = `Nice work, ${firstName}! You hit PRs on ${prList}. Keep pushing — progressive overload is the key to growth.`;
    actions.push('Try adding a small weight increment next session');
    actions.push('Keep tracking your sets for continued progress');
  } else if (ctx.volumeTrend === 'increasing') {
    message = `You're on a roll, ${firstName}! Volume is trending up and consistency looks solid. Keep this pace and you'll see real results.`;
    actions.push('Maintain your current training frequency');
    actions.push('Consider a deload week if fatigue builds up');
  } else {
    message = `Looking good, ${firstName}! You're staying consistent with ${ctx.totalWorkouts30d} sessions this month. Keep showing up and the results will follow.`;
    actions.push('Try a new exercise variation to keep things fresh');
    if (ctx.streak.currentStreak >= 4) {
      actions.push(`Amazing ${ctx.streak.currentStreak}-week streak — don't break it!`);
    }
  }

  return { message, action_items: actions, source: 'rules' };
}

// ─── Main Function ────────────────────────────────────────

export async function getCoachingInsight(
  input: CoachingInput,
  llm?: LLMProvider,
): Promise<CoachingInsight> {
  const ctx = buildMemberContext(input);
  const fallback = rulesBasedInsight(ctx, input.memberName);

  // Try LLM rewrite if available
  if (llm?.enabled) {
    try {
      const result = await llm.generateCoachingInsight({
        memberName: input.memberName,
        contextSummary: ctx.summaryText,
        gaps: ctx.gaps,
        risks: ctx.risks,
        recentPRs: ctx.recentPRs,
      });

      if (result.message && result.message.length > 10) {
        return {
          message: result.message,
          action_items: result.action_items.length > 0 ? result.action_items : fallback.action_items,
          source: 'ai',
        };
      }
    } catch {
      // Fall through to rules-based
    }
  }

  return fallback;
}

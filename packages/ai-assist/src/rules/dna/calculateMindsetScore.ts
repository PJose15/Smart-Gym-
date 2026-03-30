import type { DNADimensionScore } from '@nexera/types';

interface MindsetInput {
  allSets: Array<{ rpe: number | null }>;
  checkIns: Array<{ member_replied: boolean }>;
  goalsSet: number;
  goalsAchieved: number;
  reactionCount: number;
  shareCount: number;
  sessionCount: number;
}

/**
 * MINDSET dimension (0-100): Engagement beyond just showing up.
 *
 * Signal 1: RPE logging rate (25 pts max)
 * Signal 2: Check-in reply rate (25 pts max)
 * Signal 3: Goal-setting behavior (25 pts max)
 * Signal 4: Social engagement (25 pts max)
 */
export function calculateMindsetScore(input: MindsetInput): DNADimensionScore {
  const { allSets, checkIns, goalsSet, goalsAchieved, reactionCount, shareCount, sessionCount } =
    input;

  // Signal 1: RPE logging rate (25 pts max)
  const setsWithRPE = allSets.filter(s => s.rpe !== null && s.rpe !== undefined);
  const rpeRate = allSets.length > 0 ? setsWithRPE.length / allSets.length : 0;
  const rpeScore = Math.min(25, Math.round(rpeRate * 25));

  // Signal 2: Check-in reply rate (25 pts max)
  const repliedCheckIns = checkIns.filter(c => c.member_replied).length;
  const replyRate = checkIns.length > 0 ? repliedCheckIns / checkIns.length : 0;
  const checkInScore = checkIns.length === 0 ? 12 : Math.round(replyRate * 25);

  // Signal 3: Goal-setting behavior (25 pts max)
  // Setting goals = intention (+3 per goal, max 15)
  // Achieving them = extra credit (+5 per achieved, max 10)
  const goalSetScore = Math.min(15, goalsSet * 3);
  const goalAchieveScore = Math.min(10, goalsAchieved * 5);
  const goalScore = goalSetScore + goalAchieveScore;

  // Signal 4: Social engagement (25 pts max)
  // Reactions: 2 pts each, Shares: 3 pts each
  const socialScore = Math.min(25, reactionCount * 2 + shareCount * 3);

  const totalScore = Math.min(100, rpeScore + checkInScore + goalScore + socialScore);

  return {
    score: totalScore,
    is_building: sessionCount < 5,
    signals: {
      rpe_logging_rate: Math.round(rpeRate * 100),
      check_in_reply_rate: checkIns.length > 0 ? Math.round(replyRate * 100) : null,
      goals_set_this_month: goalsSet,
      goals_achieved_this_month: goalsAchieved,
      reactions_given: reactionCount,
      workout_shares: shareCount,
    },
  };
}

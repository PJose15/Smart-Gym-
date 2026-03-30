import type { DNAScores, DNAArchetype } from '@nexera/types';
import { ARCHETYPES } from '../dnaConstants';

/**
 * Determine which of the 12 archetypes best fits the given scores.
 * Rules are evaluated in priority order — first match wins.
 */
export function determineArchetype(scores: DNAScores): DNAArchetype {
  const { power, consistency, progression, balance, mindset } = scores;
  const avg = (power + consistency + progression + balance + mindset) / 5;

  // Complete Athlete — all dimensions high
  if (power >= 70 && consistency >= 70 && progression >= 70 && balance >= 70 && mindset >= 70) {
    return ARCHETYPES.complete_athlete;
  }

  // Newcomer — everything low
  if (avg < 30) {
    return ARCHETYPES.newcomer;
  }

  // Rising Athlete — everything developing, none high
  if (
    avg >= 30 &&
    avg < 55 &&
    Math.max(power, consistency, progression, balance, mindset) < 70
  ) {
    return ARCHETYPES.rising_athlete;
  }

  // Iron Regular — high consistency AND mindset
  if (consistency >= 70 && mindset >= 65) {
    return ARCHETYPES.iron_regular;
  }

  // Dedicated Grinder — high consistency AND progression
  if (consistency >= 70 && progression >= 65) {
    return ARCHETYPES.dedicated_grinder;
  }

  // Specialist — high power, low balance
  if (power >= 70 && balance < 45) {
    return ARCHETYPES.specialist;
  }

  // Warrior — high power AND mindset, lower consistency
  if (power >= 65 && mindset >= 65 && consistency < 50) {
    return ARCHETYPES.warrior;
  }

  // Climber — high progression, lower power
  if (progression >= 70 && power < 55) {
    return ARCHETYPES.climber;
  }

  // Sporadic Climber — high progression, low consistency
  if (progression >= 65 && consistency < 45) {
    return ARCHETYPES.sporadic_climber;
  }

  // Foundation Builder — high balance, lower power
  if (balance >= 70 && power < 50) {
    return ARCHETYPES.foundation_builder;
  }

  // Explorer — high balance AND mindset
  if (balance >= 65 && mindset >= 65) {
    return ARCHETYPES.explorer;
  }

  // Streak Hunter — high consistency, lower power
  if (consistency >= 65 && power < 45) {
    return ARCHETYPES.streak_hunter;
  }

  // Default: differentiate by progression
  if (progression >= 40) {
    return ARCHETYPES.rising_athlete;
  }
  return ARCHETYPES.foundation_builder;
}

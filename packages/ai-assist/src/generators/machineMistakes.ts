/**
 * Deterministic template-based common mistakes generator.
 * Falls back to LLM only if a provider is enabled and templates don't cover the machine.
 */

import type { LLMProvider } from '../providers/llmProvider';
import { DisabledProvider } from '../providers/disabled';

// ─── Category detection ─────────────────────────────────

type MachineCategory = 'press' | 'pull' | 'legs' | 'cable' | 'core' | 'cardio' | 'general';

function detectCategory(machineName: string, targetMuscles: string[]): MachineCategory {
  const name = machineName.toLowerCase();
  const muscles = targetMuscles.map((m) => m.toLowerCase()).join(' ');
  const combined = `${name} ${muscles}`;

  if (/press|bench|shoulder press|chest press/i.test(combined)) return 'press';
  if (/pull|row|lat|pulldown|chin/i.test(combined)) return 'pull';
  if (/squat|leg|hamstring|quad|calf|lunge|hip/i.test(combined)) return 'legs';
  if (/cable|pulley|crossover/i.test(combined)) return 'cable';
  if (/ab|core|crunch|plank/i.test(combined)) return 'core';
  if (/treadmill|bike|elliptical|rower|stair/i.test(combined)) return 'cardio';
  return 'general';
}

// ─── Templates ──────────────────────────────────────────

const MISTAKE_TEMPLATES: Record<MachineCategory, string[]> = {
  press: [
    'Flaring elbows too wide — keep elbows at ~45 degrees to protect shoulders.',
    'Arching lower back excessively — maintain contact with the pad.',
    'Using momentum instead of controlled movement.',
    'Locking out joints at the top — keep a slight bend.',
    'Gripping the handles too tightly — relax your grip.',
  ],
  pull: [
    'Using momentum or swinging the body — initiate the pull with your back.',
    'Shrugging shoulders up — depress shoulder blades before pulling.',
    'Pulling with biceps only — focus on squeezing the back.',
    'Not achieving full range of motion.',
    'Leaning too far back on rows — maintain an upright torso.',
  ],
  legs: [
    'Knees caving inward — press through the outside of your feet.',
    'Not hitting parallel depth on squats — lower until thighs are parallel.',
    'Rounding the lower back — maintain a neutral spine.',
    'Bouncing at the bottom of the movement.',
    'Placing feet too narrow or too wide for proper alignment.',
  ],
  cable: [
    'Standing too close or too far from the machine.',
    'Using body momentum instead of isolating the target muscle.',
    'Not controlling the eccentric (return) phase.',
    'Selecting too heavy a weight, compromising form.',
    'Not adjusting the pulley height for the exercise.',
  ],
  core: [
    'Pulling on the neck during crunches — hands behind ears, not behind head.',
    'Using hip flexors instead of abs.',
    'Holding breath — maintain steady breathing throughout.',
    'Moving too quickly — slow and controlled reps are more effective.',
    'Arching the lower back instead of bracing the core.',
  ],
  cardio: [
    'Holding the handrails too tightly — use them for balance only.',
    'Hunching shoulders — maintain upright posture.',
    'Setting the resistance too high too soon.',
    'Skipping the warm-up phase.',
    'Leaning on the console for support.',
  ],
  general: [
    'Not adjusting the machine to your body size before starting.',
    'Using momentum instead of controlled movement.',
    'Holding your breath — breathe out on exertion.',
    'Selecting too heavy a weight to start — begin lighter, increase gradually.',
    'Skipping the eccentric (lowering) phase of the movement.',
  ],
};

// ─── Generator ──────────────────────────────────────────

export async function generateMachineMistakes(input: {
  machineName: string;
  targetMuscles: string[];
  setupSteps: string[];
  provider?: LLMProvider;
}): Promise<string[]> {
  const { machineName, targetMuscles, setupSteps, provider } = input;

  // Try LLM first if enabled
  const llm = provider ?? new DisabledProvider();
  if (llm.enabled) {
    try {
      const result = await llm.generateMachineMistakes({
        machineName,
        targetMuscles,
        setupSteps,
      });
      if (result.length > 0) return result;
    } catch {
      // Fall through to template
    }
  }

  // Deterministic template fallback
  const category = detectCategory(machineName, targetMuscles);
  return MISTAKE_TEMPLATES[category];
}

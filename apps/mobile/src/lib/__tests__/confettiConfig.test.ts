import {
  CONFETTI_CONFIGS,
  generateParticles,
  MAX_CONFETTI_PARTICLES,
} from '../confettiConfig';

describe('CONFETTI_CONFIGS', () => {
  // DOC_03 Section 11
  it('pr: 120 particles over 800ms', () => {
    expect(CONFETTI_CONFIGS.pr.count).toBe(120);
    expect(CONFETTI_CONFIGS.pr.duration).toBe(800);
    expect(CONFETTI_CONFIGS.pr.spread).toBe(60);
    expect(CONFETTI_CONFIGS.pr.gravity).toBe(0.8);
    expect(CONFETTI_CONFIGS.pr.shapes).toEqual(['square', 'circle', 'ribbon']);
  });

  it('achievement: 40 particles over 800ms', () => {
    expect(CONFETTI_CONFIGS.achievement.count).toBe(40);
    expect(CONFETTI_CONFIGS.achievement.duration).toBe(800);
    expect(CONFETTI_CONFIGS.achievement.spread).toBe(40);
    expect(CONFETTI_CONFIGS.achievement.gravity).toBe(0.7);
  });

  it('levelup: 80 particles over 1000ms', () => {
    expect(CONFETTI_CONFIGS.levelup.count).toBe(80);
    expect(CONFETTI_CONFIGS.levelup.duration).toBe(1000);
    expect(CONFETTI_CONFIGS.levelup.spread).toBe(80);
    expect(CONFETTI_CONFIGS.levelup.gravity).toBe(0.75);
  });

  it('no variant exceeds the performance cap (DOC_03 Section 20)', () => {
    for (const config of Object.values(CONFETTI_CONFIGS)) {
      expect(config.count).toBeLessThanOrEqual(MAX_CONFETTI_PARTICLES);
    }
  });
});

describe('generateParticles', () => {
  // Simple deterministic LCG for reproducible tests
  function seededRandom(seed: number): () => number {
    let state = seed;
    return () => {
      state = (state * 1664525 + 1013904223) % 4294967296;
      return state / 4294967296;
    };
  }

  it('generates the configured particle count per variant', () => {
    expect(generateParticles('pr', seededRandom(1))).toHaveLength(120);
    expect(generateParticles('achievement', seededRandom(1))).toHaveLength(40);
    expect(generateParticles('levelup', seededRandom(1))).toHaveLength(80);
  });

  it('only uses colors and shapes from the variant config', () => {
    const particles = generateParticles('achievement', seededRandom(42));
    const config = CONFETTI_CONFIGS.achievement;
    for (const p of particles) {
      expect(config.colors).toContain(p.color);
      expect(config.shapes).toContain(p.shape);
    }
  });

  it('particles rise (negative peakY) then fall (positive fallY)', () => {
    const particles = generateParticles('pr', seededRandom(7));
    for (const p of particles) {
      expect(p.peakY).toBeLessThan(0);
      expect(p.fallY).toBeGreaterThan(0);
    }
  });

  it('delayRatio stays within stagger window [0, 0.25)', () => {
    const particles = generateParticles('levelup', seededRandom(9));
    for (const p of particles) {
      expect(p.delayRatio).toBeGreaterThanOrEqual(0);
      expect(p.delayRatio).toBeLessThan(0.25);
    }
  });

  it('is deterministic with a seeded random fn', () => {
    const a = generateParticles('pr', seededRandom(5));
    const b = generateParticles('pr', seededRandom(5));
    expect(a).toEqual(b);
  });
});

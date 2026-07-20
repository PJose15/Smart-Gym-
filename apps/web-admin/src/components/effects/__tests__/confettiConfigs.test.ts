import {
  PR_CONFETTI,
  ACHIEVEMENT_CONFETTI,
  LEVEL_UP_CONFETTI,
  MAX_CONFETTI_PARTICLES,
  getConfettiConfig,
} from '../confettiConfigs';

// ── Config values — DOC_03 §11 ─────────────────────────

describe('confetti configs (DOC_03 §11)', () => {
  test('T1: PR confetti — 120 particles / 800ms', () => {
    expect(PR_CONFETTI.count).toBe(120);
    expect(PR_CONFETTI.duration).toBe(800);
    expect(PR_CONFETTI.spread).toBe(60);
    expect(PR_CONFETTI.startVelocity).toBe(35);
    expect(PR_CONFETTI.gravity).toBe(0.8);
    expect(PR_CONFETTI.shapes).toEqual(['square', 'circle', 'ribbon']);
  });

  test('T2: achievement confetti — lighter, more focused (40 / 800ms)', () => {
    expect(ACHIEVEMENT_CONFETTI.count).toBe(40);
    expect(ACHIEVEMENT_CONFETTI.duration).toBe(800);
    expect(ACHIEVEMENT_CONFETTI.spread).toBe(40);
    expect(ACHIEVEMENT_CONFETTI.startVelocity).toBe(25);
    expect(ACHIEVEMENT_CONFETTI.gravity).toBe(0.7);
    expect(ACHIEVEMENT_CONFETTI.shapes).toEqual(['circle', 'square']);
  });

  test('T3: level-up confetti — 80 particles / 1000ms', () => {
    expect(LEVEL_UP_CONFETTI.count).toBe(80);
    expect(LEVEL_UP_CONFETTI.duration).toBe(1000);
    expect(LEVEL_UP_CONFETTI.spread).toBe(80);
    expect(LEVEL_UP_CONFETTI.startVelocity).toBe(30);
    expect(LEVEL_UP_CONFETTI.gravity).toBe(0.75);
  });

  test('T4: spec colors include brand crimson; achievement palette is focused', () => {
    expect(PR_CONFETTI.colors).toContain('#E0142F');
    expect(ACHIEVEMENT_CONFETTI.colors).toEqual(['#E0142F', '#E8B339', '#FFFFFF']);
    expect(LEVEL_UP_CONFETTI.colors).toEqual(['#E0142F', '#FF2740', '#E8B339', '#FFFFFF']);
  });
});

// ── Variant selection + performance budget — DOC_03 §20 ──

describe('getConfettiConfig', () => {
  test('T5: maps each variant to its config', () => {
    expect(getConfettiConfig('pr')).toEqual(PR_CONFETTI);
    expect(getConfettiConfig('achievement')).toEqual(ACHIEVEMENT_CONFETTI);
    expect(getConfettiConfig('levelup')).toEqual(LEVEL_UP_CONFETTI);
  });

  test('T6: every config respects the 120-particle budget', () => {
    expect(MAX_CONFETTI_PARTICLES).toBe(120);
    for (const variant of ['pr', 'achievement', 'levelup'] as const) {
      expect(getConfettiConfig(variant).count).toBeLessThanOrEqual(MAX_CONFETTI_PARTICLES);
    }
  });

  test('T7: returned configs are the spec objects (no accidental clamping mutation)', () => {
    // Configs already comply with the budget, so no cloned/clamped copies
    expect(getConfettiConfig('pr')).toBe(PR_CONFETTI);
  });
});

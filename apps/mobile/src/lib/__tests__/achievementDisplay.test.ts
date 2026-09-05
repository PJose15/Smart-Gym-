import {
  getBadgeEmoji,
  getBadgeProgress,
  getPointsTier,
  POINTS_TIER_COLORS,
  POINTS_TIER_LABELS,
} from '../achievementDisplay';
import { colors } from '../../theme/colors';
import type { BadgeWithStatus } from '../badgeService';

function makeBadge(overrides: Partial<BadgeWithStatus> = {}): BadgeWithStatus {
  return {
    id: 'b-1',
    code: 'sessions-10',
    title: 'Getting Started',
    description: 'Logged 10 workout sessions',
    category: 'milestone',
    points: 100,
    required_value: 10,
    required_unit: 'sessions',
    icon_name: null,
    sort_order: 20,
    unlocked: false,
    earned_at: null,
    ...overrides,
  };
}

describe('getPointsTier', () => {
  it('maps boundaries: bronze <200, silver 200-499, gold >=500', () => {
    expect(getPointsTier(50)).toBe('bronze');
    expect(getPointsTier(199)).toBe('bronze');
    expect(getPointsTier(200)).toBe('silver');
    expect(getPointsTier(499)).toBe('silver');
    expect(getPointsTier(500)).toBe('gold');
    expect(getPointsTier(3000)).toBe('gold');
  });

  it('has matching color and label maps using metallic tokens', () => {
    expect(POINTS_TIER_COLORS.bronze).toBe(colors.bronze);
    expect(POINTS_TIER_COLORS.silver).toBe(colors.silver);
    expect(POINTS_TIER_COLORS.gold).toBe(colors.gold);
    expect(POINTS_TIER_LABELS.gold).toBe('Gold');
  });
});

describe('getBadgeEmoji', () => {
  it('falls back to category defaults', () => {
    expect(getBadgeEmoji(makeBadge({ code: 'sessions-10', category: 'milestone' }))).toBe('🏆');
    expect(getBadgeEmoji(makeBadge({ code: 'prs-10', category: 'performance' }))).toBe('💪');
    expect(getBadgeEmoji(makeBadge({ code: 'streak-7', category: 'consistency' }))).toBe('🔥');
    expect(getBadgeEmoji(makeBadge({ code: 'machines-10', category: 'explorer' }))).toBe('🧭');
    expect(getBadgeEmoji(makeBadge({ code: 'challenge-join', category: 'community' }))).toBe('🤝');
  });

  it('prefers per-code overrides over category defaults', () => {
    expect(getBadgeEmoji(makeBadge({ code: 'challenge-win', category: 'community' }))).toBe('🥇');
  });
});

describe('getBadgeProgress', () => {
  it('derives session-count progress', () => {
    const progress = getBadgeProgress(
      makeBadge({ required_value: 10, required_unit: 'sessions' }),
      { sessions: 3 },
    );
    expect(progress).not.toBeNull();
    expect(progress!.current).toBe(3);
    expect(progress!.target).toBe(10);
    expect(progress!.ratio).toBeCloseTo(0.3);
    expect(progress!.label).toContain('3/10');
    expect(progress!.label).toContain('sessions');
    expect(progress!.label).toContain('7 to go');
  });

  it('derives volume progress with invariant lbs unit', () => {
    const progress = getBadgeProgress(
      makeBadge({ required_value: 10000, required_unit: 'lbs' }),
      { lbs: 2500 },
    );
    expect(progress!.ratio).toBe(0.25);
    expect(progress!.label).toContain('lbs');
    expect(progress!.label).not.toContain('lbss');
  });

  it('derives day-streak progress', () => {
    const progress = getBadgeProgress(
      makeBadge({ required_value: 30, required_unit: 'days' }),
      { days: 15 },
    );
    expect(progress!.current).toBe(15);
    expect(progress!.ratio).toBe(0.5);
    expect(progress!.label).toContain('days');
  });

  it('derives PR progress', () => {
    const progress = getBadgeProgress(
      makeBadge({ required_value: 5, required_unit: 'prs' }),
      { prs: 4 },
    );
    expect(progress!.current).toBe(4);
    expect(progress!.label).toContain('PRs');
    expect(progress!.label).toContain('1 to go');
  });

  it('returns null when the required stat is unavailable', () => {
    expect(
      getBadgeProgress(makeBadge({ required_value: 10, required_unit: 'sessions' }), {}),
    ).toBeNull();
    expect(
      getBadgeProgress(makeBadge({ required_value: 5, required_unit: 'prs' }), { sessions: 3 }),
    ).toBeNull();
  });

  it('returns null for unknown units', () => {
    expect(
      getBadgeProgress(makeBadge({ required_value: 5, required_unit: 'widgets' }), { sessions: 3 }),
    ).toBeNull();
    expect(
      getBadgeProgress(makeBadge({ required_value: 5, required_unit: null }), { sessions: 3 }),
    ).toBeNull();
  });

  it('returns null for missing or invalid required_value', () => {
    expect(
      getBadgeProgress(makeBadge({ required_value: null, required_unit: 'sessions' }), { sessions: 3 }),
    ).toBeNull();
    expect(
      getBadgeProgress(makeBadge({ required_value: 0, required_unit: 'machines' }), { machines: 3 }),
    ).toBeNull();
    expect(
      getBadgeProgress(makeBadge({ required_value: NaN, required_unit: 'sessions' }), { sessions: 3 }),
    ).toBeNull();
  });

  it('clamps overshoot to the target (ready to unlock)', () => {
    const progress = getBadgeProgress(
      makeBadge({ required_value: 10, required_unit: 'sessions' }),
      { sessions: 25 },
    );
    expect(progress!.current).toBe(10);
    expect(progress!.ratio).toBe(1);
    expect(progress!.label).toContain('Ready to unlock');
  });

  it('handles NaN stat values as unavailable', () => {
    expect(
      getBadgeProgress(makeBadge({ required_value: 10, required_unit: 'sessions' }), { sessions: NaN }),
    ).toBeNull();
  });
});

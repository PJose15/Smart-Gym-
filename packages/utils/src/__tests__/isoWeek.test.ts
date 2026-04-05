import { describe, it, expect } from 'vitest';
import { getISOWeekKey } from '../index';

describe('getISOWeekKey', () => {
  it('returns a consistent week key for mid-year dates', () => {
    // 2026-03-11 is a Wednesday
    const key = getISOWeekKey(new Date(2026, 2, 11));
    expect(key).toMatch(/^2026-W\d{2}$/);
  });

  it('returns same key for all days in the same week', () => {
    // 2026-03-09 (Monday) through 2026-03-15 (Sunday) should all be same week
    const monday = getISOWeekKey(new Date(2026, 2, 9));
    const wednesday = getISOWeekKey(new Date(2026, 2, 11));
    const sunday = getISOWeekKey(new Date(2026, 2, 15));
    expect(monday).toBe(wednesday);
    expect(wednesday).toBe(sunday);
  });

  it('consecutive weeks have different keys', () => {
    const week1 = getISOWeekKey(new Date(2026, 2, 9));  // Mon Mar 9
    const week2 = getISOWeekKey(new Date(2026, 2, 16)); // Mon Mar 16
    expect(week1).not.toBe(week2);
  });

  it('handles leap year Feb 29', () => {
    expect(getISOWeekKey(new Date(2024, 1, 29))).toBe('2024-W09');
  });

  it('adjacent days at year boundary are in the same week', () => {
    // Dec 29, 2025 (Monday) and Jan 4, 2026 (Sunday)
    const dec29 = getISOWeekKey(new Date(2025, 11, 29));
    const jan4 = getISOWeekKey(new Date(2026, 0, 4));
    expect(dec29).toBe(jan4);
  });

  it('year-boundary weeks produce valid keys', () => {
    const jan1 = getISOWeekKey(new Date(2026, 0, 1));
    const dec31 = getISOWeekKey(new Date(2025, 11, 31));
    // Both should have the same week key (same ISO week)
    expect(jan1).toBe(dec31);
    // Should be a valid format
    expect(jan1).toMatch(/^\d{4}-W\d{2}$/);
  });

  it('produces different keys for different weeks throughout the year', () => {
    const keys = new Set<string>();
    // Sample one date per month
    for (let m = 0; m < 12; m++) {
      keys.add(getISOWeekKey(new Date(2026, m, 15)));
    }
    // Should have at least 11 distinct weeks (some months may share a week)
    expect(keys.size).toBeGreaterThanOrEqual(11);
  });

  it('handles dates far in the past', () => {
    const key = getISOWeekKey(new Date(2000, 0, 1));
    expect(key).toMatch(/^\d{4}-W\d{2}$/);
  });

  it('handles dates far in the future', () => {
    const key = getISOWeekKey(new Date(2050, 5, 15));
    expect(key).toMatch(/^\d{4}-W\d{2}$/);
  });
});

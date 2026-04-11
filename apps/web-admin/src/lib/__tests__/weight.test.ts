import {
  convertFromLbs,
  convertToLbs,
  formatWeight,
  formatVolume,
  unitLabel,
} from '../weight';

describe('convertFromLbs', () => {
  it('returns lbs unchanged', () => {
    expect(convertFromLbs(225, 'lbs')).toBe(225);
    expect(convertFromLbs(0, 'lbs')).toBe(0);
  });

  it('converts lbs → kg using the 0.45359237 factor', () => {
    expect(convertFromLbs(100, 'kg')).toBeCloseTo(45.359237, 5);
    expect(convertFromLbs(225, 'kg')).toBeCloseTo(102.06, 1);
  });
});

describe('convertToLbs', () => {
  it('is the inverse of convertFromLbs', () => {
    const lbs = 315;
    const kg = convertFromLbs(lbs, 'kg');
    expect(convertToLbs(kg, 'kg')).toBeCloseTo(lbs, 5);
  });

  it('returns lbs unchanged when unit is lbs', () => {
    expect(convertToLbs(225, 'lbs')).toBe(225);
  });
});

describe('formatWeight', () => {
  it('formats lbs as integer + unit', () => {
    expect(formatWeight(225, 'lbs')).toBe('225 lbs');
    expect(formatWeight(0, 'lbs')).toBe('0 lbs');
  });

  it('formats large lbs with thousands separators', () => {
    expect(formatWeight(1234, 'lbs')).toBe('1,234 lbs');
  });

  it('formats kg as integer when ≥ 10', () => {
    // 225 lbs → ~102.06 kg → "102 kg"
    expect(formatWeight(225, 'kg')).toBe('102 kg');
  });

  it('formats kg with one decimal when < 10', () => {
    // 15 lbs → ~6.8 kg
    expect(formatWeight(15, 'kg')).toBe('6.8 kg');
  });

  it('can suppress the unit suffix', () => {
    expect(formatWeight(225, 'lbs', { showUnit: false })).toBe('225');
    expect(formatWeight(225, 'kg', { showUnit: false })).toBe('102');
  });
});

describe('formatVolume', () => {
  it('uses k-suffix for ≥ 1000 in lbs', () => {
    expect(formatVolume(125_000, 'lbs')).toBe('125.0k lbs');
    expect(formatVolume(1_500, 'lbs')).toBe('1.5k lbs');
  });

  it('stays numeric under 1000 in lbs', () => {
    expect(formatVolume(850, 'lbs')).toBe('850 lbs');
  });

  it('converts before applying the k-threshold', () => {
    // 125000 lbs → ~56700 kg → "56.7k kg"
    expect(formatVolume(125_000, 'kg')).toBe('56.7k kg');
    // 2000 lbs → ~907 kg → under threshold, integer
    expect(formatVolume(2000, 'kg')).toBe('907 kg');
  });
});

describe('unitLabel', () => {
  it('returns the unit string', () => {
    expect(unitLabel('lbs')).toBe('lbs');
    expect(unitLabel('kg')).toBe('kg');
  });
});

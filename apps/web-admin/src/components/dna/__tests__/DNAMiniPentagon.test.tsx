/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render } from '@testing-library/react';
import { DNAMiniPentagon } from '../DNAMiniPentagon';
import { MemberAvatar } from '../../ui/MemberAvatar';
import type { DNAScores, DNAResult } from '@nexera/types';

const mockScores: DNAScores = {
  power: 75,
  consistency: 60,
  balance: 80,
  mindset: 45,
  progression: 90,
};

const mockDna: DNAResult = {
  scores: mockScores,
  previous_scores: null,
  archetype: {
    id: 'powerhouse',
    name: 'Powerhouse',
    description: 'Strength-focused',
    color: '#EF4444',
    icon: '💪',
    coaching_focus: 'Heavy compounds',
  },
  previous_archetype: null,
  archetype_changed: false,
  is_building: false,
  sessions_logged: 25,
  distinct_machines: 10,
  signals: {
    power: {},
    consistency: {},
    balance: {},
    mindset: {},
    progression: {},
  },
  history: [],
  computed_at: '2026-03-29T00:00:00Z',
};

// T1: SVG renders with correct viewBox
test('renders SVG with correct viewBox', () => {
  const { container } = render(
    <DNAMiniPentagon scores={mockScores} archetypeColor="#EF4444" size={56} />
  );
  const svg = container.querySelector('svg');
  expect(svg).toBeTruthy();
  expect(svg?.getAttribute('viewBox')).toBe('0 0 56 56');
  expect(svg?.getAttribute('width')).toBe('56');
  expect(svg?.getAttribute('height')).toBe('56');
});

// T2: All 5 score dots render
test('renders all 5 score dots', () => {
  const { container } = render(
    <DNAMiniPentagon scores={mockScores} archetypeColor="#EF4444" size={56} />
  );
  const dots = container.querySelectorAll('.pentagon-dot');
  expect(dots).toHaveLength(5);
});

// T3: Polygon path closes (ends with Z)
test('polygon path closes with Z', () => {
  const { container } = render(
    <DNAMiniPentagon scores={mockScores} archetypeColor="#EF4444" size={56} />
  );
  const strokePath = container.querySelector('.pentagon-stroke');
  const d = strokePath?.getAttribute('d') || '';
  expect(d.trim().endsWith('Z')).toBe(true);
});

// T4: archetypeColor applied to stroke
test('archetypeColor applied to polygon stroke', () => {
  const { container } = render(
    <DNAMiniPentagon scores={mockScores} archetypeColor="#22C55E" size={56} />
  );
  const strokePath = container.querySelector('.pentagon-stroke');
  expect(strokePath?.getAttribute('stroke')).toBe('#22C55E');
});

// T5: animated=false skips animation class
test('animated=false does not add animate class', () => {
  const { container } = render(
    <DNAMiniPentagon scores={mockScores} archetypeColor="#EF4444" size={56} animated={false} />
  );
  const svg = container.querySelector('svg');
  expect(svg?.classList.contains('animate')).toBe(false);
});

// T6: All scores at 0 — minimum radius visible
test('all scores at 0 still renders visible polygon (min radius)', () => {
  const zeroScores: DNAScores = {
    power: 0, consistency: 0, balance: 0, mindset: 0, progression: 0,
  };
  const { container } = render(
    <DNAMiniPentagon scores={zeroScores} archetypeColor="#EF4444" size={56} />
  );
  const strokePath = container.querySelector('.pentagon-stroke');
  const d = strokePath?.getAttribute('d') || '';
  // With min radius, points should not all be at center (28,28)
  expect(d).not.toContain('28,28 L 28,28');
});

// T7: All scores at 100 — fills to max radius
test('all scores at 100 renders full-sized polygon', () => {
  const maxScores: DNAScores = {
    power: 100, consistency: 100, balance: 100, mindset: 100, progression: 100,
  };
  const { container } = render(
    <DNAMiniPentagon scores={maxScores} archetypeColor="#EF4444" size={56} />
  );
  const strokePath = container.querySelector('.pentagon-stroke');
  const d = strokePath?.getAttribute('d') || '';
  expect(d.startsWith('M ')).toBe(true);
  expect(d.endsWith('Z')).toBe(true);
});

// T8: aria-hidden="true" present
test('SVG has aria-hidden="true"', () => {
  const { container } = render(
    <DNAMiniPentagon scores={mockScores} archetypeColor="#EF4444" size={56} />
  );
  const svg = container.querySelector('svg');
  expect(svg?.getAttribute('aria-hidden')).toBe('true');
});

// T9: MemberAvatar shows pentagon when dna provided and not building
test('MemberAvatar shows pentagon when dna provided', () => {
  const { container } = render(
    <MemberAvatar name="Alex" dna={mockDna} />
  );
  const pentagon = container.querySelector('.dna-mini-pentagon');
  expect(pentagon).toBeTruthy();
});

// T10: MemberAvatar shows level ring when dna.is_building = true
test('MemberAvatar shows level ring when dna is building', () => {
  const buildingDna: DNAResult = { ...mockDna, is_building: true };
  const { container } = render(
    <MemberAvatar name="Alex" dna={buildingDna} level={5} levelColor="#22C55E" />
  );
  const pentagon = container.querySelector('.dna-mini-pentagon');
  expect(pentagon).toBeNull();
  const levelRing = container.querySelector('[data-testid="level-ring"]');
  expect(levelRing).toBeTruthy();
});

// T11: MemberAvatar shows level ring when dna = null but level provided
test('MemberAvatar shows level ring when no dna but level provided', () => {
  const { container } = render(
    <MemberAvatar name="Alex" dna={null} level={3} levelColor="#3B82F6" />
  );
  const pentagon = container.querySelector('.dna-mini-pentagon');
  expect(pentagon).toBeNull();
  const levelRing = container.querySelector('[data-testid="level-ring"]');
  expect(levelRing).toBeTruthy();
});

// T12: MemberAvatar shows skeleton when no dna and no level
test('MemberAvatar shows skeleton when no dna and no level', () => {
  const { container } = render(
    <MemberAvatar name="Alex" />
  );
  const pentagon = container.querySelector('.dna-mini-pentagon');
  expect(pentagon).toBeNull();
  const levelRing = container.querySelector('[data-testid="level-ring"]');
  expect(levelRing).toBeNull();
  const skeleton = container.querySelector('[data-testid="skeleton-ring"]');
  expect(skeleton).toBeTruthy();
});

// L6: animated=true adds the animate class
test('animated=true adds animate class', () => {
  const { container } = render(
    <DNAMiniPentagon scores={mockScores} archetypeColor="#EF4444" size={56} animated={true} />
  );
  const svg = container.querySelector('svg');
  expect(svg?.classList.contains('animate')).toBe(true);
});

// L7: onPentagonTap renders button with aria-label
test('MemberAvatar renders pentagon tap button when onPentagonTap provided', () => {
  const handler = jest.fn();
  const { container } = render(
    <MemberAvatar name="Alex" dna={mockDna} onPentagonTap={handler} />
  );
  const btn = container.querySelector('.pentagon-ring-btn');
  expect(btn).toBeTruthy();
  expect(btn?.getAttribute('aria-label')).toBe('View your Performance DNA');
});

// L7b: no button when onPentagonTap not provided
test('MemberAvatar does not render tap button when onPentagonTap absent', () => {
  const { container } = render(
    <MemberAvatar name="Alex" dna={mockDna} />
  );
  const btn = container.querySelector('.pentagon-ring-btn');
  expect(btn).toBeNull();
});

// L8: empty name shows fallback initial
test('MemberAvatar shows ? for empty name', () => {
  const { container } = render(
    <MemberAvatar name="" />
  );
  const avatar = container.querySelector('.member-avatar');
  expect(avatar?.textContent).toBe('?');
});

// L9: src renders img element
test('MemberAvatar renders img when src provided', () => {
  const { container } = render(
    <MemberAvatar name="Alex" src="https://example.com/photo.jpg" />
  );
  const img = container.querySelector('img');
  expect(img).toBeTruthy();
  expect(img?.getAttribute('src')).toBe('https://example.com/photo.jpg');
  expect(img?.getAttribute('alt')).toBe('Alex');
});

// L9b: no src renders initials
test('MemberAvatar renders initials when no src', () => {
  const { container } = render(
    <MemberAvatar name="Alex" />
  );
  const img = container.querySelector('img');
  expect(img).toBeNull();
  const avatar = container.querySelector('.member-avatar');
  expect(avatar?.textContent).toBe('A');
});

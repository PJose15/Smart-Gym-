'use client';

import type { HeroStateData, LevelInfoData, MuscleMapResult, DNAResult } from '@nexera/types';
import { CSSProperties } from 'react';
import { HeroMuscleAmbient } from './HeroMuscleAmbient';
import { MemberAvatar } from '@/components/ui/MemberAvatar';
import { StreakFlame } from '@/components/gamification/StreakFlame';

interface HeroZoneProps {
  hero: HeroStateData;
  level: LevelInfoData;
  avatarUrl?: string | null;
  muscleMap?: MuscleMapResult | null;
  dna?: DNAResult | null;
  /** Member first name — rendered as the serif brand moment (mobile HeroZone parity) */
  name?: string | null;
  /** Current streak (weeks) — rendered as the streak pill on the identity row */
  streak?: number;
}

/**
 * HeroZone — mirrors apps/mobile/src/components/home/HeroZone.tsx:
 * featured 22px card on a near-black gradient with an accent corner glow,
 * identity row (avatar with level dot + uppercase greeting kicker in accent
 * + serif name 30px + streak pill), headline + subline message block, and
 * a mono metric pill. No drop shadows — emissive glow only.
 */
export function HeroZone({ hero, level, avatarUrl, muscleMap, dna, name, streak = 0 }: HeroZoneProps) {
  const accent = hero.accent || 'var(--accent, #E0142F)';

  // Web hero.greeting includes the name ("Good morning, Alice") — the mobile
  // kicker is just the time greeting; the name gets its own serif line.
  const kicker = hero.greeting.split(',')[0];
  const displayName = name || hero.greeting.split(',').pop()?.replace(/\.$/, '').trim() || '';

  const containerStyle: CSSProperties = {
    // Near-black card gradient + emissive accent corner glow (no drop shadows)
    background:
      'linear-gradient(145deg, var(--color-bg-elevated) 0%, var(--color-bg-base) 70%)',
    border: '1px solid var(--color-border-subtle)',
    borderRadius: 'var(--radius-xl, 22px)',
    padding: 'var(--space-6, 24px)',
    position: 'relative',
    overflow: 'hidden',
    animation: 'slideUpFade 0.4s ease-out both',
  };

  return (
    <div style={containerStyle}>
      {/* Emissive corner glow — tonal depth, accent-tinted (mobile accentGlow) */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: -70,
          right: -50,
          width: 220,
          height: 220,
          borderRadius: '50%',
          backgroundColor: accent,
          opacity: 0.14,
          pointerEvents: 'none',
        }}
      />

      {/* Ambient muscle silhouette — behind all hero content */}
      <HeroMuscleAmbient muscleMap={muscleMap ?? null} />

      {/* Hero content — sits above ambient layer */}
      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Identity row: avatar with level dot, greeting kicker + serif name, streak pill */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <MemberAvatar
            src={avatarUrl}
            name={displayName}
            size="medium"
            level={level.level}
            levelColor={level.color}
            dna={dna}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Uppercase greeting kicker — accent color (mobile parity) */}
            <div style={{
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: accent,
            }}>
              {kicker}
            </div>
            {/* Serif brand moment — the name (Playfair Display, 30px) */}
            <div style={{
              fontSize: 30,
              fontWeight: 700,
              fontFamily: 'var(--font-serif)',
              color: 'var(--color-text-primary)',
              marginTop: 2,
              lineHeight: 1.15,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {displayName}
            </div>
          </div>
          {streak > 0 && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid var(--color-border-subtle)',
              borderRadius: 'var(--radius-full, 9999px)',
              padding: '5px 12px',
              flexShrink: 0,
            }}>
              <StreakFlame streakDays={streak * 7} size={14} />
              <span style={{
                fontSize: 14,
                fontWeight: 700,
                fontFamily: 'var(--font-mono)',
                color: 'var(--color-amber, #FF6B35)',
              }}>
                {streak}
              </span>
            </div>
          )}
        </div>

        {/* Dynamic message block */}
        <div>
          <h1 style={{
            margin: 0,
            fontSize: 20,
            fontWeight: 600,
            color: 'var(--color-text-primary)',
            lineHeight: 1.3,
          }}>
            {hero.headline}
          </h1>
          <p style={{
            margin: 0,
            marginTop: 6,
            fontSize: 14,
            color: 'var(--color-text-secondary)',
            lineHeight: 1.4,
          }}>
            {hero.subline}
          </p>
        </div>

        {/* Hero metric — mono pill, numbers are heroes */}
        {hero.metric && (
          <div style={{
            alignSelf: 'flex-start',
            display: 'flex',
            alignItems: 'baseline',
            gap: 10,
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid var(--color-border-subtle)',
            borderRadius: 12,
            padding: '10px 16px',
          }}>
            <span style={{
              fontSize: 24,
              fontWeight: 700,
              fontFamily: 'var(--font-mono)',
              letterSpacing: '-0.02em',
              color: accent,
            }}>
              {hero.metric}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

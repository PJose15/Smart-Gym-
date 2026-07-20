'use client';

import type { HeroStateData, LevelInfoData, MuscleMapResult, DNAResult } from '@nexera/types';
import { CSSProperties } from 'react';
import { HeroMuscleAmbient } from './HeroMuscleAmbient';
import { MemberAvatar } from '@/components/ui/MemberAvatar';

interface HeroZoneProps {
  hero: HeroStateData;
  level: LevelInfoData;
  avatarUrl?: string | null;
  muscleMap?: MuscleMapResult | null;
  dna?: DNAResult | null;
}

/**
 * HeroZone — NEXTERA Red-Luxury treatment (design/stitch):
 * featured 22px card on a near-black gradient with a crimson corner glow,
 * energy-ribbon top accent, serif greeting name, mono metric numeral.
 */
export function HeroZone({ hero, level, avatarUrl, muscleMap, dna }: HeroZoneProps) {
  const containerStyle: CSSProperties = {
    // Near-black card gradient + emissive crimson corner glow (no drop shadows)
    background:
      'radial-gradient(circle at 85% -10%, rgba(224, 20, 47, 0.28) 0%, transparent 55%), ' +
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
      {/* Energy ribbon — 2px crimson gradient top accent */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 2,
          background: 'linear-gradient(90deg, var(--accent-hover, #FF2740), var(--accent-pressed, #8A0D1E))',
        }}
      />

      {/* Ambient muscle silhouette — behind all hero content */}
      <HeroMuscleAmbient muscleMap={muscleMap ?? null} />

      {/* Hero content — sits above ambient layer */}
      <div style={{ position: 'relative', zIndex: 1 }}>
        {/* Avatar + Greeting row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <MemberAvatar
            src={avatarUrl}
            name={hero.greeting.split(' ').pop() || ''}
            size="medium"
            level={level.level}
            levelColor={level.color}
            dna={dna}
          />
          <div>
            {/* Serif brand moment — the greeting (Playfair Display) */}
            <div style={{
              fontSize: 17,
              color: 'var(--color-text-primary)',
              fontWeight: 600,
              fontFamily: 'var(--font-serif)',
              letterSpacing: '0.01em',
            }}>
              {hero.greeting}
            </div>
            <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 2 }}>
              Level <span style={{ fontFamily: 'var(--font-mono)' }}>{level.level}</span> — {level.name}
            </div>
          </div>
          {hero.metric && (
            <div style={{
              marginLeft: 'auto',
              backgroundColor: 'var(--accent-subtle, rgba(224, 20, 47, 0.10))',
              border: '1px solid var(--border-accent, rgba(224, 20, 47, 0.28))',
              borderRadius: 'var(--radius-full, 99px)',
              padding: '4px 12px',
              fontSize: 12,
              fontWeight: 700,
              fontFamily: 'var(--font-mono)',
              color: 'var(--accent-hover, #FF2740)',
            }}>
              {hero.metric}
            </div>
          )}
        </div>

        {/* Headline */}
        <h1 style={{
          margin: 0,
          fontSize: 24,
          fontWeight: 800,
          color: 'var(--color-text-primary)',
          lineHeight: 1.2,
        }}>
          {hero.headline}
        </h1>

        {/* Subline */}
        <p style={{
          margin: 0,
          marginTop: 6,
          fontSize: 14,
          color: 'var(--color-text-secondary)',
          lineHeight: 1.4,
        }}>
          {hero.subline}
        </p>

        {/* Level progress bar */}
        <div style={{ marginTop: 16 }}>
          <div style={{
            height: 4,
            backgroundColor: 'rgba(255,255,255,0.08)',
            borderRadius: 2,
            overflow: 'hidden',
          }}>
            <div style={{
              height: '100%',
              width: `${level.progressPct}%`,
              backgroundColor: 'var(--accent, #E0142F)',
              boxShadow: '0 0 12px var(--accent-glow, rgba(224, 20, 47, 0.28))',
              borderRadius: 2,
              transition: 'width 0.6s ease-out',
            }} />
          </div>
          {level.pointsToNext > 0 && (
            <div style={{ fontSize: 10, color: 'var(--color-text-muted)', marginTop: 4 }}>
              <span style={{ fontFamily: 'var(--font-mono)' }}>{level.pointsToNext}</span> pts to next level
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

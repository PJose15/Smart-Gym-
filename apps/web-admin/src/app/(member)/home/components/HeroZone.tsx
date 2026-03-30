'use client';

import type { HeroStateData, LevelInfoData, MuscleMapResult } from '@nexera/types';
import { CSSProperties } from 'react';
import { HeroMuscleAmbient } from './HeroMuscleAmbient';

interface HeroZoneProps {
  hero: HeroStateData;
  level: LevelInfoData;
  avatarUrl?: string | null;
  muscleMap?: MuscleMapResult | null;
}

export function HeroZone({ hero, level, avatarUrl, muscleMap }: HeroZoneProps) {
  const containerStyle: CSSProperties = {
    background: hero.gradient,
    borderRadius: 'var(--radius-lg, 16px)',
    padding: 'var(--space-6, 24px)',
    position: 'relative',
    overflow: 'hidden',
    animation: 'slideUpFade 0.4s ease-out both',
  };

  return (
    <div style={containerStyle}>
      {/* Ambient muscle silhouette — behind all hero content */}
      <HeroMuscleAmbient muscleMap={muscleMap ?? null} />

      {/* Hero content — sits above ambient layer */}
      <div style={{ position: 'relative', zIndex: 1 }}>
        {/* Avatar + Greeting row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div style={{
            width: 44,
            height: 44,
            borderRadius: '50%',
            backgroundColor: 'rgba(255,255,255,0.2)',
            backgroundImage: avatarUrl ? `url(${avatarUrl})` : undefined,
            backgroundSize: 'cover',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 18,
            color: '#fff',
          }}>
            {!avatarUrl && hero.greeting.charAt(hero.greeting.lastIndexOf(' ') + 1)}
          </div>
          <div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)', fontWeight: 500 }}>
              {hero.greeting}
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>
              Level {level.level} — {level.name}
            </div>
          </div>
          {hero.metric && (
            <div style={{
              marginLeft: 'auto',
              backgroundColor: 'rgba(255,255,255,0.15)',
              borderRadius: 'var(--radius-full, 99px)',
              padding: '4px 12px',
              fontSize: 12,
              fontWeight: 700,
              color: '#fff',
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
          color: '#fff',
          lineHeight: 1.2,
        }}>
          {hero.headline}
        </h1>

        {/* Subline */}
        <p style={{
          margin: 0,
          marginTop: 6,
          fontSize: 14,
          color: 'rgba(255,255,255,0.75)',
          lineHeight: 1.4,
        }}>
          {hero.subline}
        </p>

        {/* Level progress bar */}
        <div style={{ marginTop: 16 }}>
          <div style={{
            height: 4,
            backgroundColor: 'rgba(255,255,255,0.15)',
            borderRadius: 2,
            overflow: 'hidden',
          }}>
            <div style={{
              height: '100%',
              width: `${level.progressPct}%`,
              backgroundColor: hero.accent,
              borderRadius: 2,
              transition: 'width 0.6s ease-out',
            }} />
          </div>
          {level.pointsToNext > 0 && (
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>
              {level.pointsToNext} pts to next level
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

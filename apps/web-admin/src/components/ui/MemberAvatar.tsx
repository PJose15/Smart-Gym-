'use client';

import { CSSProperties, useState } from 'react';
import type { DNAResult } from '@nexera/types';
import { DNAMiniPentagon } from '../dna/DNAMiniPentagon';

type AvatarSize = 'xsmall' | 'small' | 'medium' | 'large' | 'xlarge';

interface MemberAvatarProps {
  src?: string | null;
  name: string;
  size?: AvatarSize;
  level?: number;
  levelColor?: string;
  dna?: DNAResult | null;
  className?: string;
  onPentagonTap?: () => void;
}

const AVATAR_SIZE: Record<AvatarSize, number> = {
  xsmall: 24,
  small: 32,
  medium: 40,
  large: 56,
  xlarge: 80,
};

const PENTAGON_SIZE: Record<AvatarSize, number> = {
  xsmall: 32,
  small: 44,
  medium: 56,
  large: 76,
  xlarge: 108,
};

const FONT_SIZE: Record<AvatarSize, number> = {
  xsmall: 10,
  small: 13,
  medium: 16,
  large: 22,
  xlarge: 30,
};

function getInitials(name: string): string {
  return name.charAt(0).toUpperCase() || '?';
}

export function MemberAvatar({
  src,
  name,
  size = 'medium',
  level,
  levelColor,
  dna,
  className = '',
  onPentagonTap,
}: MemberAvatarProps) {
  const [imgError, setImgError] = useState(false);
  const avatarPx = AVATAR_SIZE[size];
  const pentagonPx = PENTAGON_SIZE[size];
  const fontSize = FONT_SIZE[size];
  const showPentagon = dna && !dna.is_building && dna.archetype;
  const showLevelRing = !showPentagon && level != null;
  const animated = size === 'large' || size === 'xlarge';

  // Outer container is sized to the pentagon ring (or avatar + ring padding)
  const outerPx = showPentagon ? pentagonPx : showLevelRing ? avatarPx + 6 : avatarPx;

  const containerStyle: CSSProperties = {
    position: 'relative',
    width: outerPx,
    height: outerPx,
    flexShrink: 0,
  };

  const avatarStyle: CSSProperties = {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: avatarPx,
    height: avatarPx,
    borderRadius: '50%',
    backgroundColor: '#334155',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize,
    fontWeight: 600,
    color: '#F1F5F9',
    overflow: 'hidden',
  };

  const imgStyle: CSSProperties = {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    borderRadius: '50%',
  };

  return (
    <div className={`member-avatar ${className}`.trim()} style={containerStyle}>
      {/* Pentagon ring */}
      {showPentagon && (
        <>
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
            }}
          >
            <DNAMiniPentagon
              scores={dna.scores}
              archetypeColor={dna.archetype.color}
              size={pentagonPx}
              animated={animated}
            />
          </div>
          {onPentagonTap && (
            <button
              className="pentagon-ring-btn"
              onClick={onPentagonTap}
              aria-label="View your Performance DNA"
            />
          )}
        </>
      )}

      {/* Level ring (colored border) */}
      {showLevelRing && (
        <div
          data-testid="level-ring"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: outerPx,
            height: outerPx,
            borderRadius: '50%',
            border: `2px solid ${levelColor || '#EF9F27'}`,
          }}
        />
      )}

      {/* Skeleton ring when no data */}
      {!showPentagon && !showLevelRing && (
        <div
          data-testid="skeleton-ring"
          className="avatar-ring-skeleton"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: outerPx,
            height: outerPx,
            borderRadius: '50%',
            border: '2px solid rgba(255,255,255,0.08)',
          }}
        />
      )}

      {/* Avatar circle */}
      <div style={avatarStyle}>
        {src && !imgError ? (
          <img src={src} alt={name} style={imgStyle} onError={() => setImgError(true)} />
        ) : (
          getInitials(name)
        )}
      </div>
    </div>
  );
}

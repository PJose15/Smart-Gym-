'use client';

import { CSSProperties } from 'react';
import type { FeedReactionCounts, ReactionType } from '@nexera/types';

interface ReactionBarProps {
  reactions: FeedReactionCounts;
  myReactions: ReactionType[];
  onToggle: (type: ReactionType) => void;
}

const REACTION_EMOJI: Record<ReactionType, string> = {
  strength: '\uD83D\uDCAA',
  fire: '\uD83D\uDD25',
  champion: '\uD83C\uDFC6',
  letsgo: '\uD83D\uDE80',
};

const REACTION_LABEL: Record<ReactionType, string> = {
  strength: 'Strength',
  fire: 'Fire',
  champion: 'Champion',
  letsgo: "Let's go",
};

const barStyle: CSSProperties = {
  display: 'flex',
  gap: 6,
  marginTop: 8,
};

function btnStyle(isActive: boolean): CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: '4px 10px',
    borderRadius: 20,
    border: 'none',
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 600,
    backgroundColor: isActive ? 'var(--accent-subtle, rgba(224, 20, 47, 0.10))' : 'rgba(255, 255, 255, 0.06)',
    color: isActive ? 'var(--accent-hover, #FF2740)' : 'var(--color-text-secondary)',
    transition: 'all 0.15s ease',
  };
}

export function ReactionBar({ reactions, myReactions, onToggle }: ReactionBarProps) {
  const types: ReactionType[] = ['strength', 'fire', 'champion', 'letsgo'];

  return (
    <div style={barStyle} role="group" aria-label="Reactions">
      {types.map(type => {
        const count = reactions[type];
        const isActive = myReactions.includes(type);
        const label = `${REACTION_LABEL[type]} reaction${count > 0 ? ` (${count})` : ''}`;
        return (
          <button
            key={type}
            type="button"
            style={btnStyle(isActive)}
            onClick={() => onToggle(type)}
            title={REACTION_LABEL[type]}
            aria-pressed={isActive}
            aria-label={label}
          >
            <span aria-hidden="true">{REACTION_EMOJI[type]}</span>
            {count > 0 && <span>{count}</span>}
          </button>
        );
      })}
    </div>
  );
}

'use client';

import { useCelebrationStore } from '@/lib/stores/celebrationStore';
import { AchievementUnlock, deriveRarityFromPoints } from './AchievementUnlock';
import { AchievementNotification } from './AchievementNotification';
import { LevelUpOverlay } from './LevelUpOverlay';

interface CelebrationManagerProps {
  /**
   * takeover (default) — full-screen AchievementUnlock per DOC_03 §9.
   * toast — small AchievementNotification for non-immersive contexts
   * (e.g. staff/admin surfaces).
   */
  achievementMode?: 'takeover' | 'toast';
}

export function CelebrationManager({ achievementMode = 'takeover' }: CelebrationManagerProps) {
  const { current, dismiss } = useCelebrationStore();

  if (!current) return null;

  if (current.type === 'level-up') {
    return (
      <LevelUpOverlay
        level={current.level}
        name={current.name}
        color={current.color}
        onDismiss={dismiss}
      />
    );
  }

  if (achievementMode === 'toast') {
    return (
      <AchievementNotification
        title={current.title}
        points={current.points}
        onDismiss={dismiss}
      />
    );
  }

  return (
    <AchievementUnlock
      achievement={{
        id: current.code,
        name: current.title,
        description: current.description ?? '',
        icon: current.icon ?? '🏆',
        points: current.points,
        rarity: current.rarity ?? deriveRarityFromPoints(current.points),
      }}
      onDismiss={dismiss}
    />
  );
}

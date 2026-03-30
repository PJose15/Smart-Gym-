'use client';

import { useCelebrationStore } from '@/lib/stores/celebrationStore';
import { AchievementNotification } from './AchievementNotification';
import { LevelUpOverlay } from './LevelUpOverlay';

export function CelebrationManager() {
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

  return (
    <AchievementNotification
      title={current.title}
      points={current.points}
      onDismiss={dismiss}
    />
  );
}

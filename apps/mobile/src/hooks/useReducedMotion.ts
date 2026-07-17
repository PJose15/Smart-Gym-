/**
 * useReducedMotion — respects the OS-level "Reduce Motion" accessibility
 * setting. Per DOC_03 Section 15, every animation must have a reduced-motion
 * alternative (skip or render final state instantly).
 */
import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

export function useReducedMotion(): boolean {
  const [isReducedMotion, setIsReducedMotion] = useState(false);

  useEffect(() => {
    let mounted = true;

    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (mounted) setIsReducedMotion(enabled);
      })
      .catch(() => {
        // Web / unsupported platforms — leave motion enabled
      });

    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setIsReducedMotion,
    );

    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  return isReducedMotion;
}

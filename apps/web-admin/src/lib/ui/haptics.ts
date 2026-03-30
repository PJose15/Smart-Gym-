/** Thin wrapper around the Vibration API — safe on all platforms */
export const haptics = {
  /** 10ms tap — the lightest possible feedback */
  light() {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(10);
    }
  },

  /** Double-tap pattern — celebratory feedback for PRs / achievements */
  success() {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate([15, 50, 15]);
    }
  },
};

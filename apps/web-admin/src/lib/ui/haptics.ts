/** Thin wrapper around the Vibration API — safe on all platforms */
export const haptics = {
  /** 10ms tap — the lightest possible feedback */
  light() {
    try {
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate(10);
      }
    } catch { /* Vibration API not supported or blocked */ }
  },

  /** Double-tap pattern — celebratory feedback for PRs / achievements */
  success() {
    try {
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate([15, 50, 15]);
      }
    } catch { /* Vibration API not supported or blocked */ }
  },

  /** 3-burst celebration — stronger pattern for day/program completion */
  celebration() {
    try {
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate([20, 40, 20, 40, 30]);
      }
    } catch { /* Vibration API not supported or blocked */ }
  },
};

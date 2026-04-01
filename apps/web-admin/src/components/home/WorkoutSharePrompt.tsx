'use client';

import { CSSProperties, useEffect, useState, useCallback } from 'react';

interface WorkoutSharePromptProps {
  memberId: string;
  gymId: string;
  /** member_settings.share_prs_to_feed */
  sharePrsEnabled: boolean;
  /** gym.show_gym_feed */
  gymFeedEnabled: boolean;
  /** Whether gym is currently open (between open/close hours) */
  gymIsOpen: boolean;
  /** member_settings.workout_sharing_dismissed — permanent dismiss */
  permanentlyDismissed: boolean;
  /** Whether member already shared today */
  alreadySharedToday: boolean;
  /** Whether member already logged a session today */
  alreadyLoggedToday: boolean;
  onShare: () => void;
  onDismiss: () => void;
  onPermanentDismiss: () => void;
}

const AUTO_DISMISS_MS = 8000;

const bannerStyle: CSSProperties = {
  backgroundColor: 'var(--color-bg-raised)',
  borderRadius: 12,
  padding: 14,
  border: '1px solid rgba(59, 130, 246, 0.2)',
  animation: 'slideUpFade 0.4s ease-out both',
};

const fadeOutKeyframes = `
@keyframes promptFadeOut {
  0% { opacity: 1; transform: translateY(0); }
  100% { opacity: 0; transform: translateY(-8px); }
}
`;

export function WorkoutSharePrompt({
  memberId,
  gymId,
  sharePrsEnabled,
  gymFeedEnabled,
  gymIsOpen,
  permanentlyDismissed,
  alreadySharedToday,
  alreadyLoggedToday,
  onShare,
  onDismiss,
  onPermanentDismiss,
}: WorkoutSharePromptProps) {
  const [visible, setVisible] = useState(true);
  const [fadingOut, setFadingOut] = useState(false);

  // 5 display conditions — ALL must be true
  const shouldShow =
    !alreadyLoggedToday &&     // 1. NOT logged session today
    !alreadySharedToday &&     // 2. NOT already shared today
    sharePrsEnabled &&          // 3. share_prs_to_feed = true
    gymFeedEnabled &&           // 4. show_gym_feed = true
    gymIsOpen &&                // 5. between gym open/close
    !permanentlyDismissed;      // 6. NOT permanently dismissed

  const dismiss = useCallback(() => {
    setFadingOut(true);
    setTimeout(() => {
      setVisible(false);
      onDismiss();
    }, 300);
  }, [onDismiss]);

  // 8-second auto-dismiss (regular dismiss, not permanent)
  useEffect(() => {
    if (!shouldShow || !visible) return;
    const timer = setTimeout(dismiss, AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [shouldShow, visible, dismiss]);

  if (!shouldShow || !visible) return null;

  return (
    <>
      <style>{fadeOutKeyframes}</style>
      <div
        style={{
          ...bannerStyle,
          animation: fadingOut
            ? 'promptFadeOut 0.3s ease-out forwards'
            : 'slideUpFade 0.4s ease-out both',
        }}
      >
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <div style={{
            width: 36,
            height: 36,
            borderRadius: '50%',
            backgroundColor: 'rgba(59, 130, 246, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 16,
            flexShrink: 0,
          }}>
            📢
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 4 }}>
              Share your workout?
            </div>
            <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', lineHeight: 1.4, marginBottom: 10 }}>
              Let gym members know you&apos;re training today
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => {
                  onShare();
                  setVisible(false);
                }}
                style={{
                  padding: '6px 14px',
                  borderRadius: 8,
                  border: 'none',
                  backgroundColor: 'var(--color-blue)',
                  color: 'var(--color-text-primary)',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                Share
              </button>
              <button
                onClick={dismiss}
                style={{
                  padding: '6px 14px',
                  borderRadius: 8,
                  border: '1px solid var(--color-border-default)',
                  backgroundColor: 'transparent',
                  color: 'var(--color-text-secondary)',
                  fontSize: 12,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                Not now
              </button>
            </div>

            {/* Permanent dismiss link */}
            <button
              onClick={() => {
                onPermanentDismiss();
                setVisible(false);
              }}
              style={{
                marginTop: 8,
                background: 'none',
                border: 'none',
                color: 'var(--color-text-muted)',
                fontSize: 11,
                cursor: 'pointer',
                padding: 0,
                fontFamily: 'inherit',
              }}
            >
              Don&apos;t show this again
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

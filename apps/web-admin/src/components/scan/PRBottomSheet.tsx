'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import type { PRResult } from '@/lib/hooks/usePRDetection';
import { haptics } from '@/lib/ui/haptics';

const PR_LABELS: Record<string, string> = {
  weight: 'WEIGHT PR',
  volume: 'VOLUME PR',
};

const AUTO_DISMISS_MS = 5000;
const EXIT_ANIM_MS = 300;
const SWIPE_THRESHOLD = 60;

interface PRBottomSheetProps {
  prResult: PRResult;
  machineName: string;
  onDismiss: () => void;
}

export function PRBottomSheet({ prResult, machineName, onDismiss }: PRBottomSheetProps) {
  const [exiting, setExiting] = useState(false);
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  // Swipe tracking
  const touchStartY = useRef<number | null>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  const dismiss = useCallback(() => {
    if (exiting) return;
    setExiting(true);
    setTimeout(() => onDismissRef.current(), EXIT_ANIM_MS);
  }, [exiting]);

  // Haptic on mount + auto-dismiss
  useEffect(() => {
    haptics.success();

    const timer = setTimeout(dismiss, AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [dismiss]);

  // Swipe-down to dismiss
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartY.current === null) return;
    const deltaY = e.changedTouches[0].clientY - touchStartY.current;
    touchStartY.current = null;
    if (deltaY > SWIPE_THRESHOLD) {
      dismiss();
    }
  };

  const improvement =
    prResult.previousValue !== null
      ? prResult.value - prResult.previousValue
      : null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={dismiss}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 'var(--z-celebration)',
          backgroundColor: 'rgba(0, 0, 0, 0.3)',
          opacity: exiting ? 0 : 1,
          transition: `opacity ${EXIT_ANIM_MS}ms ease-out`,
        }}
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        className={exiting ? 'pr-bottom-sheet--exiting' : 'pr-bottom-sheet'}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        role="alert"
        aria-live="assertive"
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 'var(--z-celebration)',
          borderTopLeftRadius: 'var(--radius-xl)',
          borderTopRightRadius: 'var(--radius-xl)',
          backgroundColor: 'var(--color-bg-raised)',
          borderTop: '2px solid var(--color-gold)',
          padding: 'var(--space-5) var(--page-padding-x) var(--space-6)',
          boxShadow: '0 -4px 24px rgba(0, 0, 0, 0.25)',
        }}
      >
        {/* Drag handle */}
        <div
          style={{
            width: 36,
            height: 4,
            borderRadius: 2,
            backgroundColor: 'var(--color-border-default)',
            margin: '0 auto var(--space-4)',
          }}
        />

        {/* Content row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-4)',
          }}
        >
          {/* Trophy icon */}
          <div
            style={{
              fontSize: 40,
              lineHeight: 1,
              filter: 'drop-shadow(0 0 12px rgba(239, 159, 39, 0.4))',
              flexShrink: 0,
            }}
          >
            {'\uD83C\uDFC6'}
          </div>

          {/* Text content */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 'var(--text-xs)',
                fontWeight: 'var(--weight-bold)',
                color: 'var(--color-gold)',
                letterSpacing: 'var(--tracking-wider)',
                textTransform: 'uppercase',
                marginBottom: 2,
              }}
            >
              {PR_LABELS[prResult.type] || 'NEW PR'}
            </div>

            <div
              style={{
                fontSize: 'var(--text-2xl)',
                fontWeight: 'var(--weight-bold)',
                fontFamily: 'var(--font-mono)',
                color: 'var(--color-text-primary)',
                lineHeight: 1.1,
              }}
            >
              {prResult.value} lbs
            </div>

            <div
              style={{
                fontSize: 'var(--text-xs)',
                color: 'var(--color-text-muted)',
                marginTop: 2,
              }}
            >
              {machineName}
              {improvement !== null && prResult.improvementPct !== null && (
                <span style={{ color: 'var(--color-gold)', marginLeft: 'var(--space-2)' }}>
                  +{improvement} lbs ({prResult.improvementPct}%)
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Timer bar */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: 3,
            backgroundColor: 'color-mix(in srgb, var(--color-gold) 20%, transparent)',
            overflow: 'hidden',
            borderBottomLeftRadius: 'var(--radius-xl)',
            borderBottomRightRadius: 'var(--radius-xl)',
          }}
        >
          <div
            className="pr-timer-bar"
            style={{
              height: '100%',
              backgroundColor: 'var(--color-gold)',
            }}
          />
        </div>
      </div>
    </>
  );
}

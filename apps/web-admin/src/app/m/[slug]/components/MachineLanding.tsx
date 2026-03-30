'use client';

import { useState } from 'react';
import { useScanFlowStore } from '@/lib/stores/scanFlowStore';
import { ScanPulse } from '@/components/scan/ScanPulse';
import { MusclePill } from './MusclePill';

const CATEGORY_ICONS: Record<string, string> = {
  strength: 'dumbbell',
  cable: 'cable',
  cardio: 'heart',
  functional: 'target',
  other: 'circle',
};

export function MachineLanding() {
  const { machine, goTo } = useScanFlowStore();
  const [showPulse, setShowPulse] = useState(true);

  if (!machine) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div
          style={{
            width: 32,
            height: 32,
            border: '3px solid var(--color-border-default)',
            borderTopColor: 'var(--color-blue)',
            borderRadius: '50%',
            animation: 'spin 0.7s linear infinite',
          }}
        />
      </div>
    );
  }

  const handleStartTracking = () => {
    goTo('auth_phone');
  };

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        padding: 'var(--page-padding-x)',
        paddingTop: 'var(--space-10)',
        paddingBottom: 'var(--space-8)',
      }}
    >
      {/* Gym branding */}
      <div style={{ textAlign: 'center', marginBottom: 'var(--space-8)' }}>
        {machine.gym.logo_url ? (
          <img
            src={machine.gym.logo_url}
            alt={machine.gym.name}
            style={{
              width: 48,
              height: 48,
              borderRadius: 'var(--radius-md)',
              objectFit: 'cover',
              marginBottom: 'var(--space-2)',
            }}
          />
        ) : (
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--color-bg-elevated)',
              border: '1px solid var(--color-border-default)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto',
              marginBottom: 'var(--space-2)',
              fontSize: 'var(--text-lg)',
              fontWeight: 'var(--weight-bold)',
              color: 'var(--color-text-secondary)',
            }}
          >
            {machine.gym.name.charAt(0).toUpperCase()}
          </div>
        )}
        <p
          style={{
            margin: 0,
            fontSize: 'var(--text-xs)',
            color: 'var(--color-text-muted)',
            letterSpacing: 'var(--tracking-wider)',
            textTransform: 'uppercase',
          }}
        >
          {machine.gym.name}
        </p>
      </div>

      {/* Machine image with scan pulse */}
      <div style={{ position: 'relative', marginBottom: 'var(--space-6)' }}>
        {showPulse && (
          <ScanPulse
            color="var(--gym-primary)"
            size="md"
            onComplete={() => setShowPulse(false)}
          />
        )}
        <div
          style={{
            width: '100%',
            aspectRatio: '16/10',
            borderRadius: 'var(--radius-lg)',
            backgroundColor: 'var(--color-bg-raised)',
            border: '1px solid var(--color-border-subtle)',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {machine.demo_image_url ? (
            <img
              src={machine.demo_image_url}
              alt={machine.name}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 'var(--space-2)',
                color: 'var(--color-text-muted)',
              }}
            >
              <span style={{ fontSize: 40, opacity: 0.4 }}>
                {CATEGORY_ICONS[machine.category] === 'heart' ? '\u2764' : '\uD83C\uDFCB'}
              </span>
              <span style={{ fontSize: 'var(--text-xs)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-wider)' }}>
                {machine.category}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Machine name — slides up during pulse */}
      <h1
        className="machine-name-enter"
        style={{
          margin: 0,
          fontSize: 'var(--text-2xl)',
          fontWeight: 'var(--weight-bold)',
          lineHeight: 'var(--leading-tight)',
          color: 'var(--color-text-primary)',
          marginBottom: 'var(--space-2)',
        }}
      >
        {machine.name}
      </h1>

      {/* Location badge */}
      {machine.location_in_gym && (
        <p
          style={{
            margin: 0,
            fontSize: 'var(--text-sm)',
            color: 'var(--color-text-muted)',
            marginBottom: 'var(--space-4)',
          }}
        >
          {machine.location_in_gym}
        </p>
      )}

      {/* Muscle group pills — fades in during pulse */}
      {machine.muscle_groups.length > 0 && (
        <div
          className="machine-muscles-enter"
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 'var(--space-2)',
            marginBottom: 'var(--space-6)',
          }}
        >
          {machine.muscle_groups.map((muscle) => (
            <MusclePill key={muscle} muscle={muscle} />
          ))}
        </div>
      )}

      {/* Instructions preview */}
      {machine.instructions && (
        <div
          style={{
            padding: 'var(--card-padding)',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--color-bg-raised)',
            border: '1px solid var(--color-border-subtle)',
            marginBottom: 'var(--space-6)',
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: 'var(--text-xs)',
              fontWeight: 'var(--weight-medium)',
              color: 'var(--color-text-secondary)',
              textTransform: 'uppercase',
              letterSpacing: 'var(--tracking-wider)',
              marginBottom: 'var(--space-2)',
            }}
          >
            Quick Setup
          </p>
          <p
            style={{
              margin: 0,
              fontSize: 'var(--text-sm)',
              color: 'var(--color-text-secondary)',
              lineHeight: 'var(--leading-relaxed)',
            }}
          >
            {machine.instructions.length > 150
              ? machine.instructions.slice(0, 150) + '...'
              : machine.instructions}
          </p>
        </div>
      )}

      {/* Spacer to push CTA to bottom */}
      <div style={{ flex: 1 }} />

      {/* CTA button */}
      <button
        onClick={handleStartTracking}
        style={{
          width: '100%',
          height: 'var(--tap-target-lg)',
          borderRadius: 'var(--radius-lg)',
          border: 'none',
          backgroundColor: 'var(--gym-primary)',
          color: 'var(--gym-text-on-primary)',
          fontSize: 'var(--text-md)',
          fontWeight: 'var(--weight-bold)',
          fontFamily: 'var(--font-sans)',
          cursor: 'pointer',
          transition: `transform var(--duration-fast) var(--ease-default),
                       box-shadow var(--duration-fast) var(--ease-default)`,
          boxShadow: 'var(--shadow-blue)',
        }}
        onMouseDown={(e) => {
          (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.97)';
        }}
        onMouseUp={(e) => {
          (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)';
        }}
        onTouchStart={(e) => {
          (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.97)';
        }}
        onTouchEnd={(e) => {
          (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)';
        }}
      >
        Start Tracking
      </button>
    </div>
  );
}

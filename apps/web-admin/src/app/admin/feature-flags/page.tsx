'use client';

import { useEffect, useState, useCallback, CSSProperties } from 'react';
import type { PlatformFeatureFlag } from '@nexera/types';
import { CRITICAL_FLAGS } from '@nexera/types';

const spinnerStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  minHeight: 300,
};

const rowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '16px 20px',
  backgroundColor: 'var(--color-bg-raised)',
  borderRadius: 10,
};

const toggleTrackBase: CSSProperties = {
  width: 44,
  height: 24,
  borderRadius: 12,
  cursor: 'pointer',
  border: 'none',
  position: 'relative',
  transition: 'background-color 0.2s',
  flexShrink: 0,
};

const toggleKnob: CSSProperties = {
  width: 18,
  height: 18,
  borderRadius: '50%',
  backgroundColor: 'var(--color-text-primary)',
  position: 'absolute',
  top: 3,
  transition: 'left 0.2s',
};

function formatFlagLabel(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function AdminFeatureFlagsPage() {
  const [flags, setFlags] = useState<PlatformFeatureFlag[]>([]);
  const [error, setError] = useState('');
  const [toggleError, setToggleError] = useState('');
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/feature-flags')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load');
        return res.json();
      })
      .then((data) => {
        setFlags(data);
        setLoading(false);
      })
      .catch(() => {
        setError('Failed to load feature flags.');
        setLoading(false);
      });
  }, []);

  const handleToggle = useCallback(async (flag: PlatformFeatureFlag) => {
    const newEnabled = !flag.is_enabled;
    const isCritical = CRITICAL_FLAGS.includes(flag.flag_key as (typeof CRITICAL_FLAGS)[number]);

    if (isCritical && !newEnabled) {
      const confirmed = window.confirm(
        `"${formatFlagLabel(flag.flag_key)}" is a critical flag. Are you sure you want to disable it?`
      );
      if (!confirmed) return;
    }

    // Snapshot current state for rollback
    setToggleError('');
    let snapshot: PlatformFeatureFlag[] = [];
    setFlags((f) => {
      snapshot = f;
      return f.map((fl) =>
        fl.flag_key === flag.flag_key ? { ...fl, is_enabled: newEnabled } : fl
      );
    });
    setToggling(flag.flag_key);

    try {
      const res = await fetch(`/api/admin/feature-flags/${flag.flag_key}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_enabled: newEnabled }),
      });

      if (!res.ok) throw new Error('Toggle failed');

      const updated = await res.json();
      setFlags((f) => f.map((fl) =>
        fl.flag_key === updated.flag_key ? updated : fl
      ));
    } catch {
      // Rollback using snapshot captured before optimistic update
      setFlags(snapshot);
      setToggleError(`Failed to toggle "${formatFlagLabel(flag.flag_key)}".`);
    } finally {
      setToggling(null);
    }
  }, []);

  if (error) {
    return (
      <div>
        <h1 style={{ margin: '0 0 8px', fontSize: 24, fontWeight: 700 }}>Feature Flags</h1>
        <p style={{ color: 'var(--color-red)', fontSize: 14 }}>{error}</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={spinnerStyle}>
        <style>{`@keyframes ffspin { to { transform: rotate(360deg); } }`}</style>
        <div style={{ width: 28, height: 28, border: '3px solid var(--color-bg-highest)', borderTopColor: 'var(--color-red)', borderRadius: '50%', animation: 'ffspin 0.7s linear infinite' }} />
      </div>
    );
  }

  return (
    <div>
      <h1 style={{ margin: '0 0 4px', fontSize: 24, fontWeight: 700 }}>Feature Flags</h1>
      <p style={{ margin: '0 0 24px', color: 'var(--color-text-secondary)', fontSize: 14 }}>
        Toggle platform-wide feature flags
      </p>

      {toggleError && (
        <p style={{ margin: '0 0 12px', color: 'var(--color-red)', fontSize: 13 }}>{toggleError}</p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {flags.map((flag) => (
          <div key={flag.flag_key} style={rowStyle}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text-primary)' }}>
                {formatFlagLabel(flag.flag_key)}
              </div>
              {flag.description && (
                <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginTop: 2 }}>
                  {flag.description}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{
                padding: '2px 10px',
                borderRadius: 12,
                fontSize: 12,
                fontWeight: 600,
                backgroundColor: flag.is_enabled ? 'var(--color-green-light)' : 'var(--color-red-light)',
                color: flag.is_enabled ? 'var(--color-green)' : 'var(--color-red)',
              }}>
                {flag.is_enabled ? 'ON' : 'OFF'}
              </span>

              <button
                onClick={() => handleToggle(flag)}
                disabled={toggling === flag.flag_key}
                aria-label={`Toggle ${formatFlagLabel(flag.flag_key)}`}
                style={{
                  ...toggleTrackBase,
                  backgroundColor: flag.is_enabled ? 'var(--color-green)' : 'var(--color-bg-highest)',
                  opacity: toggling === flag.flag_key ? 0.6 : 1,
                  cursor: toggling === flag.flag_key ? 'not-allowed' : 'pointer',
                }}
              >
                <div style={{
                  ...toggleKnob,
                  left: flag.is_enabled ? 23 : 3,
                }} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

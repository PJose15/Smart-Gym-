'use client';

import { useEffect, useState, CSSProperties } from 'react';
import { supabase } from '@/lib/supabase';
import { AnimatedPage } from '../components/AnimatedPage';

interface FeatureFlagRow {
  id: string;
  flag_key: string;
  is_enabled: boolean;
  description: string | null;
  updated_at: string;
}

const FLAG_COLS = 'id, flag_key, is_enabled, description, updated_at';

const FLAG_INFO: Record<string, { label: string; description: string }> = {
  ai_assist_enabled: {
    label: 'AI Assist',
    description: 'Enable next-set suggestions, smart cues, and workout insights for gym members.',
  },
  maintenance_alerts: {
    label: 'Maintenance Alerts',
    description: 'Track equipment usage and flag machines approaching maintenance thresholds.',
  },
  occupancy_heatmaps: {
    label: 'Occupancy Heatmaps',
    description: 'Show historical views of which machines and times are busiest.',
  },
  franchise_dashboard: {
    label: 'Franchise Dashboard',
    description: 'Aggregate analytics across multiple gym locations.',
  },
};

export default function SettingsPage() {
  const [flags, setFlags] = useState<FeatureFlagRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError(null);
      try {
        const { data, error: fetchErr } = await supabase
          .from('feature_flags')
          .select(FLAG_COLS)
          .order('flag_key');

        if (fetchErr) throw fetchErr;
        setFlags((data ?? []) as FeatureFlagRow[]);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load settings');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const handleToggle = async (flag: FeatureFlagRow) => {
    setSaving(flag.id);
    setError(null);
    try {
      const { error: updateErr } = await supabase
        .from('feature_flags')
        .update({ is_enabled: !flag.is_enabled })
        .eq('id', flag.id);

      if (updateErr) throw updateErr;
      setFlags((prev) =>
        prev.map((f) =>
          f.id === flag.id ? { ...f, is_enabled: !flag.is_enabled } : f,
        ),
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update flag');
    } finally {
      setSaving(null);
    }
  };

  if (loading) {
    return (
      <div style={centeredStyle}>
        <div style={spinnerStyle} className="spinner-enhanced" />
        <p style={{ color: 'var(--color-text-muted)', marginTop: 16 }}>Loading settings...</p>
      </div>
    );
  }

  const enabledCount = flags.filter((f) => f.is_enabled).length;

  return (
    <AnimatedPage>
      <div>
        <div style={headerStyle}>
          <h1 style={titleStyle} className="title-animate">Settings</h1>
          <p style={subtitleStyle} className="subtitle-animate">Manage platform feature flags.</p>
        </div>

        {error && (
          <div style={errorBannerStyle} className="error-shake">
            <span>{error}</span>
          </div>
        )}

        {/* Stats strip */}
        <div style={statsStripStyle}>
          <span style={statsChipStyle}>{flags.length} flag{flags.length !== 1 ? 's' : ''}</span>
          <span style={{ ...statsChipStyle, backgroundColor: 'var(--color-green-subtle)', color: 'var(--color-green-light)' }}>
            {enabledCount} enabled
          </span>
          <span style={statsChipStyle}>{flags.length - enabledCount} disabled</span>
        </div>

        <div style={sectionStyle} className="section-glow">
          <h2 style={sectionTitleStyle}>Feature Flags</h2>
          <p style={sectionDescStyle}>
            Toggle platform-wide feature flags. Changes take effect immediately.
          </p>

          {flags.length === 0 ? (
            <div style={emptyStyle}>
              <p>No feature flags configured.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {flags.map((flag) => {
                const info = FLAG_INFO[flag.flag_key];
                const isSaving = saving === flag.id;
                return (
                  <div key={flag.id} style={flagRowStyle} className="table-row-hover">
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, color: 'var(--color-text-primary)', fontSize: 'var(--text-sm)' }}>
                        {info?.label ?? flag.flag_key}
                      </div>
                      <div style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-xs)', marginTop: 2 }}>
                        {flag.description ?? info?.description ?? flag.flag_key}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <button
                        onClick={() => handleToggle(flag)}
                        disabled={isSaving}
                        className="toggle-enhanced"
                        style={{
                          ...toggleButtonStyle,
                          backgroundColor: flag.is_enabled ? 'var(--color-green)' : 'var(--color-bg-highest)',
                          opacity: isSaving ? 0.6 : 1,
                        }}
                      >
                        <span
                          className="toggle-knob-enhanced"
                          style={{
                            ...toggleKnobStyle,
                            transform: flag.is_enabled ? 'translateX(20px)' : 'translateX(0)',
                          }}
                        />
                      </button>
                      <span style={{ fontSize: 12, color: 'var(--color-text-secondary)', minWidth: 24 }}>
                        {flag.is_enabled ? 'On' : 'Off'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </AnimatedPage>
  );
}

/* ── Styles ─────────────────────────────────────────────── */

const headerStyle: CSSProperties = { marginBottom: 32 };

const titleStyle: CSSProperties = {
  fontSize: 28, fontWeight: 700, marginTop: 0, marginBottom: 8, color: 'var(--color-text-primary)',
};

const subtitleStyle: CSSProperties = {
  color: 'var(--color-text-secondary)', marginTop: 0, marginBottom: 0,
};

const sectionStyle: CSSProperties = {
  backgroundColor: 'var(--color-bg-raised)', borderRadius: 10, padding: 24,
  border: '1px solid var(--color-border-subtle)',
};

const sectionTitleStyle: CSSProperties = {
  fontSize: 20, fontWeight: 600, marginTop: 0, marginBottom: 8, color: 'var(--color-text-primary)',
};

const sectionDescStyle: CSSProperties = {
  fontSize: 14, color: 'var(--color-text-secondary)', marginTop: 0, marginBottom: 20,
};

const flagRowStyle: CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  padding: '14px 16px', borderRadius: 8,
  backgroundColor: 'var(--color-bg-elevated)', border: '1px solid var(--color-border-subtle)',
};

const toggleButtonStyle: CSSProperties = {
  width: 44, height: 24, borderRadius: 12, border: 'none',
  cursor: 'pointer', position: 'relative', transition: 'background-color 0.2s', padding: 0,
};

const toggleKnobStyle: CSSProperties = {
  display: 'block', width: 20, height: 20, borderRadius: 10,
  backgroundColor: 'var(--color-text-primary)', position: 'absolute', top: 2, left: 2,
  transition: 'transform 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
};

const centeredStyle: CSSProperties = {
  backgroundColor: 'var(--color-bg-raised)', borderRadius: 10, padding: 40,
  textAlign: 'center', border: '1px solid var(--color-border-subtle)',
  display: 'flex', flexDirection: 'column', alignItems: 'center',
};

const spinnerStyle: CSSProperties = {
  width: 32, height: 32, border: '3px solid var(--color-bg-highest)',
  borderTopColor: 'var(--color-blue)', borderRadius: '50%',
};

const errorBannerStyle: CSSProperties = {
  backgroundColor: 'var(--color-red-subtle)', border: '1px solid var(--color-red)',
  borderRadius: 8, padding: '12px 16px', marginBottom: 16,
  color: 'var(--color-red-light)', fontSize: 14,
};

const emptyStyle: CSSProperties = {
  color: 'var(--color-text-muted)', fontSize: 14, textAlign: 'center', padding: 20,
};

const statsStripStyle: CSSProperties = {
  display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16,
};

const statsChipStyle: CSSProperties = {
  display: 'inline-block', padding: '4px 12px', borderRadius: 14,
  fontSize: 12, fontWeight: 600,
  backgroundColor: 'var(--color-bg-elevated)', color: 'var(--color-text-muted)',
};

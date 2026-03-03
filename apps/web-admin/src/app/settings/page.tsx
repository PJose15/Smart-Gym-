'use client';

import { useEffect, useState, CSSProperties } from 'react';
import { supabase } from '@/lib/supabase';
import { AnimatedPage } from '../components/AnimatedPage';

interface FeatureFlagRow {
  id: string;
  gym_id: string | null;
  profile_id: string | null;
  key: string;
  enabled: boolean;
  created_at: string;
}

interface GymRow {
  id: string;
  name: string;
}

const KNOWN_FLAGS = [
  {
    key: 'ai_assist_enabled',
    label: 'AI Assist',
    description: 'Enable next-set suggestions, smart cues, and workout insights for gym members.',
  },
  {
    key: 'maintenance_alerts',
    label: 'Maintenance Alerts',
    description: 'Track equipment usage and flag machines approaching maintenance thresholds.',
  },
  {
    key: 'occupancy_heatmaps',
    label: 'Occupancy Heatmaps',
    description: 'Show historical views of which machines and times are busiest.',
  },
  {
    key: 'franchise_dashboard',
    label: 'Franchise Dashboard',
    description: 'Aggregate analytics across multiple gym locations.',
  },
];

export default function SettingsPage() {
  const [gyms, setGyms] = useState<GymRow[]>([]);
  const [flags, setFlags] = useState<FeatureFlagRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError(null);

      try {
        const [gymsRes, flagsRes] = await Promise.all([
          supabase.from('gyms').select('id, name'),
          supabase.from('feature_flags').select('*'),
        ]);

        if (gymsRes.error) throw gymsRes.error;
        if (flagsRes.error) throw flagsRes.error;

        setGyms((gymsRes.data ?? []) as GymRow[]);
        setFlags((flagsRes.data ?? []) as FeatureFlagRow[]);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load settings');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const isFlagEnabled = (gymId: string, flagKey: string): boolean => {
    const flag = flags.find(
      (f) => f.gym_id === gymId && f.key === flagKey && f.profile_id === null,
    );
    return flag?.enabled ?? false;
  };

  const handleToggle = async (gymId: string, flagKey: string) => {
    const cacheKey = `${gymId}:${flagKey}`;
    setSaving(cacheKey);
    setError(null);

    const currentlyEnabled = isFlagEnabled(gymId, flagKey);
    const existingFlag = flags.find(
      (f) => f.gym_id === gymId && f.key === flagKey && f.profile_id === null,
    );

    try {
      if (existingFlag) {
        // Update existing flag
        const { error: updateError } = await supabase
          .from('feature_flags')
          .update({ enabled: !currentlyEnabled })
          .eq('id', existingFlag.id);
        if (updateError) throw updateError;

        setFlags((prev) =>
          prev.map((f) =>
            f.id === existingFlag.id ? { ...f, enabled: !currentlyEnabled } : f,
          ),
        );
      } else {
        // Insert new flag
        const { data, error: insertError } = await supabase
          .from('feature_flags')
          .insert({
            gym_id: gymId,
            profile_id: null,
            key: flagKey,
            enabled: true,
          })
          .select()
          .single();
        if (insertError) throw insertError;
        setFlags((prev) => [...prev, data as FeatureFlagRow]);
      }
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
        <p style={{ color: '#999', marginTop: 16 }}>Loading settings...</p>
      </div>
    );
  }

  return (
    <AnimatedPage>
    <div>
      <div style={headerStyle}>
        <h1 style={titleStyle} className="title-animate">Settings</h1>
        <p style={subtitleStyle} className="subtitle-animate">Manage feature flags and gym-level settings.</p>
      </div>

      {error && (
        <div style={errorBannerStyle} className="error-shake">
          <span>{error}</span>
        </div>
      )}

      {/* Stats strip */}
      {gyms.length > 0 && (() => {
        const totalCombinations = gyms.length * KNOWN_FLAGS.length;
        const enabledCount = gyms.reduce((sum, gym) =>
          sum + KNOWN_FLAGS.filter((f) => isFlagEnabled(gym.id, f.key)).length, 0);
        return (
          <div style={statsStripStyle}>
            <span style={statsChipStyle}>{gyms.length} gym{gyms.length !== 1 ? 's' : ''}</span>
            <span style={statsChipStyle}>{KNOWN_FLAGS.length} feature flag{KNOWN_FLAGS.length !== 1 ? 's' : ''}</span>
            <span style={{ ...statsChipStyle, backgroundColor: '#e8f5e9', color: '#2e7d32' }}>{enabledCount} enabled</span>
            <span style={statsChipStyle}>{totalCombinations - enabledCount} disabled</span>
          </div>
        );
      })()}

      <div style={sectionStyle} className="section-glow">
        <h2 style={sectionTitleStyle}>Feature Flags</h2>
        <p style={sectionDescStyle}>
          Enable or disable features per gym. Flags apply to all members in the gym.
        </p>

        {gyms.length === 0 ? (
          <div style={emptyStyle}>
            <p>No gyms found. Create a gym first.</p>
          </div>
        ) : (
          <div style={tableContainerStyle}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Gym</th>
                  {KNOWN_FLAGS.map((flag) => (
                    <th key={flag.key} style={thStyle}>
                      {flag.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {gyms.map((gym) => (
                  <tr key={gym.id} className="table-row-hover">
                    <td style={tdStyle}>
                      <span style={gymNameStyle}>{gym.name}</span>
                    </td>
                    {KNOWN_FLAGS.map((flag) => {
                      const enabled = isFlagEnabled(gym.id, flag.key);
                      const isSaving = saving === `${gym.id}:${flag.key}`;

                      return (
                        <td key={flag.key} style={tdStyle}>
                          <button
                            onClick={() => handleToggle(gym.id, flag.key)}
                            disabled={isSaving}
                            className="toggle-enhanced"
                            style={{
                              ...toggleButtonStyle,
                              backgroundColor: enabled ? '#2a9d8f' : '#dee2e6',
                              opacity: isSaving ? 0.6 : 1,
                            }}
                            title={flag.description}
                          >
                            <span
                              className="toggle-knob-enhanced"
                              style={{
                                ...toggleKnobStyle,
                                transform: enabled ? 'translateX(20px)' : 'translateX(0)',
                              }}
                            />
                          </button>
                          <span style={{ fontSize: 12, color: '#666', marginLeft: 8 }}>
                            {enabled ? 'On' : 'Off'}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div style={{ ...sectionStyle, marginTop: 32 }} className="section-glow">
        <h2 style={sectionTitleStyle}>About Feature Flags</h2>
        {KNOWN_FLAGS.map((flag) => (
          <div key={flag.key} style={flagInfoStyle}>
            <strong>{flag.label}</strong> ({flag.key})
            <p style={flagDescStyle}>{flag.description}</p>
          </div>
        ))}
      </div>
    </div>
    </AnimatedPage>
  );
}

/* ── Styles ─────────────────────────────────────────────── */

const headerStyle: CSSProperties = {
  marginBottom: 32,
};

const titleStyle: CSSProperties = {
  fontSize: 28,
  fontWeight: 700,
  marginTop: 0,
  marginBottom: 8,
  color: '#1a1a2e',
};

const subtitleStyle: CSSProperties = {
  color: '#666',
  marginTop: 0,
  marginBottom: 0,
};

const sectionStyle: CSSProperties = {
  backgroundColor: '#ffffff',
  borderRadius: 10,
  padding: 24,
  border: '1px solid rgba(0,0,0,0.06)',
};

const sectionTitleStyle: CSSProperties = {
  fontSize: 20,
  fontWeight: 600,
  marginTop: 0,
  marginBottom: 8,
  color: '#1a1a2e',
};

const sectionDescStyle: CSSProperties = {
  fontSize: 14,
  color: '#666',
  marginTop: 0,
  marginBottom: 20,
};

const tableContainerStyle: CSSProperties = {
  overflowX: 'auto',
};

const tableStyle: CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
};

const thStyle: CSSProperties = {
  textAlign: 'left',
  padding: '12px 16px',
  borderBottom: '2px solid #eee',
  fontSize: 13,
  fontWeight: 600,
  color: '#666',
  textTransform: 'uppercase',
};

const tdStyle: CSSProperties = {
  padding: '12px 16px',
  borderBottom: '1px solid #f0f0f0',
  verticalAlign: 'middle',
};

const gymNameStyle: CSSProperties = {
  fontWeight: 600,
  color: '#1a1a2e',
};

const toggleButtonStyle: CSSProperties = {
  width: 44,
  height: 24,
  borderRadius: 12,
  border: 'none',
  cursor: 'pointer',
  position: 'relative',
  transition: 'background-color 0.2s',
  padding: 0,
};

const toggleKnobStyle: CSSProperties = {
  display: 'block',
  width: 20,
  height: 20,
  borderRadius: 10,
  backgroundColor: '#ffffff',
  position: 'absolute',
  top: 2,
  left: 2,
  transition: 'transform 0.2s',
  boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
};

const centeredStyle: CSSProperties = {
  backgroundColor: '#ffffff',
  borderRadius: 10,
  padding: 40,
  textAlign: 'center',
  border: '1px solid rgba(0,0,0,0.06)',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
};

const spinnerStyle: CSSProperties = {
  width: 32,
  height: 32,
  border: '3px solid #e0e0e0',
  borderTopColor: '#4fc3f7',
  borderRadius: '50%',
};

const errorBannerStyle: CSSProperties = {
  backgroundColor: '#fef2f2',
  border: '1px solid #fecaca',
  borderRadius: 8,
  padding: '12px 16px',
  marginBottom: 16,
  color: '#dc2626',
  fontSize: 14,
};

const emptyStyle: CSSProperties = {
  color: '#999',
  fontSize: 14,
  textAlign: 'center',
  padding: 20,
};

const flagInfoStyle: CSSProperties = {
  padding: '12px 0',
  borderBottom: '1px solid #f0f0f0',
  fontSize: 14,
};

const flagDescStyle: CSSProperties = {
  margin: '4px 0 0 0',
  color: '#666',
  fontSize: 13,
};

const statsStripStyle: CSSProperties = {
  display: 'flex',
  gap: 8,
  flexWrap: 'wrap',
  marginBottom: 16,
};

const statsChipStyle: CSSProperties = {
  display: 'inline-block',
  padding: '4px 12px',
  borderRadius: 14,
  fontSize: 12,
  fontWeight: 600,
  backgroundColor: '#f0f0f0',
  color: '#555',
};

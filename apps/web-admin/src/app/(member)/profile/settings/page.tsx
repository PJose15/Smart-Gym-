'use client';

import { useEffect, useState, FormEvent, CSSProperties } from 'react';
import type { MemberSettingsData } from '@nexera/types';

const cardStyle: CSSProperties = {
  backgroundColor: 'var(--color-bg-raised)',
  borderRadius: 10,
  padding: 20,
  marginBottom: 16,
};

const labelStyle: CSSProperties = {
  display: 'block',
  marginBottom: 6,
  fontSize: 12,
  color: 'var(--color-text-secondary)',
  fontWeight: 500,
};

const selectStyle: CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  backgroundColor: 'var(--color-bg-base)',
  border: '1px solid var(--color-bg-elevated)',
  borderRadius: 8,
  color: 'var(--color-text-primary)',
  fontSize: 14,
  outline: 'none',
  boxSizing: 'border-box',
};

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, fontSize: 13, cursor: 'pointer' }}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span style={{ color: 'var(--color-text-primary)' }}>{label}</span>
    </label>
  );
}

export default function MemberSettingsPage() {
  const [settings, setSettings] = useState<MemberSettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch('/api/member/settings');
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const d = await r.json();
        if (!cancelled) {
          setSettings(d);
          setLoadError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : 'Failed to load settings');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  function update(key: keyof MemberSettingsData, value: string | boolean) {
    if (!settings) return;
    setSettings({ ...settings, [key]: value });
  }

  async function handleSignOut() {
    try {
      await fetch('/api/auth/signout', { method: 'POST' });
    } catch {
      // Even if the request fails, clear client state and leave the surface.
    }
    window.location.href = '/auth';
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (!settings) return;
    setSaving(true);
    setMsg('');

    try {
      const res = await fetch('/api/member/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });

      if (res.ok) {
        setMsg('Settings saved!');
      } else {
        setMsg('Failed to save.');
      }
    } catch {
      setMsg('Network error. Check your connection and try again.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p style={{ color: 'var(--color-text-secondary)', padding: 20 }}>Loading...</p>;
  if (!settings) return (
    <div style={{ padding: 20 }}>
      <p style={{ color: 'var(--color-red)', marginBottom: 12 }}>Failed to load settings{loadError ? `: ${loadError}` : '.'}</p>
      <button
        onClick={() => { setLoading(true); setLoadError(null); window.location.reload(); }}
        style={{ padding: '8px 16px', backgroundColor: 'var(--color-blue)', color: 'var(--color-text-primary)', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
      >
        Retry
      </button>
    </div>
  );

  return (
    <div style={{ padding: '20px 16px' }}>
      <h1 style={{ margin: '0 0 20px', fontSize: 20, fontWeight: 700 }}>Settings</h1>

      <form onSubmit={handleSave}>
        {/* Units */}
        <div style={cardStyle}>
          <h2 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 600, color: 'var(--color-text-secondary)' }}>Units & Format</h2>
          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>Weight Unit</label>
            <select value={settings.weight_unit} onChange={(e) => update('weight_unit', e.target.value)} style={selectStyle}>
              <option value="lbs">lbs</option>
              <option value="kg">kg</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>Date Format</label>
            <select value={settings.date_format} onChange={(e) => update('date_format', e.target.value)} style={selectStyle}>
              <option value="MM/DD/YYYY">MM/DD/YYYY</option>
              <option value="DD/MM/YYYY">DD/MM/YYYY</option>
              <option value="YYYY-MM-DD">YYYY-MM-DD</option>
            </select>
          </div>
        </div>

        {/* Privacy */}
        <div style={cardStyle}>
          <h2 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 600, color: 'var(--color-text-secondary)' }}>Privacy</h2>
          <Toggle label="Profile visible to others" checked={settings.profile_visible} onChange={(v) => update('profile_visible', v)} />
          <Toggle label="Show on leaderboard" checked={settings.show_on_leaderboard} onChange={(v) => update('show_on_leaderboard', v)} />
          <Toggle label="Share achievements to feed" checked={settings.share_achievements} onChange={(v) => update('share_achievements', v)} />
          <Toggle label="Share PRs to feed" checked={settings.share_prs_to_feed} onChange={(v) => update('share_prs_to_feed', v)} />
          <Toggle label="Show streak publicly" checked={settings.show_streak_publicly} onChange={(v) => update('show_streak_publicly', v)} />
        </div>

        {/* Trainer Sharing */}
        <div style={cardStyle}>
          <h2 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 600, color: 'var(--color-text-secondary)' }}>Trainer Sharing</h2>
          <Toggle label="Share body weight with trainer" checked={settings.share_weight_with_trainer} onChange={(v) => update('share_weight_with_trainer', v)} />
          <Toggle label="Share workouts with trainer" checked={settings.share_workout_with_trainer} onChange={(v) => update('share_workout_with_trainer', v)} />
          <Toggle label="Show body weight on profile" checked={settings.show_body_weight} onChange={(v) => update('show_body_weight', v)} />
        </div>

        {msg && <p style={{ color: msg.includes('saved') ? 'var(--color-green)' : 'var(--color-red)', fontSize: 13, marginBottom: 8 }}>{msg}</p>}

        <button type="submit" disabled={saving} style={{
          width: '100%',
          padding: '12px 0',
          backgroundColor: 'var(--color-blue)',
          color: 'var(--color-text-primary)',
          border: 'none',
          borderRadius: 8,
          fontSize: 15,
          fontWeight: 600,
          cursor: 'pointer',
          opacity: saving ? 0.6 : 1,
        }}>
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </form>

      {/* Account */}
      <div style={{ ...cardStyle, marginTop: 24 }}>
        <h2 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 600, color: 'var(--color-text-secondary)' }}>Account</h2>
        <button
          type="button"
          onClick={handleSignOut}
          style={{
            width: '100%',
            padding: '12px 0',
            backgroundColor: 'transparent',
            color: 'var(--color-red)',
            border: '1px solid var(--color-red-subtle)',
            borderRadius: 8,
            fontSize: 15,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Sign Out
        </button>
      </div>
    </div>
  );
}

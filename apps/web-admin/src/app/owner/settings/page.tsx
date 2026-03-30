'use client';

import { useEffect, useState, FormEvent, CSSProperties } from 'react';
import type { GymSettings } from '@nexera/types';

const cardStyle: CSSProperties = {
  backgroundColor: '#1E293B',
  borderRadius: 10,
  padding: 24,
  marginBottom: 20,
  maxWidth: 600,
};

const inputStyle: CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  backgroundColor: '#0F172A',
  border: '1px solid #334155',
  borderRadius: 8,
  color: '#F1F5F9',
  fontSize: 14,
  outline: 'none',
  boxSizing: 'border-box',
};

const labelStyle: CSSProperties = {
  display: 'block',
  marginBottom: 6,
  fontSize: 12,
  color: '#94A3B8',
  fontWeight: 500,
};

const fieldStyle: CSSProperties = { marginBottom: 16 };

const btnStyle: CSSProperties = {
  padding: '10px 24px',
  backgroundColor: '#3B82F6',
  color: '#fff',
  border: 'none',
  borderRadius: 8,
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
};

const sectionTitle: CSSProperties = {
  margin: '0 0 16px',
  fontSize: 15,
  fontWeight: 600,
  color: '#94A3B8',
};

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, fontSize: 13, cursor: 'pointer' }}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span style={{ color: '#F1F5F9' }}>{label}</span>
    </label>
  );
}

export default function OwnerSettingsPage() {
  const [settings, setSettings] = useState<GymSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    fetch('/api/owner/settings')
      .then((r) => r.json())
      .then((d) => { setSettings(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  function update(key: keyof GymSettings, value: string | number | boolean) {
    if (!settings) return;
    setSettings({ ...settings, [key]: value });
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (!settings) return;
    setSaving(true);
    setMsg('');

    const res = await fetch('/api/owner/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });

    if (res.ok) {
      setMsg('Settings saved!');
    } else {
      setMsg('Failed to save settings.');
    }
    setSaving(false);
  }

  if (loading) return <p style={{ color: '#94A3B8' }}>Loading settings...</p>;
  if (!settings) return <p style={{ color: '#EF4444' }}>Failed to load settings.</p>;

  return (
    <div style={{ color: '#F1F5F9', maxWidth: 600 }}>
      <h1 style={{ margin: '0 0 24px', fontSize: 22, fontWeight: 700 }}>Gym Settings</h1>

      <form onSubmit={handleSave}>
        {/* Branding */}
        <div style={cardStyle}>
          <h2 style={sectionTitle}>Branding</h2>
          <div style={fieldStyle}>
            <label style={labelStyle}>Primary Color</label>
            <input type="color" value={settings.primary_color} onChange={(e) => update('primary_color', e.target.value)} style={{ height: 36, cursor: 'pointer' }} />
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle}>Secondary Color</label>
            <input type="color" value={settings.secondary_color} onChange={(e) => update('secondary_color', e.target.value)} style={{ height: 36, cursor: 'pointer' }} />
          </div>
          <Toggle label="Hide Nexera branding" checked={settings.hide_smartgym_branding} onChange={(v) => update('hide_smartgym_branding', v)} />
        </div>

        {/* Public Profile */}
        <div style={cardStyle}>
          <h2 style={sectionTitle}>Public Profile</h2>
          <Toggle label="Show public profile" checked={settings.show_public_profile} onChange={(v) => update('show_public_profile', v)} />
          <Toggle label="Show public stats" checked={settings.show_public_stats} onChange={(v) => update('show_public_stats', v)} />
          <div style={fieldStyle}>
            <label style={labelStyle}>Profile Headline</label>
            <input type="text" value={settings.public_profile_headline ?? ''} onChange={(e) => update('public_profile_headline', e.target.value)} style={inputStyle} placeholder="Your gym's tagline" />
          </div>
        </div>

        {/* Member Experience */}
        <div style={cardStyle}>
          <h2 style={sectionTitle}>Member Experience</h2>
          <Toggle label="Show gym feed" checked={settings.show_gym_feed} onChange={(v) => update('show_gym_feed', v)} />
          <Toggle label="Show leaderboards" checked={settings.show_leaderboards} onChange={(v) => update('show_leaderboards', v)} />
          <div style={fieldStyle}>
            <label style={labelStyle}>Leaderboard Scope</label>
            <select value={settings.leaderboard_scope} onChange={(e) => update('leaderboard_scope', e.target.value)} style={inputStyle}>
              <option value="gym">Gym only</option>
              <option value="global">Global</option>
              <option value="both">Both</option>
            </select>
          </div>
          <Toggle label="Require member photo" checked={settings.require_member_photo} onChange={(v) => update('require_member_photo', v)} />
          <Toggle label="Allow anonymous logging" checked={settings.allow_anonymous_logging} onChange={(v) => update('allow_anonymous_logging', v)} />
          <Toggle label="Enable member AI chat" checked={settings.enable_member_chat_with_ai} onChange={(v) => update('enable_member_chat_with_ai', v)} />
        </div>

        {/* AI Programs */}
        <div style={cardStyle}>
          <h2 style={sectionTitle}>AI Programs</h2>
          <Toggle label="Auto-generate AI programs" checked={settings.ai_program_auto_generate} onChange={(v) => update('ai_program_auto_generate', v)} />
          <Toggle label="Trainer must approve AI programs" checked={settings.trainer_must_approve_ai_programs} onChange={(v) => update('trainer_must_approve_ai_programs', v)} />
          <div style={fieldStyle}>
            <label style={labelStyle}>Program Duration (weeks)</label>
            <select value={settings.program_duration_weeks} onChange={(e) => update('program_duration_weeks', parseInt(e.target.value))} style={inputStyle}>
              {[4, 6, 8, 12].map((w) => <option key={w} value={w}>{w} weeks</option>)}
            </select>
          </div>
        </div>

        {/* Operations */}
        <div style={cardStyle}>
          <h2 style={sectionTitle}>Operations</h2>
          <div style={fieldStyle}>
            <label style={labelStyle}>At-Risk Threshold (days)</label>
            <input type="number" min={7} max={30} value={settings.at_risk_threshold_days} onChange={(e) => update('at_risk_threshold_days', parseInt(e.target.value))} style={inputStyle} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={fieldStyle}>
              <label style={labelStyle}>Open Time</label>
              <input type="time" value={settings.gym_open_time} onChange={(e) => update('gym_open_time', e.target.value)} style={inputStyle} />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Close Time</label>
              <input type="time" value={settings.gym_close_time} onChange={(e) => update('gym_close_time', e.target.value)} style={inputStyle} />
            </div>
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle}>Timezone</label>
            <input type="text" value={settings.timezone} onChange={(e) => update('timezone', e.target.value)} style={inputStyle} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={fieldStyle}>
              <label style={labelStyle}>Weight Unit</label>
              <select value={settings.weight_unit} onChange={(e) => update('weight_unit', e.target.value)} style={inputStyle}>
                <option value="lbs">lbs</option>
                <option value="kg">kg</option>
              </select>
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Currency</label>
              <input type="text" value={settings.currency} onChange={(e) => update('currency', e.target.value)} style={inputStyle} maxLength={3} placeholder="USD" />
            </div>
          </div>
        </div>

        {/* Trainer Defaults */}
        <div style={cardStyle}>
          <h2 style={sectionTitle}>Trainer Defaults</h2>
          <Toggle label="Trainers can create challenges" checked={settings.default_trainer_can_create_challenges} onChange={(v) => update('default_trainer_can_create_challenges', v)} />
          <Toggle label="Trainers can manage all members" checked={settings.default_trainer_can_manage_all} onChange={(v) => update('default_trainer_can_manage_all', v)} />
          <Toggle label="Trainers can view analytics" checked={settings.default_trainer_can_view_analytics} onChange={(v) => update('default_trainer_can_view_analytics', v)} />
        </div>

        {/* Equipment */}
        <div style={cardStyle}>
          <h2 style={sectionTitle}>Equipment</h2>
          <div style={fieldStyle}>
            <label style={labelStyle}>Default Maintenance Interval (days)</label>
            <input type="number" min={1} max={365} value={settings.default_maintenance_interval_days} onChange={(e) => update('default_maintenance_interval_days', parseInt(e.target.value))} style={inputStyle} />
          </div>
          <Toggle label="Equipment maintenance alerts" checked={settings.equipment_maintenance_alerts} onChange={(v) => update('equipment_maintenance_alerts', v)} />
          <div style={fieldStyle}>
            <label style={labelStyle}>Alert days ahead</label>
            <input type="number" min={1} max={30} value={settings.maintenance_alert_days_ahead} onChange={(e) => update('maintenance_alert_days_ahead', parseInt(e.target.value))} style={inputStyle} />
          </div>
        </div>

        {/* Owner Notifications */}
        <div style={cardStyle}>
          <h2 style={sectionTitle}>Notifications</h2>
          <Toggle label="Daily digest" checked={settings.owner_daily_digest} onChange={(v) => update('owner_daily_digest', v)} />
          <Toggle label="At-risk member alerts" checked={settings.owner_at_risk_alerts} onChange={(v) => update('owner_at_risk_alerts', v)} />
          <Toggle label="New member notifications" checked={settings.owner_new_member_notification} onChange={(v) => update('owner_new_member_notification', v)} />
          <Toggle label="PR notifications" checked={settings.owner_pr_notifications} onChange={(v) => update('owner_pr_notifications', v)} />
          <Toggle label="Monthly report" checked={settings.owner_monthly_report} onChange={(v) => update('owner_monthly_report', v)} />
          <Toggle label="Maintenance alerts" checked={settings.owner_maintenance_alerts} onChange={(v) => update('owner_maintenance_alerts', v)} />
        </div>

        {msg && <p style={{ color: msg.includes('saved') ? '#22C55E' : '#EF4444', fontSize: 13, marginBottom: 12 }}>{msg}</p>}

        <button type="submit" disabled={saving} style={{ ...btnStyle, opacity: saving ? 0.6 : 1 }}>
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </form>
    </div>
  );
}

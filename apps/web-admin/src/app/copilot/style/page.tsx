'use client';

import { useEffect, useState, CSSProperties } from 'react';
import { supabase } from '@/lib/supabase';
import { PageHeader } from '../../components/PageHeader';
import { AnimatedPage } from '../../components/AnimatedPage';
import {
  buildWorkoutDraft,
  applyTone,
  applyVerbosity,
} from '@nexera/ai-assist';
import type { TrainerTone, TrainerVerbosity } from '@nexera/types';

// ─── Styles ─────────────────────────────────────────────

const formContainerStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 24,
  maxWidth: 900,
};

const cardStyle: CSSProperties = {
  backgroundColor: 'var(--color-bg-raised)',
  borderRadius: 10,
  padding: 24,
  border: '1px solid var(--color-border-subtle)',
};

const labelStyle: CSSProperties = {
  display: 'block',
  fontSize: 13,
  fontWeight: 600,
  color: 'var(--color-text-muted)',
  marginBottom: 6,
  textTransform: 'uppercase',
  letterSpacing: '0.3px',
};

const selectStyle: CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  fontSize: 14,
  border: '1px solid var(--color-border-default)',
  borderRadius: 6,
  outline: 'none',
  backgroundColor: 'var(--color-bg-elevated)',
  color: 'var(--color-text-primary)',
  marginBottom: 20,
  boxSizing: 'border-box',
};

const saveBtnStyle: CSSProperties = {
  padding: '10px 24px',
  fontSize: 14,
  fontWeight: 600,
  color: 'var(--color-text-primary)',
  backgroundColor: 'var(--color-blue)',
  border: 'none',
  borderRadius: 6,
  cursor: 'pointer',
};

const previewContainerStyle: CSSProperties = {
  backgroundColor: 'var(--color-bg-highest)',
  borderRadius: 8,
  padding: '16px 20px',
  fontSize: 14,
  lineHeight: 1.6,
  color: 'var(--color-text-primary)',
  whiteSpace: 'pre-wrap',
};

const previewLabelStyle: CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: 'var(--color-text-muted)',
  marginBottom: 8,
  textTransform: 'uppercase',
  letterSpacing: '0.3px',
};

const errorStyle: CSSProperties = {
  backgroundColor: 'var(--color-red-light)',
  color: 'var(--color-red)',
  padding: '14px 18px',
  borderRadius: 8,
  fontSize: 14,
  marginBottom: 16,
};

const successStyle: CSSProperties = {
  backgroundColor: 'var(--color-green-light)',
  color: 'var(--color-green)',
  padding: '14px 18px',
  borderRadius: 8,
  fontSize: 14,
  marginBottom: 16,
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
  backgroundColor: 'var(--color-bg-highest)',
  color: 'var(--color-text-muted)',
};

// ─── Component ──────────────────────────────────────────

export default function StyleSettingsPage() {
  const [tone, setTone] = useState<TrainerTone>('supportive');
  const [verbosity, setVerbosity] = useState<TrainerVerbosity>('standard');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data } = await supabase
        .from('trainer_style_settings')
        .select('tone, verbosity')
        .eq('trainer_profile_id', user.id)
        .limit(1)
        .single();

      if (data) {
        setTone(data.tone as TrainerTone);
        setVerbosity(data.verbosity as TrainerVerbosity);
      }
    } catch {
      // No existing settings — use defaults
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setError('Not authenticated'); setSaving(false); return; }

      // Get gym_id from gym_members
      const { data: membership } = await supabase
        .from('gym_members')
        .select('gym_id')
        .eq('profile_id', user.id)
        .limit(1)
        .single();

      if (!membership) { setError('No gym membership found'); setSaving(false); return; }

      const { error: upsertErr } = await supabase
        .from('trainer_style_settings')
        .upsert({
          gym_id: membership.gym_id,
          trainer_profile_id: user.id,
          tone,
          verbosity,
        }, { onConflict: 'gym_id,trainer_profile_id' });

      if (upsertErr) throw upsertErr;
      setSuccess('Style settings saved.');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  }

  // Generate preview draft with mock data
  const previewDraft = buildWorkoutDraft({
    memberName: 'Jane Doe',
    exercises: [
      {
        id: 'preview-ex-1', workout_id: 'preview', exercise_name: 'Bench Press',
        machine_id: null, order_index: 0,
        sets: [
          { id: 's1', workout_exercise_id: 'preview-ex-1', set_number: 1, reps: 10, weight_kg: 50, rpe: null, logged_at: new Date().toISOString() },
          { id: 's2', workout_exercise_id: 'preview-ex-1', set_number: 2, reps: 10, weight_kg: 50, rpe: null, logged_at: new Date().toISOString() },
          { id: 's3', workout_exercise_id: 'preview-ex-1', set_number: 3, reps: 10, weight_kg: 50, rpe: null, logged_at: new Date().toISOString() },
          { id: 's4', workout_exercise_id: 'preview-ex-1', set_number: 4, reps: 10, weight_kg: 50, rpe: null, logged_at: new Date().toISOString() },
        ],
      },
      {
        id: 'preview-ex-2', workout_id: 'preview', exercise_name: 'Lat Pulldown',
        machine_id: null, order_index: 1,
        sets: [
          { id: 's5', workout_exercise_id: 'preview-ex-2', set_number: 1, reps: 12, weight_kg: 40, rpe: null, logged_at: new Date().toISOString() },
          { id: 's6', workout_exercise_id: 'preview-ex-2', set_number: 2, reps: 12, weight_kg: 40, rpe: null, logged_at: new Date().toISOString() },
          { id: 's7', workout_exercise_id: 'preview-ex-2', set_number: 3, reps: 12, weight_kg: 40, rpe: null, logged_at: new Date().toISOString() },
        ],
      },
    ] as any,
    prs: [{ exercise_name: 'Bench Press', type: 'PR_WEIGHT' as const, value: 52.5, previous_value: 50 }],
    volumeChangePct: 12,
    totalVolumeKg: 3200,
    totalSets: 7,
    totalReps: 58,
    feedbackTrends: { discomfort_count_7d: 2, unstable_count_7d: 0, top_body_areas: ['shoulder'] },
    adherenceVsPlan: { expected_workouts: 4, actual_workouts: 3 },
    style: { tone, verbosity },
  });

  if (loading) {
    return (
      <AnimatedPage>
        <div style={{ padding: 24 }}>
          <PageHeader title="Style Settings" description="Customize your co-pilot draft tone and verbosity" />
          <div style={{ textAlign: 'center', padding: 48 }}><div className="spinner-enhanced" /></div>
        </div>
      </AnimatedPage>
    );
  }

  return (
    <AnimatedPage>
      <div style={{ padding: 24 }}>
        <PageHeader
          title="Style Settings"
          description="Customize how AI-generated coach note drafts sound"
        />

        {error && <div style={errorStyle}>{error}</div>}
        {success && <div style={successStyle}>{success}</div>}

        {/* Settings summary strip */}
        <div style={statsStripStyle}>
          <span style={{ ...statsChipStyle, backgroundColor: tone === 'supportive' ? 'var(--color-green-light)' : tone === 'strict' ? 'var(--color-red-light)' : 'var(--color-bg-highest)', color: tone === 'supportive' ? 'var(--color-green)' : tone === 'strict' ? 'var(--color-red)' : 'var(--color-text-muted)' }}>
            Tone: {tone}
          </span>
          <span style={{ ...statsChipStyle, backgroundColor: verbosity === 'detailed' ? 'var(--color-blue-subtle)' : verbosity === 'short' ? 'rgba(239,159,39,0.15)' : 'var(--color-bg-highest)', color: verbosity === 'detailed' ? 'var(--color-blue)' : verbosity === 'short' ? 'var(--color-gold)' : 'var(--color-text-muted)' }}>
            Verbosity: {verbosity}
          </span>
          <span style={statsChipStyle}>
            Preview confidence: {Math.round(previewDraft.confidence * 100)}%
          </span>
        </div>

        <div style={formContainerStyle}>
          {/* Settings form */}
          <div style={cardStyle} className="section-glow">
            <div style={{ marginBottom: 24 }}>
              <label style={labelStyle}>Tone</label>
              <select
                style={selectStyle}
                value={tone}
                onChange={(e) => setTone(e.target.value as TrainerTone)}
              >
                <option value="supportive">Supportive — encouraging, warm</option>
                <option value="neutral">Neutral — factual, concise</option>
                <option value="strict">Strict — direct, action-oriented</option>
              </select>

              <label style={labelStyle}>Verbosity</label>
              <select
                style={selectStyle}
                value={verbosity}
                onChange={(e) => setVerbosity(e.target.value as TrainerVerbosity)}
              >
                <option value="short">Short — first sentence only</option>
                <option value="standard">Standard — full details</option>
                <option value="detailed">Detailed — comprehensive</option>
              </select>
            </div>

            <button
              style={{
                ...saveBtnStyle,
                opacity: saving ? 0.7 : 1,
              }}
              className="btn-primary"
              disabled={saving}
              onClick={handleSave}
            >
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>

          {/* Preview panel */}
          <div style={cardStyle} className="section-glow">
            <div style={previewLabelStyle}>Preview</div>
            <div style={{ ...previewLabelStyle, fontSize: 15, fontWeight: 700, color: 'var(--color-text-primary)', textTransform: 'none', letterSpacing: 0 }}>
              {previewDraft.draft_title}
            </div>
            <div style={previewContainerStyle}>
              {previewDraft.draft_body}
            </div>
            <div style={{ marginTop: 12, fontSize: 12, color: 'var(--color-text-muted)' }}>
              Confidence: {Math.round(previewDraft.confidence * 100)}%
            </div>
          </div>
        </div>
      </div>
    </AnimatedPage>
  );
}

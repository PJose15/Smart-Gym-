'use client';

import { useEffect, useState, CSSProperties } from 'react';
import { supabase } from '@/lib/supabase';
import { useStaffAuth } from '@/lib/useStaffAuth';
import { generateQrSlug } from '@nexera/utils';
import { generateMachineMistakes } from '@nexera/ai-assist';
import { fetchMachineMistakes } from '@/lib/aiService';
import { PageHeader } from '../components/PageHeader';
import { AnimatedPage } from '../components/AnimatedPage';
import { MachineForm, type MachineFormValues } from '@/components/machines/MachineForm';

interface MachineRow {
  id: string;
  name: string;
  qr_slug: string;
  target_muscles: string[];
  setup_steps: string[];
  safety_cues: string[];
  movement_pattern: string;
  equipment_type: string;
  difficulty: string;
  primary_muscles: string[];
  secondary_muscles: string[];
  gym_id: string;
  gyms: { name: string } | null;
}

interface GymOption {
  id: string;
  name: string;
  slug: string;
}

// â”€â”€â”€ Styles â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const addButtonStyle: CSSProperties = {
  padding: '10px 20px',
  fontSize: 14,
  fontWeight: 600,
  color: 'var(--color-text-primary)',
  backgroundColor: 'var(--color-blue)',
  border: 'none',
  borderRadius: 6,
  cursor: 'pointer',
};

const formContainerStyle: CSSProperties = {
  backgroundColor: 'var(--color-bg-raised)',
  borderRadius: 10,
  padding: '24px',
  marginBottom: 24,
  border: '1px solid var(--color-border-subtle)',
};

const formTitleStyle: CSSProperties = {
  fontSize: 18,
  fontWeight: 600,
  color: 'var(--color-text-primary)',
  marginTop: 0,
  marginBottom: 20,
};

const labelStyle: CSSProperties = {
  display: 'block',
  fontSize: 13,
  fontWeight: 600,
  color: 'var(--color-text-primary)',
  marginBottom: 6,
};

const inputStyle: CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  fontSize: 14,
  border: '1px solid var(--color-border-default)',
  borderRadius: 6,
  boxSizing: 'border-box',
  outline: 'none',
  backgroundColor: 'var(--color-bg-elevated)',
  color: 'var(--color-text-primary)',
};

const selectStyle: CSSProperties = {
  ...inputStyle,
  backgroundColor: 'var(--color-bg-elevated)',
};

const fieldStyle: CSSProperties = {
  marginBottom: 16,
};

const tableContainerStyle: CSSProperties = {
  backgroundColor: 'var(--color-bg-raised)',
  borderRadius: 10,
  overflow: 'hidden',
  border: '1px solid var(--color-border-subtle)',
};

const tableStyle: CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: 14,
};

const thStyle: CSSProperties = {
  textAlign: 'left',
  padding: '12px 16px',
  backgroundColor: 'var(--color-bg-elevated)',
  borderBottom: '1px solid var(--color-border-default)',
  fontWeight: 600,
  color: 'var(--color-text-muted)',
  fontSize: 13,
  textTransform: 'uppercase',
  letterSpacing: '0.3px',
};

const tdStyle: CSSProperties = {
  padding: '12px 16px',
  borderBottom: '1px solid var(--color-border-subtle)',
  color: 'var(--color-text-primary)',
};

const tagStyle: CSSProperties = {
  display: 'inline-block',
  padding: '2px 8px',
  backgroundColor: 'var(--color-blue-subtle)',
  color: 'var(--color-blue)',
  borderRadius: 4,
  fontSize: 12,
  marginRight: 4,
  marginBottom: 2,
};

const metaTagStyle: CSSProperties = {
  ...tagStyle,
  backgroundColor: 'var(--color-purple-subtle)',
  color: 'var(--color-purple)',
};

const slugStyle: CSSProperties = {
  fontFamily: 'monospace',
  fontSize: 13,
  color: 'var(--color-text-secondary)',
  backgroundColor: 'var(--color-bg-elevated)',
  padding: '2px 6px',
  borderRadius: 4,
};

const deleteButtonStyle: CSSProperties = {
  padding: '6px 14px',
  fontSize: 13,
  fontWeight: 600,
  color: 'var(--color-red)',
  backgroundColor: 'var(--color-red-subtle)',
  border: 'none',
  borderRadius: 4,
  cursor: 'pointer',
};

const errorBoxStyle: CSSProperties = {
  backgroundColor: 'var(--color-red-subtle)',
  color: 'var(--color-red)',
  padding: '14px 18px',
  borderRadius: 8,
  fontSize: 14,
  marginBottom: 16,
};

const loadingContainerStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  padding: '60px 0',
};

const spinnerStyle: CSSProperties = {
  width: 36,
  height: 36,
  border: '4px solid var(--color-border-default)',
  borderTopColor: 'var(--color-blue)',
  borderRadius: '50%',
};

const emptyStyle: CSSProperties = {
  padding: 40,
  textAlign: 'center',
  color: 'var(--color-text-muted)',
  fontSize: 15,
};

const machineStatsStripStyle: CSSProperties = {
  display: 'flex',
  gap: 8,
  flexWrap: 'wrap',
  marginBottom: 16,
};

const machineStatsChipStyle: CSSProperties = {
  display: 'inline-block',
  padding: '4px 12px',
  borderRadius: 14,
  fontSize: 12,
  fontWeight: 600,
  backgroundColor: 'var(--color-bg-elevated)',
  color: 'var(--color-text-muted)',
};

// â”€â”€â”€ Main Component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export default function MachinesPage() {
  const { authed } = useStaffAuth();
  const [machines, setMachines] = useState<MachineRow[]>([]);
  const [gyms, setGyms] = useState<GymOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Gym selector state (admin page only â€” wizard has no selector)
  const [formGymId, setFormGymId] = useState('');

  async function fetchMachines() {
    try {
      const { data, error: fetchError } = await supabase
        .from('machines')
        .select('id, name, qr_slug, target_muscles, setup_steps, safety_cues, movement_pattern, equipment_type, difficulty, primary_muscles, secondary_muscles, gym_id, gyms(name)')
        .order('name', { ascending: true });

      if (fetchError) {
        setError(fetchError.message);
        return;
      }

      setMachines((data as unknown as MachineRow[]) ?? []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load machines');
    }
  }

  async function fetchGyms() {
    const { data, error: err } = await supabase
      .from('gyms')
      .select('id, name, slug')
      .order('name', { ascending: true });
    if (err) { console.warn('[machines] fetchGyms failed:', err.message); }
    setGyms((data as GymOption[]) ?? []);
  }

  useEffect(() => {
    if (!authed) return;
    async function init() {
      setLoading(true);
      await Promise.all([fetchMachines(), fetchGyms()]);
      setLoading(false);
    }
    init();
  }, [authed]);

  function resetForm() {
    setFormGymId('');
    setShowForm(false);
    setError(null);
  }

  /**
   * handleCreate: keeps the EXISTING admin-page submission path.
   * Uses client-side supabase insert + fetchMachineMistakes (edge fn) with
   * generateMachineMistakes (template-based) fallback.
   * The gym selector on this page drives gym_id selection.
   */
  async function handleCreate(values: MachineFormValues) {
    setError(null);

    if (!formGymId) {
      setError('Please select a gym.');
      return;
    }

    setSubmitting(true);

    const selectedGym = gyms.find((g) => g.id === formGymId);
    const gymSlug = selectedGym?.slug ?? 'gym';
    const qrSlug = generateQrSlug(gymSlug, values.name);

    // Generate common mistakes via edge function (falls back to template-based)
    let commonMistakes: string[] = [];
    try {
      const aiResult = await fetchMachineMistakes({
        machineName: values.name,
        targetMuscles: values.target_muscles,
        setupSteps: values.setup_steps,
      });
      if (aiResult.ok && aiResult.data.length > 0) {
        commonMistakes = aiResult.data;
      } else {
        commonMistakes = await generateMachineMistakes({
          machineName: values.name,
          targetMuscles: values.target_muscles,
          setupSteps: values.setup_steps,
        });
      }
    } catch (err) {
      console.warn('AI generation failed, using template fallback:', err);
    }

    const { error: insertError } = await supabase.from('machines').insert({
      name: values.name,
      gym_id: formGymId,
      qr_slug: qrSlug,
      target_muscles: values.target_muscles,
      setup_steps: values.setup_steps,
      safety_cues: values.safety_cues,
      common_mistakes: commonMistakes,
      cue_version: 1,
      cue_source: commonMistakes.length > 0 ? 'gemini' : 'admin',
      movement_pattern: values.movement_pattern,
      equipment_type: values.equipment_type,
      difficulty: values.difficulty,
      primary_muscles: values.target_muscles,
      secondary_muscles: [],
    });

    setSubmitting(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    resetForm();
    await fetchMachines();
  }

  async function handleDelete(id: string, name: string) {
    if (!window.confirm(`Are you sure you want to delete "${name}"? This cannot be undone.`)) {
      return;
    }

    const { error: deleteError } = await supabase
      .from('machines')
      .delete()
      .eq('id', id);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    await fetchMachines();
  }

  if (loading) {
    return (
      <div style={{ padding: '24px' }}>
        <PageHeader
          title="Machines"
          description="Manage gym machines, monitor status, and configure settings for each piece of equipment."
        />
        <div style={loadingContainerStyle}>
          <div style={spinnerStyle} className="spinner-enhanced" />
        </div>
      </div>
    );
  }

  return (
    <AnimatedPage>
      <div style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
          <PageHeader
            title="Machines"
            description="Manage gym machines, monitor status, and configure settings for each piece of equipment."
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              style={{ ...addButtonStyle, backgroundColor: 'var(--color-bg-highest)' }}
              onClick={() => {
                window.open('/api/machines/qr-pdf', '_blank');
              }}
            >
              Export QR PDF
            </button>
            <button style={addButtonStyle} className="btn-primary" onClick={() => setShowForm(!showForm)}>
              {showForm ? 'Cancel' : 'Add Machine'}
            </button>
          </div>
        </div>

        {error && <div style={errorBoxStyle} className="error-shake">{error}</div>}

        {/* â”€â”€ Stats strip â”€â”€ */}
        {machines.length > 0 && (() => {
          const byType = new Map<string, number>();
          const byDiff = new Map<string, number>();
          for (const m of machines) {
            if (m.equipment_type && m.equipment_type !== 'unknown') {
              byType.set(m.equipment_type, (byType.get(m.equipment_type) ?? 0) + 1);
            }
            if (m.difficulty) {
              byDiff.set(m.difficulty, (byDiff.get(m.difficulty) ?? 0) + 1);
            }
          }
          const topType = [...byType.entries()].sort((a, b) => b[1] - a[1])[0];
          return (
            <div style={machineStatsStripStyle}>
              <span style={machineStatsChipStyle}>{machines.length} machines</span>
              {topType && <span style={{ ...machineStatsChipStyle, backgroundColor: 'var(--color-purple-subtle)', color: 'var(--color-purple)' }}>{topType[1]} {topType[0]}</span>}
              {byDiff.get('beginner') && <span style={{ ...machineStatsChipStyle, backgroundColor: 'var(--color-green-subtle)', color: 'var(--color-green)' }}>{byDiff.get('beginner')} beginner</span>}
              {byDiff.get('intermediate') && <span style={{ ...machineStatsChipStyle, backgroundColor: 'var(--color-gold-subtle)', color: 'var(--color-gold)' }}>{byDiff.get('intermediate')} intermediate</span>}
              {byDiff.get('advanced') && <span style={{ ...machineStatsChipStyle, backgroundColor: 'var(--color-red-subtle)', color: 'var(--color-red)' }}>{byDiff.get('advanced')} advanced</span>}
              <span style={{ ...machineStatsChipStyle, backgroundColor: 'var(--color-blue-subtle)', color: 'var(--color-blue)' }}>{new Set(machines.map(m => m.gym_id)).size} gym{new Set(machines.map(m => m.gym_id)).size !== 1 ? 's' : ''}</span>
            </div>
          );
        })()}

        {showForm && (
          <div style={formContainerStyle} className="form-slide-down">
            <h3 style={formTitleStyle}>Add New Machine</h3>

            {/* Gym selector stays in the page (admin context) */}
            <div style={fieldStyle}>
              <label style={labelStyle} htmlFor="page-machine-gym">Gym</label>
              <select
                id="page-machine-gym"
                style={selectStyle}
                className="input-animate"
                value={formGymId}
                onChange={(e) => setFormGymId(e.target.value)}
                required
              >
                <option value="">Select a gym...</option>
                {gyms.map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>

            <MachineForm
              onSubmit={handleCreate}
              submitting={submitting}
              error={null}
              onCancel={resetForm}
            />
          </div>
        )}

        <div style={tableContainerStyle} className="section-glow">
          {machines.length === 0 ? (
            <p style={emptyStyle} className="empty-breathe">No machines found. Add your first machine above.</p>
          ) : (
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Name</th>
                  <th style={thStyle}>Gym</th>
                  <th style={thStyle}>Target Muscles</th>
                  <th style={thStyle}>Classification</th>
                  <th style={thStyle}>QR Slug</th>
                  <th style={thStyle}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {machines.map((m, i) => (
                  <tr key={m.id} className={`row-stagger stagger-${Math.min(i, 19)} table-row-hover`}>
                    <td style={{ ...tdStyle, fontWeight: 600 }}>{m.name}</td>
                    <td style={tdStyle}>{m.gyms?.name ?? '--'}</td>
                    <td style={tdStyle}>
                      {m.target_muscles.length > 0
                        ? m.target_muscles.map((muscle) => (
                          <span key={muscle} style={tagStyle}>
                            {muscle}
                          </span>
                        ))
                        : '--'}
                    </td>
                    <td style={tdStyle}>
                      {m.movement_pattern && m.movement_pattern !== 'unknown' && (
                        <span style={metaTagStyle}>{m.movement_pattern}</span>
                      )}
                      {m.equipment_type && m.equipment_type !== 'unknown' && (
                        <span style={{ ...metaTagStyle, backgroundColor: 'var(--color-green-subtle)', color: 'var(--color-green)' }}>{m.equipment_type}</span>
                      )}
                      {m.difficulty && m.difficulty !== 'beginner' && (
                        <span style={{ ...metaTagStyle, backgroundColor: 'var(--color-gold-subtle)', color: 'var(--color-gold)' }}>{m.difficulty}</span>
                      )}
                    </td>
                    <td style={tdStyle}>
                      <code style={slugStyle}>{m.qr_slug}</code>
                    </td>
                    <td style={tdStyle}>
                      <button
                        style={deleteButtonStyle}
                        className="btn-danger"
                        onClick={() => handleDelete(m.id, m.name)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </AnimatedPage>
  );
}

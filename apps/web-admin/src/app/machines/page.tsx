'use client';

import { useEffect, useState, CSSProperties, FormEvent } from 'react';
import { supabase } from '@/lib/supabase';
import { generateQrSlug } from '@smartgym/utils';
import { generateMachineMistakes, GeminiProvider } from '@smartgym/ai-assist';
import { PageHeader } from '../components/PageHeader';
import { AnimatedPage } from '../components/AnimatedPage';

interface MachineRow {
  id: string;
  name: string;
  qr_slug: string;
  target_muscles: string[];
  setup_steps: string[];
  safety_cues: string[];
  gym_id: string;
  gyms: { name: string } | null;
}

interface GymOption {
  id: string;
  name: string;
  slug: string;
}

// ─── Styles ─────────────────────────────────────────────

const addButtonStyle: CSSProperties = {
  padding: '10px 20px',
  fontSize: 14,
  fontWeight: 600,
  color: '#ffffff',
  backgroundColor: '#4fc3f7',
  border: 'none',
  borderRadius: 6,
  cursor: 'pointer',
};

const formContainerStyle: CSSProperties = {
  backgroundColor: '#ffffff',
  borderRadius: 8,
  padding: '24px',
  marginBottom: 24,
  boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
  border: '1px solid #e0e0e0',
};

const formTitleStyle: CSSProperties = {
  fontSize: 18,
  fontWeight: 600,
  color: '#1a1a2e',
  marginTop: 0,
  marginBottom: 20,
};

const formGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 16,
};

const fieldStyle: CSSProperties = {
  marginBottom: 16,
};

const labelStyle: CSSProperties = {
  display: 'block',
  fontSize: 13,
  fontWeight: 600,
  color: '#333',
  marginBottom: 6,
};

const inputStyle: CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  fontSize: 14,
  border: '1px solid #ddd',
  borderRadius: 6,
  boxSizing: 'border-box',
  outline: 'none',
};

const textareaStyle: CSSProperties = {
  ...inputStyle,
  minHeight: 80,
  resize: 'vertical' as const,
  fontFamily: 'inherit',
};

const selectStyle: CSSProperties = {
  ...inputStyle,
  backgroundColor: '#fff',
};

const formActionsStyle: CSSProperties = {
  display: 'flex',
  gap: 12,
  marginTop: 8,
};

const submitButtonStyle: CSSProperties = {
  padding: '10px 24px',
  fontSize: 14,
  fontWeight: 600,
  color: '#ffffff',
  backgroundColor: '#4fc3f7',
  border: 'none',
  borderRadius: 6,
  cursor: 'pointer',
};

const cancelButtonStyle: CSSProperties = {
  padding: '10px 24px',
  fontSize: 14,
  fontWeight: 600,
  color: '#666',
  backgroundColor: '#f0f0f0',
  border: 'none',
  borderRadius: 6,
  cursor: 'pointer',
};

const tableContainerStyle: CSSProperties = {
  backgroundColor: '#ffffff',
  borderRadius: 8,
  boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
  overflow: 'hidden',
};

const tableStyle: CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: 14,
};

const thStyle: CSSProperties = {
  textAlign: 'left',
  padding: '12px 16px',
  backgroundColor: '#fafafa',
  borderBottom: '1px solid #eee',
  fontWeight: 600,
  color: '#555',
  fontSize: 13,
  textTransform: 'uppercase',
  letterSpacing: '0.3px',
};

const tdStyle: CSSProperties = {
  padding: '12px 16px',
  borderBottom: '1px solid #f0f0f0',
  color: '#333',
};

const tagStyle: CSSProperties = {
  display: 'inline-block',
  padding: '2px 8px',
  backgroundColor: '#e3f2fd',
  color: '#1565c0',
  borderRadius: 4,
  fontSize: 12,
  marginRight: 4,
  marginBottom: 2,
};

const slugStyle: CSSProperties = {
  fontFamily: 'monospace',
  fontSize: 13,
  color: '#666',
  backgroundColor: '#f5f5f5',
  padding: '2px 6px',
  borderRadius: 4,
};

const deleteButtonStyle: CSSProperties = {
  padding: '6px 14px',
  fontSize: 13,
  fontWeight: 600,
  color: '#d32f2f',
  backgroundColor: '#fdecea',
  border: 'none',
  borderRadius: 4,
  cursor: 'pointer',
};

const errorBoxStyle: CSSProperties = {
  backgroundColor: '#fdecea',
  color: '#b71c1c',
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
  border: '4px solid #e0e0e0',
  borderTopColor: '#4fc3f7',
  borderRadius: '50%',
};

const emptyStyle: CSSProperties = {
  padding: 40,
  textAlign: 'center',
  color: '#999',
  fontSize: 15,
};



export default function MachinesPage() {
  const [machines, setMachines] = useState<MachineRow[]>([]);
  const [gyms, setGyms] = useState<GymOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [formName, setFormName] = useState('');
  const [formGymId, setFormGymId] = useState('');
  const [formTargetMuscles, setFormTargetMuscles] = useState('');
  const [formSetupSteps, setFormSetupSteps] = useState('');
  const [formSafetyCues, setFormSafetyCues] = useState('');

  async function fetchMachines() {
    try {
      const { data, error: fetchError } = await supabase
        .from('machines')
        .select('id, name, qr_slug, target_muscles, setup_steps, safety_cues, gym_id, gyms(name)')
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
    const { data } = await supabase
      .from('gyms')
      .select('id, name, slug')
      .order('name', { ascending: true });
    setGyms((data as GymOption[]) ?? []);
  }

  useEffect(() => {
    async function init() {
      setLoading(true);
      await Promise.all([fetchMachines(), fetchGyms()]);
      setLoading(false);
    }
    init();
  }, []);

  function resetForm() {
    setFormName('');
    setFormGymId('');
    setFormTargetMuscles('');
    setFormSetupSteps('');
    setFormSafetyCues('');
    setShowForm(false);
    setError(null);
  }

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const selectedGym = gyms.find((g) => g.id === formGymId);
    const gymSlug = selectedGym?.slug ?? 'gym';
    const qrSlug = generateQrSlug(gymSlug, formName);

    const targetMuscles = formTargetMuscles
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const setupSteps = formSetupSteps
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
    const safetyCues = formSafetyCues
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);

    // Generate common mistakes via Gemini (falls back to template if key absent)
    let commonMistakes: string[] = [];
    try {
      commonMistakes = await generateMachineMistakes({
        machineName: formName,
        targetMuscles,
        setupSteps,
        provider: new GeminiProvider(),
      });
    } catch {
      // Non-fatal — machine is created without AI mistakes
    }

    const { error: insertError } = await supabase.from('machines').insert({
      name: formName,
      gym_id: formGymId,
      qr_slug: qrSlug,
      target_muscles: targetMuscles,
      setup_steps: setupSteps,
      safety_cues: safetyCues,
      common_mistakes: commonMistakes,
      cue_version: 1,
      cue_source: commonMistakes.length > 0 ? 'gemini' : 'admin',
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
          <button style={addButtonStyle} className="btn-primary" onClick={() => setShowForm(!showForm)}>
            {showForm ? 'Cancel' : 'Add Machine'}
          </button>
        </div>

        {error && <div style={errorBoxStyle} className="error-shake">{error}</div>}

        {showForm && (
          <div style={formContainerStyle} className="form-slide-down">
            <h3 style={formTitleStyle}>Add New Machine</h3>
            <form onSubmit={handleAdd}>
              <div style={formGridStyle}>
                <div style={fieldStyle}>
                  <label style={labelStyle} htmlFor="machine-name">
                    Machine Name
                  </label>
                  <input
                    id="machine-name"
                    style={inputStyle}
                    className="input-animate"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g. Lat Pulldown"
                    required
                  />
                </div>
                <div style={fieldStyle}>
                  <label style={labelStyle} htmlFor="machine-gym">
                    Gym
                  </label>
                  <select
                    id="machine-gym"
                    style={selectStyle}
                    className="input-animate"
                    value={formGymId}
                    onChange={(e) => setFormGymId(e.target.value)}
                    required
                  >
                    <option value="">Select a gym...</option>
                    {gyms.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div style={fieldStyle}>
                <label style={labelStyle} htmlFor="machine-muscles">
                  Target Muscles (comma-separated)
                </label>
                <input
                  id="machine-muscles"
                  style={inputStyle}
                  className="input-animate"
                  value={formTargetMuscles}
                  onChange={(e) => setFormTargetMuscles(e.target.value)}
                  placeholder="e.g. lats, biceps, upper back"
                />
              </div>
              <div style={formGridStyle}>
                <div style={fieldStyle}>
                  <label style={labelStyle} htmlFor="machine-setup">
                    Setup Steps (one per line)
                  </label>
                  <textarea
                    id="machine-setup"
                    style={textareaStyle}
                    className="input-animate"
                    value={formSetupSteps}
                    onChange={(e) => setFormSetupSteps(e.target.value)}
                    placeholder={"Adjust the seat height\nSet the weight\nGrip the handles"}
                  />
                </div>
                <div style={fieldStyle}>
                  <label style={labelStyle} htmlFor="machine-safety">
                    Safety Cues (one per line)
                  </label>
                  <textarea
                    id="machine-safety"
                    style={textareaStyle}
                    className="input-animate"
                    value={formSafetyCues}
                    onChange={(e) => setFormSafetyCues(e.target.value)}
                    placeholder={"Keep back straight\nDon't lock elbows\nBreathe steadily"}
                  />
                </div>
              </div>
              {formGymId && formName && (
                <p style={{ fontSize: 13, color: '#888', margin: '0 0 12px' }}>
                  QR Slug:{' '}
                  <code style={slugStyle}>
                    {generateQrSlug(gyms.find((g) => g.id === formGymId)?.slug ?? 'gym', formName)}
                  </code>
                </p>
              )}
              <div style={formActionsStyle}>
                <button type="submit" style={submitButtonStyle} className="btn-primary" disabled={submitting}>
                  {submitting ? 'Adding...' : 'Add Machine'}
                </button>
                <button type="button" style={cancelButtonStyle} className="btn-secondary" onClick={resetForm}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        <div style={tableContainerStyle}>
          {machines.length === 0 ? (
            <p style={emptyStyle} className="empty-breathe">No machines found. Add your first machine above.</p>
          ) : (
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Name</th>
                  <th style={thStyle}>Gym</th>
                  <th style={thStyle}>Target Muscles</th>
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

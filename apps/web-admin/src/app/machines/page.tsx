'use client';

import { useEffect, useState, CSSProperties, FormEvent } from 'react';
import { supabase } from '@/lib/supabase';
import { generateQrSlug } from '@smartgym/utils';
import { generateMachineMistakes } from '@smartgym/ai-assist';
import { fetchMachineMistakes } from '@/lib/aiService';
import { PageHeader } from '../components/PageHeader';
import { AnimatedPage } from '../components/AnimatedPage';

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

const MOVEMENT_PATTERNS = ['push', 'pull', 'squat', 'hinge', 'carry', 'core', 'isolation', 'unknown'] as const;
const EQUIPMENT_TYPES = ['machine', 'cable', 'dumbbell', 'barbell', 'bodyweight', 'smith', 'cardio', 'unknown'] as const;
const DIFFICULTY_LEVELS = ['beginner', 'intermediate', 'advanced'] as const;

const COMMON_MUSCLES = [
  'chest', 'triceps', 'front deltoids', 'rear deltoids', 'lats',
  'biceps', 'rhomboids', 'traps', 'quadriceps', 'hamstrings',
  'glutes', 'calves', 'core', 'obliques', 'forearms',
  'hip flexors', 'lower back', 'upper back', 'shoulders',
];

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
  borderRadius: 10,
  padding: '24px',
  marginBottom: 24,
  border: '1px solid rgba(79, 195, 247, 0.15)',
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

const formGrid3Style: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr 1fr',
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
  borderRadius: 10,
  overflow: 'hidden',
  border: '1px solid rgba(0,0,0,0.06)',
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

const metaTagStyle: CSSProperties = {
  ...tagStyle,
  backgroundColor: '#f3e5f5',
  color: '#7b1fa2',
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

const sectionDividerStyle: CSSProperties = {
  borderTop: '1px solid #eee',
  marginTop: 16,
  marginBottom: 16,
  paddingTop: 16,
};

const sectionLabelStyle: CSSProperties = {
  fontSize: 14,
  fontWeight: 600,
  color: '#4fc3f7',
  marginBottom: 12,
};

const muscleChipStyle: CSSProperties = {
  display: 'inline-block',
  padding: '4px 10px',
  margin: '2px 4px 2px 0',
  borderRadius: 16,
  fontSize: 12,
  cursor: 'pointer',
  border: '1px solid #ddd',
  transition: 'all 0.15s',
};

const muscleChipActiveStyle: CSSProperties = {
  ...muscleChipStyle,
  backgroundColor: '#4fc3f7',
  color: '#fff',
  borderColor: '#4fc3f7',
};

const tagInputContainerStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 4,
  padding: '6px 8px',
  border: '1px solid #ddd',
  borderRadius: 6,
  minHeight: 38,
  alignItems: 'center',
};

const tagChipStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  padding: '2px 8px',
  backgroundColor: '#e8eaf6',
  color: '#3949ab',
  borderRadius: 12,
  fontSize: 12,
};

const tagRemoveStyle: CSSProperties = {
  cursor: 'pointer',
  fontWeight: 700,
  fontSize: 14,
  lineHeight: 1,
  color: '#7986cb',
};

const tagInputStyle: CSSProperties = {
  border: 'none',
  outline: 'none',
  fontSize: 13,
  flex: 1,
  minWidth: 80,
  padding: '2px 0',
};

// ─── Multi-select muscle component ──────────────────────

function MuscleMultiSelect({
  selected,
  onChange,
  label,
  id,
}: {
  selected: string[];
  onChange: (muscles: string[]) => void;
  label: string;
  id: string;
}) {
  return (
    <div style={fieldStyle}>
      <label style={labelStyle} htmlFor={id}>{label}</label>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
        {COMMON_MUSCLES.map((muscle) => {
          const isActive = selected.includes(muscle);
          return (
            <span
              key={muscle}
              style={isActive ? muscleChipActiveStyle : muscleChipStyle}
              onClick={() => {
                if (isActive) {
                  onChange(selected.filter((m) => m !== muscle));
                } else {
                  onChange([...selected, muscle]);
                }
              }}
            >
              {muscle}
            </span>
          );
        })}
      </div>
    </div>
  );
}

// ─── Tag input component ────────────────────────────────

function TagInput({
  tags,
  onChange,
  label,
  id,
  placeholder,
}: {
  tags: string[];
  onChange: (tags: string[]) => void;
  label: string;
  id: string;
  placeholder?: string;
}) {
  const [inputValue, setInputValue] = useState('');

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if ((e.key === 'Enter' || e.key === ',') && inputValue.trim()) {
      e.preventDefault();
      const newTag = inputValue.trim();
      if (!tags.includes(newTag)) {
        onChange([...tags, newTag]);
      }
      setInputValue('');
    }
    if (e.key === 'Backspace' && !inputValue && tags.length > 0) {
      onChange(tags.slice(0, -1));
    }
  }

  return (
    <div style={fieldStyle}>
      <label style={labelStyle} htmlFor={id}>{label}</label>
      <div style={tagInputContainerStyle}>
        {tags.map((tag) => (
          <span key={tag} style={tagChipStyle}>
            {tag}
            <span style={tagRemoveStyle} onClick={() => onChange(tags.filter((t) => t !== tag))}>
              &times;
            </span>
          </span>
        ))}
        <input
          id={id}
          style={tagInputStyle}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={tags.length === 0 ? (placeholder ?? 'Type and press Enter...') : ''}
        />
      </div>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────

export default function MachinesPage() {
  const [machines, setMachines] = useState<MachineRow[]>([]);
  const [gyms, setGyms] = useState<GymOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state — base
  const [formName, setFormName] = useState('');
  const [formGymId, setFormGymId] = useState('');
  const [formTargetMuscles, setFormTargetMuscles] = useState('');
  const [formSetupSteps, setFormSetupSteps] = useState('');
  const [formSafetyCues, setFormSafetyCues] = useState('');

  // Form state — Phase 2.5.2 machine tagging
  const [formMovementPattern, setFormMovementPattern] = useState('unknown');
  const [formEquipmentType, setFormEquipmentType] = useState('machine');
  const [formDifficulty, setFormDifficulty] = useState('beginner');
  const [formPrimaryMuscles, setFormPrimaryMuscles] = useState<string[]>([]);
  const [formSecondaryMuscles, setFormSecondaryMuscles] = useState<string[]>([]);
  const [formTags, setFormTags] = useState<string[]>([]);

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
    setFormMovementPattern('unknown');
    setFormEquipmentType('machine');
    setFormDifficulty('beginner');
    setFormPrimaryMuscles([]);
    setFormSecondaryMuscles([]);
    setFormTags([]);
    setShowForm(false);
    setError(null);
  }

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    setError(null);

    // Client-side validation
    if (!formName.trim()) {
      setError('Machine name is required.');
      return;
    }
    if (formName.trim().length > 100) {
      setError('Machine name must be 100 characters or less.');
      return;
    }
    if (!formGymId) {
      setError('Please select a gym.');
      return;
    }

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

    // Generate common mistakes via edge function (falls back to template-based)
    let commonMistakes: string[] = [];
    try {
      const aiResult = await fetchMachineMistakes({ machineName: formName, targetMuscles, setupSteps });
      if (aiResult.ok && aiResult.data.length > 0) {
        commonMistakes = aiResult.data;
      } else {
        commonMistakes = await generateMachineMistakes({ machineName: formName, targetMuscles, setupSteps });
      }
    } catch (err) {
      console.warn('AI generation failed, using template fallback:', err);
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
      movement_pattern: formMovementPattern,
      equipment_type: formEquipmentType,
      difficulty: formDifficulty,
      primary_muscles: formPrimaryMuscles,
      secondary_muscles: formSecondaryMuscles,
      tags: formTags.length > 0 ? formTags : null,
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

              {/* ─── Phase 2.5.2: Machine Tagging ──────────── */}
              <div style={sectionDividerStyle}>
                <p style={sectionLabelStyle}>Machine Classification</p>
                <div style={formGrid3Style}>
                  <div style={fieldStyle}>
                    <label style={labelStyle} htmlFor="machine-movement">
                      Movement Pattern
                    </label>
                    <select
                      id="machine-movement"
                      style={selectStyle}
                      className="input-animate"
                      value={formMovementPattern}
                      onChange={(e) => setFormMovementPattern(e.target.value)}
                    >
                      {MOVEMENT_PATTERNS.map((p) => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  </div>
                  <div style={fieldStyle}>
                    <label style={labelStyle} htmlFor="machine-equipment">
                      Equipment Type
                    </label>
                    <select
                      id="machine-equipment"
                      style={selectStyle}
                      className="input-animate"
                      value={formEquipmentType}
                      onChange={(e) => setFormEquipmentType(e.target.value)}
                    >
                      {EQUIPMENT_TYPES.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                  <div style={fieldStyle}>
                    <label style={labelStyle} htmlFor="machine-difficulty">
                      Difficulty
                    </label>
                    <select
                      id="machine-difficulty"
                      style={selectStyle}
                      className="input-animate"
                      value={formDifficulty}
                      onChange={(e) => setFormDifficulty(e.target.value)}
                    >
                      {DIFFICULTY_LEVELS.map((d) => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <MuscleMultiSelect
                  selected={formPrimaryMuscles}
                  onChange={setFormPrimaryMuscles}
                  label="Primary Muscles"
                  id="machine-primary-muscles"
                />

                <MuscleMultiSelect
                  selected={formSecondaryMuscles}
                  onChange={setFormSecondaryMuscles}
                  label="Secondary Muscles"
                  id="machine-secondary-muscles"
                />

                <TagInput
                  tags={formTags}
                  onChange={setFormTags}
                  label="Tags (optional)"
                  id="machine-tags"
                  placeholder="e.g. compound, beginner-friendly (press Enter)"
                />
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
                        <span style={{ ...metaTagStyle, backgroundColor: '#e8f5e9', color: '#2e7d32' }}>{m.equipment_type}</span>
                      )}
                      {m.difficulty && m.difficulty !== 'beginner' && (
                        <span style={{ ...metaTagStyle, backgroundColor: '#fff3e0', color: '#e65100' }}>{m.difficulty}</span>
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

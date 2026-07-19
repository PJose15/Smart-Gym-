'use client';

import { useState, CSSProperties, FormEvent } from 'react';

// ─── Constants (exported for reuse) ─────────────────────

export const MOVEMENT_PATTERNS = [
  'push', 'pull', 'squat', 'hinge', 'carry', 'core', 'isolation', 'unknown',
] as const;

export const EQUIPMENT_TYPES = [
  'machine', 'cable', 'dumbbell', 'barbell', 'bodyweight', 'smith', 'cardio', 'unknown',
] as const;

export const DIFFICULTY_LEVELS = ['beginner', 'intermediate', 'advanced'] as const;

export const COMMON_MUSCLES = [
  'chest', 'triceps', 'front deltoids', 'rear deltoids', 'lats',
  'biceps', 'rhomboids', 'traps', 'quadriceps', 'hamstrings',
  'glutes', 'calves', 'core', 'obliques', 'forearms',
  'hip flexors', 'lower back', 'upper back', 'shoulders',
];

// ─── Types ───────────────────────────────────────────────

export interface MachineFormValues {
  name: string;
  target_muscles: string[];
  movement_pattern: string;
  equipment_type: string;
  difficulty: string;
  setup_steps: string[];
  safety_cues: string[];
}

export interface MachineFormProps {
  /** Wizard mode: name + target muscles + equipment type only */
  minimal?: boolean;
  /** Button label, default 'Add Machine' */
  submitLabel?: string;
  submitting?: boolean;
  error?: string | null;
  onSubmit: (values: MachineFormValues) => void | Promise<void>;
  /** Optional cancel handler */
  onCancel?: () => void;
}

// ─── Styles ──────────────────────────────────────────────

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

const textareaStyle: CSSProperties = {
  ...inputStyle,
  minHeight: 80,
  resize: 'vertical' as const,
  fontFamily: 'inherit',
};

const selectStyle: CSSProperties = {
  ...inputStyle,
  backgroundColor: 'var(--color-bg-elevated)',
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
  color: 'var(--color-text-primary)',
  backgroundColor: 'var(--color-blue)',
  border: 'none',
  borderRadius: 6,
  cursor: 'pointer',
};

const cancelButtonStyle: CSSProperties = {
  padding: '10px 24px',
  fontSize: 14,
  fontWeight: 600,
  color: 'var(--color-text-secondary)',
  backgroundColor: 'var(--color-bg-elevated)',
  border: 'none',
  borderRadius: 6,
  cursor: 'pointer',
};

const errorBoxStyle: CSSProperties = {
  backgroundColor: 'var(--color-red-light)',
  color: 'var(--color-red)',
  padding: '14px 18px',
  borderRadius: 8,
  fontSize: 14,
  marginBottom: 16,
};

const sectionDividerStyle: CSSProperties = {
  borderTop: '1px solid var(--color-border-default)',
  marginTop: 16,
  marginBottom: 16,
  paddingTop: 16,
};

const sectionLabelStyle: CSSProperties = {
  fontSize: 14,
  fontWeight: 600,
  color: 'var(--color-blue)',
  marginBottom: 12,
};

const muscleChipStyle: CSSProperties = {
  display: 'inline-block',
  padding: '4px 10px',
  margin: '2px 4px 2px 0',
  borderRadius: 16,
  fontSize: 12,
  cursor: 'pointer',
  border: '1px solid var(--color-border-default)',
  transition: 'all 0.15s',
  color: 'var(--color-text-secondary)',
  backgroundColor: 'transparent',
};

const muscleChipActiveStyle: CSSProperties = {
  ...muscleChipStyle,
  backgroundColor: 'var(--color-blue)',
  color: 'var(--color-text-primary)',
  borderColor: 'var(--color-blue)',
};

// ─── Internal sub-components ─────────────────────────────

function MuscleGrid({
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
              role="checkbox"
              aria-checked={isActive}
              aria-label={muscle}
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

// ─── Main MachineForm component ──────────────────────────

export function MachineForm({
  minimal = false,
  submitLabel = 'Add Machine',
  submitting = false,
  error = null,
  onSubmit,
  onCancel,
}: MachineFormProps) {
  const [name, setName] = useState('');
  const [targetMuscles, setTargetMuscles] = useState<string[]>([]);
  const [movementPattern, setMovementPattern] = useState<string>('unknown');
  const [equipmentType, setEquipmentType] = useState<string>('machine');
  const [difficulty, setDifficulty] = useState<string>('beginner');
  const [setupStepsText, setSetupStepsText] = useState('');
  const [safetyCuesText, setSafetyCuesText] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const setup_steps = setupStepsText
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
    const safety_cues = safetyCuesText
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);

    await onSubmit({
      name,
      target_muscles: targetMuscles,
      movement_pattern: movementPattern,
      equipment_type: equipmentType,
      difficulty,
      setup_steps,
      safety_cues,
    });
  }

  return (
    <form onSubmit={handleSubmit} data-testid="machine-form">
      {error && (
        <div style={errorBoxStyle} role="alert">
          {error}
        </div>
      )}

      {/* Name — always shown */}
      <div style={fieldStyle}>
        <label style={labelStyle} htmlFor="mf-name">
          Machine Name
        </label>
        <input
          id="mf-name"
          style={inputStyle}
          className="input-animate"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Lat Pulldown"
          required
          maxLength={80}
        />
      </div>

      {/* Target muscles — always shown */}
      <MuscleGrid
        selected={targetMuscles}
        onChange={setTargetMuscles}
        label="Target Muscles"
        id="mf-muscles"
      />

      {/* Equipment type — always shown */}
      <div style={fieldStyle}>
        <label style={labelStyle} htmlFor="mf-equipment">
          Equipment Type
        </label>
        <select
          id="mf-equipment"
          style={selectStyle}
          className="input-animate"
          value={equipmentType}
          onChange={(e) => setEquipmentType(e.target.value)}
        >
          {EQUIPMENT_TYPES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>

      {/* Full mode — additional fields */}
      {!minimal && (
        <>
          <div style={sectionDividerStyle}>
            <p style={sectionLabelStyle}>Machine Classification</p>
            <div style={formGrid3Style}>
              <div style={fieldStyle}>
                <label style={labelStyle} htmlFor="mf-movement">
                  Movement Pattern
                </label>
                <select
                  id="mf-movement"
                  style={selectStyle}
                  className="input-animate"
                  value={movementPattern}
                  onChange={(e) => setMovementPattern(e.target.value)}
                >
                  {MOVEMENT_PATTERNS.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
              <div style={fieldStyle}>
                <label style={labelStyle} htmlFor="mf-difficulty">
                  Difficulty
                </label>
                <select
                  id="mf-difficulty"
                  style={selectStyle}
                  className="input-animate"
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value)}
                >
                  {DIFFICULTY_LEVELS.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div style={formGridStyle}>
            <div style={fieldStyle}>
              <label style={labelStyle} htmlFor="mf-setup">
                Setup Steps (one per line)
              </label>
              <textarea
                id="mf-setup"
                style={textareaStyle}
                className="input-animate"
                value={setupStepsText}
                onChange={(e) => setSetupStepsText(e.target.value)}
                placeholder={'Adjust the seat height\nSet the weight\nGrip the handles'}
              />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle} htmlFor="mf-safety">
                Safety Cues (one per line)
              </label>
              <textarea
                id="mf-safety"
                style={textareaStyle}
                className="input-animate"
                value={safetyCuesText}
                onChange={(e) => setSafetyCuesText(e.target.value)}
                placeholder={"Keep back straight\nDon't lock elbows\nBreathe steadily"}
              />
            </div>
          </div>
        </>
      )}

      {/* Actions */}
      <div style={formActionsStyle}>
        <button
          type="submit"
          style={{ ...submitButtonStyle, opacity: submitting ? 0.7 : 1, cursor: submitting ? 'not-allowed' : 'pointer' }}
          className="btn-primary"
          disabled={submitting}
        >
          {submitting ? 'Adding...' : submitLabel}
        </button>
        {onCancel && (
          <button
            type="button"
            style={cancelButtonStyle}
            className="btn-secondary"
            onClick={onCancel}
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

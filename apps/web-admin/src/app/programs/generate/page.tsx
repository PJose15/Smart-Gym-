'use client';

import { useEffect, useState, CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { generateProgram } from '@nexera/ai-assist';
import type { GeneratedProgram, GeneratedProgramDay, ProgramGenerationInput } from '@nexera/ai-assist';
import { fetchGeneratedProgram } from '@/lib/aiService';
import { useStaffAuth } from '@/lib/useStaffAuth';
import { PageHeader } from '../../components/PageHeader';
import { AnimatedPage } from '../../components/AnimatedPage';

// ─── Types ──────────────────────────────────────────────

type Step = 'input' | 'preview' | 'saving';

interface MachineOption {
  id: string;
  name: string;
  target_muscles: string[];
  difficulty: string;
  equipment_type: string;
}

// ─── Styles ─────────────────────────────────────────────

const cardStyle: CSSProperties = {
  backgroundColor: 'var(--color-bg-raised)',
  borderRadius: 'var(--radius-md)' as unknown as number,
  padding: 24,
  border: '1px solid var(--color-border-subtle)',
  marginBottom: 20,
};

const labelStyle: CSSProperties = {
  display: 'block',
  fontSize: 'var(--text-sm)' as unknown as number,
  fontWeight: 600,
  color: 'var(--color-text-primary)',
  marginBottom: 6,
};

const inputStyle: CSSProperties = {
  width: '100%',
  padding: '10px 14px',
  fontSize: 'var(--text-base)' as unknown as number,
  border: '1px solid var(--color-border-default)',
  borderRadius: 'var(--radius-md)' as unknown as number,
  boxSizing: 'border-box',
  outline: 'none',
  backgroundColor: 'var(--color-bg-elevated)',
  color: 'var(--color-text-primary)',
};

const selectStyle: CSSProperties = {
  ...inputStyle,
  backgroundColor: 'var(--color-bg-elevated)',
};

const fieldStyle: CSSProperties = { marginBottom: 16 };

const btnPrimaryStyle: CSSProperties = {
  padding: '12px 28px',
  fontSize: 'var(--text-base)' as unknown as number,
  fontWeight: 600,
  color: 'var(--color-text-primary)',
  backgroundColor: 'var(--color-blue)',
  border: 'none',
  borderRadius: 'var(--radius-md)' as unknown as number,
  cursor: 'pointer',
};

const btnSecondaryStyle: CSSProperties = {
  padding: '12px 28px',
  fontSize: 'var(--text-base)' as unknown as number,
  fontWeight: 600,
  color: 'var(--color-text-secondary)',
  backgroundColor: 'var(--color-bg-elevated)',
  border: 'none',
  borderRadius: 'var(--radius-md)' as unknown as number,
  cursor: 'pointer',
};

const dayCardStyle: CSSProperties = {
  backgroundColor: 'var(--color-bg-elevated)',
  borderRadius: 'var(--radius-md)' as unknown as number,
  padding: 16,
  marginBottom: 12,
  border: '1px solid var(--color-border-subtle)',
};

const exerciseRowStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 80px 80px 40px',
  gap: 8,
  alignItems: 'center',
  padding: '6px 0',
  borderBottom: '1px solid var(--color-border-subtle)',
};

const backLinkStyle: CSSProperties = {
  display: 'inline-block',
  marginBottom: 16,
  fontSize: 'var(--text-base)' as unknown as number,
  color: 'var(--color-blue)',
  textDecoration: 'none',
  fontWeight: 600,
};

const rationaleStyle: CSSProperties = {
  backgroundColor: 'var(--color-blue-subtle)',
  borderRadius: 'var(--radius-md)' as unknown as number,
  padding: 16,
  marginBottom: 20,
  fontSize: 'var(--text-base)' as unknown as number,
  color: 'var(--color-text-primary)',
  lineHeight: 1.6,
  borderLeft: '4px solid var(--color-blue)',
};

const previewStatsStripStyle: CSSProperties = {
  display: 'flex',
  gap: 8,
  flexWrap: 'wrap',
  marginBottom: 16,
};

const previewStatsChipStyle: CSSProperties = {
  display: 'inline-block',
  padding: '4px 12px',
  borderRadius: 14,
  fontSize: 'var(--text-xs)' as unknown as number,
  fontWeight: 600,
  backgroundColor: 'var(--color-bg-elevated)',
  color: 'var(--color-text-secondary)',
};

// ─── Component ──────────────────────────────────────────

export default function GenerateProgramPage() {
  const { authed } = useStaffAuth();
  const router = useRouter();

  // Step
  const [step, setStep] = useState<Step>('input');

  // Input form
  const [goal, setGoal] = useState('');
  const [experience, setExperience] = useState<'beginner' | 'intermediate' | 'advanced'>('intermediate');
  const [daysPerWeek, setDaysPerWeek] = useState(3);
  const [limitations, setLimitations] = useState('');
  const [gymId, setGymId] = useState('');

  // Data
  const [gyms, setGyms] = useState<Array<{ id: string; name: string }>>([]);
  const [machines, setMachines] = useState<MachineOption[]>([]);

  // Generated program (editable)
  const [program, setProgram] = useState<GeneratedProgram | null>(null);

  // Status
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authed) return;
    async function init() {
      const { data: gymData } = await supabase.from('gyms').select('id, name').order('name');
      const gymList = gymData ?? [];
      setGyms(gymList);
      if (gymList.length > 0) setGymId(gymList[0].id);
    }
    init();
  }, [authed]);

  // Fetch machines when gym changes
  useEffect(() => {
    if (!gymId) return;
    async function fetchMachines() {
      const { data } = await supabase
        .from('machines')
        .select('id, name, target_muscles, difficulty, equipment_type')
        .eq('gym_id', gymId)
        .order('name');
      setMachines((data as MachineOption[]) ?? []);
    }
    fetchMachines();
  }, [gymId]);

  // ── Step 1: Generate ──────────────────────────────────

  async function handleGenerate() {
    if (!goal.trim()) { setError('Please enter a goal'); return; }
    setLoading(true);
    setError(null);
    try {
      const input: ProgramGenerationInput = {
        goal: goal.trim(),
        experience,
        daysPerWeek,
        limitations: limitations.split(',').map((l) => l.trim()).filter(Boolean),
        availableMachines: machines,
      };
      // Try AI via edge function, fall back to rules-based generation
      const aiResult = await fetchGeneratedProgram({
        goal: input.goal,
        experience: input.experience,
        daysPerWeek: input.daysPerWeek,
        limitations: input.limitations,
        availableMachines: input.availableMachines.map((m) => ({
          id: m.id,
          name: m.name,
          target_muscles: m.target_muscles,
        })),
      });

      if (aiResult.ok && aiResult.data.days.length > 0) {
        setProgram({ ...aiResult.data, source: 'ai' as const });
      } else {
        const result = await generateProgram(input);
        setProgram(result);
      }
      setStep('preview');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to generate program');
    } finally {
      setLoading(false);
    }
  }

  // ── Step 2: Edit helpers ──────────────────────────────

  function updateExercise(
    dayIndex: number,
    exIndex: number,
    field: 'exercise_name' | 'default_sets' | 'default_reps',
    value: string | number,
  ) {
    if (!program) return;
    const updated = { ...program };
    const days = [...updated.days];
    const day = { ...days[dayIndex] };
    const exercises = [...day.exercises];
    exercises[exIndex] = { ...exercises[exIndex], [field]: value };
    day.exercises = exercises;
    days[dayIndex] = day;
    updated.days = days;
    setProgram(updated);
  }

  function removeExercise(dayIndex: number, exIndex: number) {
    if (!program) return;
    const updated = { ...program };
    const days = [...updated.days];
    const day = { ...days[dayIndex] };
    day.exercises = day.exercises.filter((_, i) => i !== exIndex);
    days[dayIndex] = day;
    updated.days = days;
    setProgram(updated);
  }

  // ── Step 3: Save to DB ────────────────────────────────

  async function handleSave() {
    if (!program || !gymId) return;
    setStep('saving');
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Insert program
      const { data: pgData, error: pgErr } = await supabase
        .from('programs')
        .insert({
          name: program.name,
          description: program.description,
          gym_id: gymId,
          created_by: user.id,
        })
        .select()
        .single();

      if (pgErr) throw pgErr;

      // Insert days and exercises
      for (const day of program.days) {
        const { data: dayData, error: dayErr } = await supabase
          .from('program_days')
          .insert({
            program_id: pgData.id,
            day_number: day.day_number,
            name: day.name,
          })
          .select()
          .single();

        if (dayErr) throw dayErr;

        if (day.exercises.length > 0) {
          const { error: exErr } = await supabase
            .from('program_exercises')
            .insert(
              day.exercises.map((ex, i) => ({
                program_day_id: dayData.id,
                exercise_name: ex.exercise_name,
                machine_id: ex.machine_id,
                order_index: i,
                default_sets: ex.default_sets,
                default_reps: ex.default_reps,
              })),
            );
          if (exErr) throw exErr;
        }
      }

      router.push(`/programs/${pgData.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save program');
      setStep('preview');
    }
  }

  // ─── Render ─────────────────────────────────────────────

  return (
    <AnimatedPage>
      <div style={{ padding: 24, maxWidth: 800, margin: '0 auto' }}>
        <Link href="/programs" style={backLinkStyle}>
          &larr; Back to Programs
        </Link>

        <PageHeader
          title="Generate with AI"
          description="Describe your training goals and we'll create a personalized program"
        />

        {error && (
          <div style={{
            backgroundColor: 'var(--color-red-subtle)', color: 'var(--color-red-light)',
            padding: '14px 18px', borderRadius: 'var(--radius-md)' as unknown as number, fontSize: 'var(--text-base)' as unknown as number, marginBottom: 16,
          }}>
            {error}
          </div>
        )}

        {/* ── Step 1: Input Form ── */}
        {step === 'input' && (
          <div style={cardStyle} className="section-glow">
            <div style={fieldStyle}>
              <label style={labelStyle}>Goal</label>
              <input
                style={inputStyle}
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                placeholder="e.g., Build muscle and strength for upper body"
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
              <div style={fieldStyle}>
                <label style={labelStyle}>Experience</label>
                <select style={selectStyle} value={experience} onChange={(e) => setExperience(e.target.value as typeof experience)}>
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                </select>
              </div>

              <div style={fieldStyle}>
                <label style={labelStyle}>Days per Week</label>
                <select style={selectStyle} value={daysPerWeek} onChange={(e) => setDaysPerWeek(Number(e.target.value))}>
                  {[2, 3, 4, 5, 6].map((d) => (
                    <option key={d} value={d}>{d} days</option>
                  ))}
                </select>
              </div>

              <div style={fieldStyle}>
                <label style={labelStyle}>Gym</label>
                <select style={selectStyle} value={gymId} onChange={(e) => setGymId(e.target.value)}>
                  {gyms.map((g) => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div style={fieldStyle}>
              <label style={labelStyle}>Limitations (comma-separated, optional)</label>
              <input
                style={inputStyle}
                value={limitations}
                onChange={(e) => setLimitations(e.target.value)}
                placeholder="e.g., shoulder injury, no squats"
              />
            </div>

            <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
              <button style={btnPrimaryStyle} onClick={handleGenerate} disabled={loading}>
                {loading ? 'Generating...' : 'Generate Program'}
              </button>
            </div>

            {machines.length > 0 && (
              <p style={{ fontSize: 'var(--text-sm)' as unknown as number, color: 'var(--color-text-muted)', marginTop: 12, marginBottom: 0 }}>
                {machines.length} machines available in selected gym
              </p>
            )}
          </div>
        )}

        {/* ── Step 2: Preview & Edit ── */}
        {step === 'preview' && program && (
          <>
            {/* Preview stats strip */}
            {(() => {
              const totalEx = program.days.reduce((s, d) => s + d.exercises.length, 0);
              const avgSets = totalEx > 0
                ? Math.round(program.days.reduce((s, d) => s + d.exercises.reduce((es, e) => es + e.default_sets, 0), 0) / totalEx * 10) / 10
                : 0;
              return (
                <div style={previewStatsStripStyle}>
                  <span style={previewStatsChipStyle}>{program.days.length} day{program.days.length !== 1 ? 's' : ''}</span>
                  <span style={previewStatsChipStyle}>{totalEx} exercise{totalEx !== 1 ? 's' : ''}</span>
                  <span style={previewStatsChipStyle}>{avgSets} avg sets/exercise</span>
                  <span style={{ ...previewStatsChipStyle, backgroundColor: program.source === 'ai' ? 'var(--color-blue-subtle)' : 'var(--color-bg-elevated)', color: program.source === 'ai' ? 'var(--color-blue-light)' : 'var(--color-text-secondary)' }}>
                    {program.source === 'ai' ? 'AI-generated' : 'Rules-based'}
                  </span>
                </div>
              );
            })()}

            {/* Rationale */}
            <div style={rationaleStyle}>
              <strong>
                {program.source === 'ai' ? 'AI Rationale' : 'Program Rationale'}:
              </strong>{' '}
              {program.overall_rationale}
            </div>

            {/* Program Name */}
            <div style={cardStyle}>
              <div style={fieldStyle}>
                <label style={labelStyle}>Program Name</label>
                <input
                  style={inputStyle}
                  value={program.name}
                  onChange={(e) => setProgram({ ...program, name: e.target.value })}
                />
              </div>
              <div style={fieldStyle}>
                <label style={labelStyle}>Description</label>
                <input
                  style={inputStyle}
                  value={program.description}
                  onChange={(e) => setProgram({ ...program, description: e.target.value })}
                />
              </div>
            </div>

            {/* Days */}
            {program.days.map((day, di) => (
              <div key={di} style={dayCardStyle}>
                <h4 style={{ margin: '0 0 12px 0', fontSize: 16, fontWeight: 600, color: 'var(--color-text-primary)' }}>
                  Day {day.day_number}: {day.name}
                </h4>

                <div style={{ ...exerciseRowStyle, borderBottom: '2px solid var(--color-border-default)', fontWeight: 600, fontSize: 12, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                  <span>Exercise</span>
                  <span>Sets</span>
                  <span>Reps</span>
                  <span></span>
                </div>

                {day.exercises.map((ex, ei) => (
                  <div key={ei} style={exerciseRowStyle}>
                    <input
                      style={{ ...inputStyle, padding: '6px 10px', fontSize: 13 }}
                      value={ex.exercise_name}
                      onChange={(e) => updateExercise(di, ei, 'exercise_name', e.target.value)}
                    />
                    <input
                      style={{ ...inputStyle, padding: '6px 10px', fontSize: 13, textAlign: 'center' }}
                      type="number"
                      value={ex.default_sets}
                      onChange={(e) => updateExercise(di, ei, 'default_sets', Number(e.target.value))}
                      min={1}
                      max={10}
                    />
                    <input
                      style={{ ...inputStyle, padding: '6px 10px', fontSize: 13, textAlign: 'center' }}
                      type="number"
                      value={ex.default_reps}
                      onChange={(e) => updateExercise(di, ei, 'default_reps', Number(e.target.value))}
                      min={1}
                      max={30}
                    />
                    <button
                      style={{ background: 'none', border: 'none', color: 'var(--color-red-light)', cursor: 'pointer', fontSize: 18 }}
                      onClick={() => removeExercise(di, ei)}
                      title="Remove exercise"
                    >
                      &times;
                    </button>
                  </div>
                ))}

                {day.exercises.length === 0 && (
                  <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' as unknown as number, margin: '12px 0' }}>
                    No exercises — this day will be skipped.
                  </p>
                )}
              </div>
            ))}

            <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
              <button style={btnPrimaryStyle} onClick={handleSave}>
                Save Program
              </button>
              <button style={btnSecondaryStyle} onClick={() => setStep('input')}>
                Start Over
              </button>
            </div>
          </>
        )}

        {/* ── Step 3: Saving ── */}
        {step === 'saving' && (
          <div style={{ ...cardStyle, textAlign: 'center', padding: 48 }}>
            <div className="spinner-enhanced" />
            <p style={{ color: 'var(--color-text-secondary)', marginTop: 16 }}>Saving program...</p>
          </div>
        )}
      </div>
    </AnimatedPage>
  );
}

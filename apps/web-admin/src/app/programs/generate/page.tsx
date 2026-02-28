'use client';

import { useEffect, useState, CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { generateProgram } from '@smartgym/ai-assist';
import type { GeneratedProgram, GeneratedProgramDay, ProgramGenerationInput } from '@smartgym/ai-assist';
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
  backgroundColor: '#ffffff',
  borderRadius: 10,
  padding: 24,
  border: '1px solid rgba(0,0,0,0.06)',
  marginBottom: 20,
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
  padding: '10px 14px',
  fontSize: 14,
  border: '1px solid #ddd',
  borderRadius: 8,
  boxSizing: 'border-box',
  outline: 'none',
};

const selectStyle: CSSProperties = {
  ...inputStyle,
  backgroundColor: '#fff',
};

const fieldStyle: CSSProperties = { marginBottom: 16 };

const btnPrimaryStyle: CSSProperties = {
  padding: '12px 28px',
  fontSize: 14,
  fontWeight: 600,
  color: '#ffffff',
  backgroundColor: '#4361ee',
  border: 'none',
  borderRadius: 8,
  cursor: 'pointer',
};

const btnSecondaryStyle: CSSProperties = {
  padding: '12px 28px',
  fontSize: 14,
  fontWeight: 600,
  color: '#666',
  backgroundColor: '#f0f0f0',
  border: 'none',
  borderRadius: 8,
  cursor: 'pointer',
};

const dayCardStyle: CSSProperties = {
  backgroundColor: '#fafafa',
  borderRadius: 8,
  padding: 16,
  marginBottom: 12,
  border: '1px solid #eee',
};

const exerciseRowStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 80px 80px 40px',
  gap: 8,
  alignItems: 'center',
  padding: '6px 0',
  borderBottom: '1px solid #f0f0f0',
};

const backLinkStyle: CSSProperties = {
  display: 'inline-block',
  marginBottom: 16,
  fontSize: 14,
  color: '#4361ee',
  textDecoration: 'none',
  fontWeight: 600,
};

const rationaleStyle: CSSProperties = {
  backgroundColor: '#f0f4ff',
  borderRadius: 8,
  padding: 16,
  marginBottom: 20,
  fontSize: 14,
  color: '#333',
  lineHeight: 1.6,
  borderLeft: '4px solid #4361ee',
};

// ─── Component ──────────────────────────────────────────

export default function GenerateProgramPage() {
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
    async function init() {
      const { data: gymData } = await supabase.from('gyms').select('id, name').order('name');
      const gymList = gymData ?? [];
      setGyms(gymList);
      if (gymList.length > 0) setGymId(gymList[0].id);
    }
    init();
  }, []);

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
      const result = await generateProgram(input);
      setProgram(result);
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
            backgroundColor: '#fdecea', color: '#b71c1c',
            padding: '14px 18px', borderRadius: 8, fontSize: 14, marginBottom: 16,
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
              <p style={{ fontSize: 13, color: '#999', marginTop: 12, marginBottom: 0 }}>
                {machines.length} machines available in selected gym
              </p>
            )}
          </div>
        )}

        {/* ── Step 2: Preview & Edit ── */}
        {step === 'preview' && program && (
          <>
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
                <h4 style={{ margin: '0 0 12px 0', fontSize: 16, fontWeight: 600, color: '#333' }}>
                  Day {day.day_number}: {day.name}
                </h4>

                <div style={{ ...exerciseRowStyle, borderBottom: '2px solid #ddd', fontWeight: 600, fontSize: 12, color: '#888', textTransform: 'uppercase' }}>
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
                      style={{ background: 'none', border: 'none', color: '#e53935', cursor: 'pointer', fontSize: 18 }}
                      onClick={() => removeExercise(di, ei)}
                      title="Remove exercise"
                    >
                      &times;
                    </button>
                  </div>
                ))}

                {day.exercises.length === 0 && (
                  <p style={{ color: '#999', fontSize: 13, margin: '12px 0' }}>
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
            <p style={{ color: '#666', marginTop: 16 }}>Saving program...</p>
          </div>
        )}
      </div>
    </AnimatedPage>
  );
}

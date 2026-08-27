'use client';

import { useEffect, useState, useCallback, CSSProperties, FormEvent } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { AnimatedPage } from '../../components/AnimatedPage';
import type {
  Program,
  ProgramDay,
  ProgramExercise,
  Machine,
} from '@nexera/types';

/* ── Joined types ──────────────────────────────────────── */

type ProgramDayWithExercises = ProgramDay & {
  program_exercises: ProgramExercise[];
};

type ProgramFull = Program & {
  program_days: ProgramDayWithExercises[];
};

// Program roster rows returned by /api/admin/programs/[id]/members.
interface AssignedMember {
  assignment_id: string;
  member_id: string;
  name: string;
  email: string | null;
}

interface UnassignedMember {
  member_id: string;
  name: string;
  email: string | null;
}

/* ── Component ─────────────────────────────────────────── */

export default function ProgramDetailPage() {
  const params = useParams<{ id: string }>();
  const programId = params.id;

  // Core data
  const [program, setProgram] = useState<ProgramFull | null>(null);
  const [machines, setMachines] = useState<Pick<Machine, 'id' | 'name'>[]>([]);
  const [unassignedMembers, setUnassignedMembers] = useState<UnassignedMember[]>([]);
  const [assignments, setAssignments] = useState<AssignedMember[]>([]);

  // UI state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());

  // Inline editing
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState('');
  const [editingDesc, setEditingDesc] = useState(false);
  const [descValue, setDescValue] = useState('');

  // Add day form
  const [newDayName, setNewDayName] = useState('');
  const [addingDay, setAddingDay] = useState(false);

  // Add exercise form state (keyed by day id)
  const [exerciseForms, setExerciseForms] = useState<
    Record<string, { name: string; machineId: string; sets: number; reps: number }>
  >({});

  // Assignment
  const [assignMemberId, setAssignMemberId] = useState('');

  /* ── Fetching ──────────────────────────────────────── */

  const fetchProgram = useCallback(async () => {
    const { data, error: err } = await supabase
      .from('programs')
      .select('*, program_days(*, program_exercises(*))')
      .eq('id', programId)
      .single();
    if (err) {
      setError(err.message);
      return null;
    }
    const prog = data as ProgramFull;
    // Sort days by day_number, exercises by order_index
    prog.program_days.sort((a, b) => a.day_number - b.day_number);
    prog.program_days.forEach((d) =>
      d.program_exercises.sort((a, b) => a.order_index - b.order_index)
    );
    setProgram(prog);
    setNameValue(prog.name);
    setDescValue(prog.description ?? '');
    return prog;
  }, [programId]);

  const fetchMachines = useCallback(
    async (gymId: string) => {
      const { data } = await supabase
        .from('machines')
        .select('id, name')
        .eq('gym_id', gymId);
      setMachines((data as Pick<Machine, 'id' | 'name'>[]) ?? []);
    },
    []
  );

  const fetchRoster = useCallback(async () => {
    const res = await fetch(`/api/admin/programs/${programId}/members`);
    if (!res.ok) return;
    const data = await res.json();
    setAssignments((data.assigned as AssignedMember[]) ?? []);
    setUnassignedMembers((data.unassigned as UnassignedMember[]) ?? []);
  }, [programId]);

  useEffect(() => {
    async function init() {
      setLoading(true);
      const prog = await fetchProgram();
      if (prog) {
        await Promise.all([
          fetchMachines(prog.gym_id),
          fetchRoster(),
        ]);
      }
      setLoading(false);
    }
    init();
  }, [fetchProgram, fetchMachines, fetchRoster]);

  /* ── Mutations ─────────────────────────────────────── */

  async function saveName() {
    if (!program || !nameValue.trim()) return;
    const { error: err } = await supabase.from('programs').update({ name: nameValue.trim() }).eq('id', program.id);
    if (err) { setError(err.message); return; }
    setProgram({ ...program, name: nameValue.trim() });
    setEditingName(false);
  }

  async function saveDescription() {
    if (!program) return;
    const val = descValue.trim() || null;
    const { error: err } = await supabase.from('programs').update({ description: val }).eq('id', program.id);
    if (err) { setError(err.message); return; }
    setProgram({ ...program, description: val });
    setEditingDesc(false);
  }

  async function addDay(e: FormEvent) {
    e.preventDefault();
    if (!program || !newDayName.trim()) return;
    setAddingDay(true);
    const dayNumber = program.program_days.length + 1;
    const { data, error: err } = await supabase
      .from('program_days')
      .insert({ program_id: program.id, day_number: dayNumber, name: newDayName.trim() })
      .select()
      .single();
    if (!err && data) {
      const newDay: ProgramDayWithExercises = {
        ...(data as ProgramDay),
        program_exercises: [],
      };
      setProgram({
        ...program,
        program_days: [...program.program_days, newDay],
      });
      setExpandedDays((prev) => new Set(prev).add(newDay.id));
      setNewDayName('');
    }
    setAddingDay(false);
  }

  async function addExercise(dayId: string) {
    if (!program) return;
    const form = exerciseForms[dayId];
    if (!form || !form.name.trim()) return;

    const day = program.program_days.find((d) => d.id === dayId);
    const orderIndex = day ? day.program_exercises.length : 0;

    const { data, error: err } = await supabase
      .from('program_exercises')
      .insert({
        program_day_id: dayId,
        exercise_name: form.name.trim(),
        machine_id: form.machineId || null,
        default_sets: form.sets,
        default_reps: form.reps,
        order_index: orderIndex,
      })
      .select()
      .single();

    if (err) { setError(err.message); return; }
    if (data) {
      const exercise = data as ProgramExercise;
      setProgram({
        ...program,
        program_days: program.program_days.map((d) =>
          d.id === dayId
            ? { ...d, program_exercises: [...d.program_exercises, exercise] }
            : d
        ),
      });
      setExerciseForms((prev) => ({
        ...prev,
        [dayId]: { name: '', machineId: '', sets: 3, reps: 10 },
      }));
    }
  }

  async function assignMember() {
    if (!program || !assignMemberId) return;
    const res = await fetch(`/api/admin/programs/${program.id}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ member_id: assignMemberId }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? 'Failed to assign member');
      return;
    }
    const data = await res.json();
    setAssignments((prev) => [...prev, data.assignment as AssignedMember]);
    setUnassignedMembers((prev) => prev.filter((m) => m.member_id !== assignMemberId));
    setAssignMemberId('');
  }

  async function removeAssignment(assignmentId: string) {
    if (!window.confirm('Are you sure you want to remove this member from the program?')) return;
    const res = await fetch(
      `/api/admin/programs/${programId}/members?assignmentId=${encodeURIComponent(assignmentId)}`,
      { method: 'DELETE' },
    );
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? 'Failed to remove member');
      return;
    }
    // Refresh roster so the removed member reappears in the unassigned list.
    await fetchRoster();
  }

  /* ── Helpers ───────────────────────────────────────── */

  function toggleDay(dayId: string) {
    setExpandedDays((prev) => {
      const next = new Set(prev);
      if (next.has(dayId)) next.delete(dayId);
      else next.add(dayId);
      return next;
    });
  }

  function getExerciseForm(dayId: string) {
    return exerciseForms[dayId] ?? { name: '', machineId: '', sets: 3, reps: 10 };
  }

  function updateExerciseForm(dayId: string, patch: Partial<{ name: string; machineId: string; sets: number; reps: number }>) {
    setExerciseForms((prev) => ({
      ...prev,
      [dayId]: { ...getExerciseForm(dayId), ...patch },
    }));
  }

  function machineName(machineId?: string | null): string | null {
    if (!machineId) return null;
    return machines.find((m) => m.id === machineId)?.name ?? null;
  }

  /* ── Render ────────────────────────────────────────── */

  if (loading) {
    return (
      <div style={centeredStyle}>
        <div style={spinnerStyle} className="spinner-enhanced" />
        <p style={{ color: 'var(--color-text-muted)', marginTop: 16, fontSize: 15 }}>Loading program...</p>
      </div>
    );
  }

  if (error || !program) {
    return (
      <div style={centeredStyle}>
        <p style={{ color: 'var(--color-red-light)', fontSize: 15 }}>
          {error ?? 'Program not found.'}
        </p>
        <Link href="/programs" style={{ color: 'var(--color-blue)', marginTop: 12, fontSize: 14 }}>
          Back to Programs
        </Link>
      </div>
    );
  }

  return (
    <AnimatedPage>
    <div>
      {/* Back link */}
      <Link href="/programs" style={backLinkStyle}>
        &larr; Back to Programs
      </Link>

      {/* ── Program Header ─────────────────────────────── */}
      <div style={sectionCardStyle}>
        {/* Name */}
        {editingName ? (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
            <input
              value={nameValue}
              onChange={(e) => setNameValue(e.target.value)}
              style={{ ...inputStyle, fontSize: 22, fontWeight: 700, flex: 1 }}
              className="input-animate"
              autoFocus
            />
            <button onClick={saveName} style={smallBtnPrimary} className="btn-primary">Save</button>
            <button onClick={() => { setEditingName(false); setNameValue(program.name); }} style={smallBtnSecondary} className="btn-secondary">Cancel</button>
          </div>
        ) : (
          <h1
            style={{ fontSize: 24, fontWeight: 600, margin: '0 0 4px', color: 'var(--color-text-primary)', cursor: 'pointer' }}
            onClick={() => setEditingName(true)}
            title="Click to edit"
          >
            {program.name}
          </h1>
        )}

        {/* Description */}
        {editingDesc ? (
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <textarea
              value={descValue}
              onChange={(e) => setDescValue(e.target.value)}
              style={{ ...inputStyle, flex: 1, minHeight: 60, resize: 'vertical' }}
              className="input-animate"
              autoFocus
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <button onClick={saveDescription} style={smallBtnPrimary} className="btn-primary">Save</button>
              <button onClick={() => { setEditingDesc(false); setDescValue(program.description ?? ''); }} style={smallBtnSecondary} className="btn-secondary">Cancel</button>
            </div>
          </div>
        ) : (
          <p
            style={{ color: 'var(--color-text-secondary)', margin: 0, cursor: 'pointer', fontSize: 14, lineHeight: 1.5 }}
            onClick={() => setEditingDesc(true)}
            title="Click to edit"
          >
            {program.description || 'No description. Click to add one.'}
          </p>
        )}
      </div>

      {/* ── Stats Strip ──────────────────────────────── */}
      <div style={statsStripStyle}>
        <span style={statsChipStyle}>{program.program_days.length} day{program.program_days.length !== 1 ? 's' : ''}</span>
        <span style={statsChipStyle}>
          {program.program_days.reduce((s, d) => s + d.program_exercises.length, 0)} exercise{program.program_days.reduce((s, d) => s + d.program_exercises.length, 0) !== 1 ? 's' : ''}
        </span>
        <span style={statsChipStyle}>{assignments.length} assigned member{assignments.length !== 1 ? 's' : ''}</span>
        <span style={statsChipStyle}>{unassignedMembers.length} unassigned</span>
        <span style={statsChipStyle}>{machines.length} machine{machines.length !== 1 ? 's' : ''} available</span>
      </div>

      {/* ── Days Section ───────────────────────────────── */}
      <div style={{ marginTop: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={sectionTitleStyle}>Days</h2>
        </div>

        {program.program_days.length === 0 && (
          <p style={{ color: 'var(--color-text-muted)', fontSize: 14, marginBottom: 16 }}>
            No days added yet. Add your first training day below.
          </p>
        )}

        {program.program_days.map((day) => {
          const isExpanded = expandedDays.has(day.id);
          const form = getExerciseForm(day.id);

          return (
            <div key={day.id} style={dayCardStyle} className={`card-stagger stagger-${Math.min(day.day_number - 1, 19)}`}>
              {/* Day header */}
              <div
                style={dayHeaderStyle}
                onClick={() => toggleDay(day.id)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 12, color: 'var(--color-text-muted)', transition: 'transform 0.2s', transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)', display: 'inline-block' }}>
                    &#9654;
                  </span>
                  <span style={{ fontWeight: 600, color: 'var(--color-text-primary)', fontSize: 15 }}>
                    Day {day.day_number}: {day.name}
                  </span>
                </div>
                <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
                  {day.program_exercises.length}{' '}
                  {day.program_exercises.length === 1 ? 'exercise' : 'exercises'}
                </span>
              </div>

              {/* Exercises list */}
              {isExpanded && (
                <div style={{ padding: '0 16px 16px' }}>
                  {day.program_exercises.length === 0 ? (
                    <p style={{ color: 'var(--color-text-muted)', fontSize: 13, margin: '12px 0' }}>
                      No exercises yet for this day.
                    </p>
                  ) : (
                    <div style={{ marginTop: 8 }}>
                      {day.program_exercises.map((ex, idx) => (
                        <div key={ex.id} style={exerciseRowStyle}>
                          <span style={{ color: 'var(--color-text-muted)', fontSize: 13, minWidth: 24 }}>
                            {idx + 1}.
                          </span>
                          <span style={{ fontWeight: 500, color: 'var(--color-text-primary)', fontSize: 14, flex: 1 }}>
                            {ex.exercise_name}
                          </span>
                          {machineName(ex.machine_id) && (
                            <span style={machineTagStyle}>
                              {machineName(ex.machine_id)}
                            </span>
                          )}
                          <span style={{ fontSize: 13, color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>
                            {ex.default_sets} x {ex.default_reps}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add exercise form */}
                  <div style={addExerciseFormStyle}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)', margin: '0 0 10px' }}>
                      Add Exercise
                    </p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'flex-end' }}>
                      <div style={{ flex: '2 1 180px' }}>
                        <label style={labelStyle}>Exercise Name</label>
                        <input
                          value={form.name}
                          onChange={(e) => updateExerciseForm(day.id, { name: e.target.value })}
                          placeholder="e.g. Bench Press"
                          style={inputStyle}
                        />
                      </div>
                      <div style={{ flex: '1 1 140px' }}>
                        <label style={labelStyle}>Machine (optional)</label>
                        <select
                          value={form.machineId}
                          onChange={(e) => updateExerciseForm(day.id, { machineId: e.target.value })}
                          style={inputStyle}
                        >
                          <option value="">None</option>
                          {machines.map((m) => (
                            <option key={m.id} value={m.id}>{m.name}</option>
                          ))}
                        </select>
                      </div>
                      <div style={{ flex: '0 0 70px' }}>
                        <label style={labelStyle}>Sets</label>
                        <input
                          type="number"
                          min={1}
                          value={form.sets}
                          onChange={(e) => updateExerciseForm(day.id, { sets: parseInt(e.target.value) || 1 })}
                          style={inputStyle}
                        />
                      </div>
                      <div style={{ flex: '0 0 70px' }}>
                        <label style={labelStyle}>Reps</label>
                        <input
                          type="number"
                          min={1}
                          value={form.reps}
                          onChange={(e) => updateExerciseForm(day.id, { reps: parseInt(e.target.value) || 1 })}
                          style={inputStyle}
                        />
                      </div>
                      <button
                        onClick={() => addExercise(day.id)}
                        disabled={!form.name.trim()}
                        style={{
                          ...smallBtnPrimary,
                          alignSelf: 'flex-end',
                          opacity: form.name.trim() ? 1 : 0.5,
                          cursor: form.name.trim() ? 'pointer' : 'not-allowed',
                        }}
                      >
                        Add
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* Add day form */}
        <form onSubmit={addDay} style={addDayFormStyle}>
          <input
            value={newDayName}
            onChange={(e) => setNewDayName(e.target.value)}
            placeholder="New day name (e.g. Upper Body)"
            style={{ ...inputStyle, flex: 1 }}
          />
          <button
            type="submit"
            disabled={!newDayName.trim() || addingDay}
            style={{
              ...smallBtnPrimary,
              opacity: newDayName.trim() && !addingDay ? 1 : 0.5,
              cursor: newDayName.trim() && !addingDay ? 'pointer' : 'not-allowed',
            }}
          >
            {addingDay ? 'Adding...' : '+ Add Day'}
          </button>
        </form>
      </div>

      {/* ── Assignments Section ────────────────────────── */}
      <div style={{ marginTop: 32 }}>
        <h2 style={sectionTitleStyle}>Assigned Members</h2>

        {assignments.length === 0 ? (
          <p style={{ color: 'var(--color-text-muted)', fontSize: 14, marginBottom: 16 }}>
            No members assigned to this program yet.
          </p>
        ) : (
          <div style={sectionCardStyle}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Name</th>
                  <th style={thStyle}>Email</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {assignments.map((a, i) => (
                  <tr key={a.assignment_id} className={`row-stagger stagger-${Math.min(i, 19)} table-row-hover`}>
                    <td style={tdStyle}>{a.name}</td>
                    <td style={tdStyle}>{a.email ?? '--'}</td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>
                      <button
                        onClick={() => removeAssignment(a.assignment_id)}
                        style={removeBtnStyle}
                        className="btn-danger"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Assign member */}
        <div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'center' }}>
          <select
            value={assignMemberId}
            onChange={(e) => setAssignMemberId(e.target.value)}
            style={{ ...inputStyle, flex: 1, maxWidth: 320 }}
            className="input-animate"
          >
            <option value="">Select a member to assign...</option>
            {unassignedMembers.map((m) => (
              <option key={m.member_id} value={m.member_id}>
                {m.name}{m.email ? ` (${m.email})` : ''}
              </option>
            ))}
          </select>
          <button
            onClick={assignMember}
            disabled={!assignMemberId}
            className="btn-primary"
            style={{
              ...smallBtnPrimary,
              opacity: assignMemberId ? 1 : 0.5,
              cursor: assignMemberId ? 'pointer' : 'not-allowed',
            }}
          >
            Assign
          </button>
        </div>
        {unassignedMembers.length === 0 && assignments.length > 0 && (
          <p style={{ color: 'var(--color-text-muted)', fontSize: 13, marginTop: 8 }}>
            All members are already assigned to this program.
          </p>
        )}
      </div>

    </div>
    </AnimatedPage>
  );
}

/* ── Styles ─────────────────────────────────────────────── */

const centeredStyle: CSSProperties = {
  backgroundColor: 'var(--color-bg-raised)',
  borderRadius: 8,
  padding: 40,
  textAlign: 'center',
  boxShadow: '0 1px 3px rgba(0,0,0,0.24)',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
};

const spinnerStyle: CSSProperties = {
  width: 32,
  height: 32,
  border: '3px solid var(--color-border-default)',
  borderTopColor: 'var(--color-blue)',
  borderRadius: '50%',
};

const backLinkStyle: CSSProperties = {
  display: 'inline-block',
  marginBottom: 20,
  color: 'var(--color-blue)',
  textDecoration: 'none',
  fontSize: 14,
  fontWeight: 500,
};

const sectionCardStyle: CSSProperties = {
  backgroundColor: 'var(--color-bg-raised)',
  borderRadius: 8,
  padding: 24,
  boxShadow: '0 1px 3px rgba(0,0,0,0.24)',
};

const sectionTitleStyle: CSSProperties = {
  fontSize: 18,
  fontWeight: 600,
  color: 'var(--color-text-primary)',
  margin: '0 0 12px',
};

const inputStyle: CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  border: '1px solid var(--color-border-default)',
  borderRadius: 6,
  fontSize: 14,
  outline: 'none',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
  backgroundColor: 'var(--color-bg-elevated)',
  color: 'var(--color-text-primary)',
};

const labelStyle: CSSProperties = {
  display: 'block',
  fontSize: 12,
  fontWeight: 500,
  color: 'var(--color-text-secondary)',
  marginBottom: 4,
};

const smallBtnPrimary: CSSProperties = {
  padding: '8px 16px',
  backgroundColor: 'var(--color-blue)',
  color: 'var(--color-text-primary)',
  border: 'none',
  borderRadius: 6,
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
};

const smallBtnSecondary: CSSProperties = {
  padding: '8px 16px',
  backgroundColor: 'var(--color-bg-elevated)',
  color: 'var(--color-text-primary)',
  border: '1px solid var(--color-border-default)',
  borderRadius: 6,
  fontSize: 13,
  fontWeight: 500,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
};

const dayCardStyle: CSSProperties = {
  backgroundColor: 'var(--color-bg-raised)',
  border: '1px solid var(--color-border-default)',
  borderRadius: 8,
  marginBottom: 12,
  overflow: 'hidden',
};

const dayHeaderStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '14px 16px',
  cursor: 'pointer',
  userSelect: 'none',
  backgroundColor: 'var(--color-bg-elevated)',
};

const exerciseRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: '10px 0',
  borderBottom: '1px solid var(--color-border-subtle)',
};

const machineTagStyle: CSSProperties = {
  fontSize: 12,
  color: 'var(--color-blue)',
  backgroundColor: 'var(--color-blue-subtle)',
  padding: '2px 8px',
  borderRadius: 4,
  fontWeight: 500,
};

const addExerciseFormStyle: CSSProperties = {
  marginTop: 16,
  paddingTop: 16,
  borderTop: '1px dashed var(--color-border-default)',
};

const addDayFormStyle: CSSProperties = {
  display: 'flex',
  gap: 8,
  marginTop: 8,
};

const tableStyle: CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
};

const thStyle: CSSProperties = {
  textAlign: 'left',
  padding: '10px 12px',
  fontSize: 12,
  fontWeight: 600,
  color: 'var(--color-text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  borderBottom: '1px solid var(--color-border-default)',
};

const tdStyle: CSSProperties = {
  padding: '12px',
  fontSize: 14,
  color: 'var(--color-text-primary)',
  borderBottom: '1px solid var(--color-border-subtle)',
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
  backgroundColor: 'var(--color-bg-elevated)',
  color: 'var(--color-text-secondary)',
};

const removeBtnStyle: CSSProperties = {
  padding: '4px 12px',
  backgroundColor: 'transparent',
  color: 'var(--color-red)',
  border: '1px solid var(--color-red)',
  borderRadius: 4,
  fontSize: 12,
  fontWeight: 500,
  cursor: 'pointer',
};

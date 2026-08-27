'use client';

import { useEffect, useState, CSSProperties, FormEvent } from 'react';
import { supabase } from '@/lib/supabase';
import { useStaffAuth } from '@/lib/useStaffAuth';
import { PageHeader } from '../components/PageHeader';
import { AnimatedPage } from '../components/AnimatedPage';

// ─── Types ───────────────────────────────────────────────

interface AssignmentRow {
  id: string;
  gym_id: string;
  trainer_profile_id: string;
  member_profile_id: string;
  status: string;
  created_at: string;
  gym_name: string;
  trainer_name: string;
  member_name: string;
}

interface PersonOption { id: string; name: string; role: 'trainer' | 'owner' | 'member'; }

// ─── Styles ─────────────────────────────────────────────

const addBtnStyle: CSSProperties = {
  padding: '10px 20px', fontSize: 'var(--text-base)' as any, fontWeight: 'var(--weight-medium)' as any, color: 'var(--color-text-primary)',
  backgroundColor: 'var(--color-blue)', border: 'none', borderRadius: 'var(--radius-sm)' as any, cursor: 'pointer',
};

const formContainerStyle: CSSProperties = {
  backgroundColor: 'var(--color-bg-raised)', borderRadius: 'var(--radius-md)' as any, padding: 24, marginBottom: 24,
  border: '1px solid var(--color-border-default)',
};

const formGridStyle: CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 };

const labelStyle: CSSProperties = { display: 'block', fontSize: 'var(--text-sm)' as any, fontWeight: 'var(--weight-medium)' as any, color: 'var(--color-text-primary)', marginBottom: 6 };
const selectStyle: CSSProperties = {
  width: '100%', padding: '8px 12px', fontSize: 'var(--text-base)' as any, border: '1px solid var(--color-border-default)',
  borderRadius: 'var(--radius-sm)' as any, boxSizing: 'border-box', outline: 'none', backgroundColor: 'var(--color-bg-elevated)',
  color: 'var(--color-text-primary)',
};

const tableContainerStyle: CSSProperties = {
  backgroundColor: 'var(--color-bg-raised)', borderRadius: 'var(--radius-md)' as any, overflow: 'hidden', border: '1px solid var(--color-border-subtle)',
};
const tableStyle: CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-base)' as any };
const thStyle: CSSProperties = {
  textAlign: 'left', padding: '12px 16px', backgroundColor: 'var(--color-bg-elevated)', borderBottom: '1px solid var(--color-border-subtle)',
  fontWeight: 'var(--weight-medium)' as any, color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)' as any, textTransform: 'uppercase', letterSpacing: '0.3px',
};
const tdStyle: CSSProperties = { padding: '12px 16px', borderBottom: '1px solid var(--color-border-subtle)', color: 'var(--color-text-primary)' };

const statusBadge = (status: string): CSSProperties => ({
  display: 'inline-block', padding: '3px 10px', borderRadius: 12, fontSize: 12, fontWeight: 'var(--weight-medium)' as any,
  backgroundColor: status === 'active' ? 'var(--color-green-subtle)' : 'var(--color-bg-elevated)',
  color: status === 'active' ? 'var(--color-green-light)' : 'var(--color-text-muted)',
});

const actionBtnStyle: CSSProperties = {
  padding: '5px 12px', fontSize: 12, fontWeight: 'var(--weight-medium)' as any, border: 'none', borderRadius: 5, cursor: 'pointer',
};

const emptyStyle: CSSProperties = { padding: 40, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 'var(--text-base)' as any };
const errorStyle: CSSProperties = { backgroundColor: 'var(--color-red-subtle)', color: 'var(--color-red-light)', padding: '14px 18px', borderRadius: 'var(--radius-sm)' as any, fontSize: 'var(--text-base)' as any, marginBottom: 16 };

const statsStripStyle: CSSProperties = {
  display: 'flex',
  gap: 8,
  flexWrap: 'wrap',
  marginBottom: 16,
};

const statsChipStyle: CSSProperties = {
  display: 'inline-block',
  padding: '4px 12px',
  borderRadius: 'var(--radius-lg)' as any,
  fontSize: 12,
  fontWeight: 'var(--weight-medium)' as any,
  backgroundColor: 'var(--color-bg-elevated)',
  color: 'var(--color-text-secondary)',
};

// ─── Component ────────────────────────────────────────────

export default function AssignmentsPage() {
  const { authed } = useStaffAuth();
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [trainers, setTrainers] = useState<PersonOption[]>([]);
  const [gymMemberOptions, setGymMemberOptions] = useState<PersonOption[]>([]);

  const [formTrainerId, setFormTrainerId] = useState('');
  const [formMemberId, setFormMemberId] = useState('');

  const [featureEnabled, setFeatureEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    if (authed) init();
  }, [authed]);

  async function init() {
    const { data } = await supabase
      .from('feature_flags')
      .select('is_enabled')
      .eq('flag_key', 'ai_trainer_copilot')
      .maybeSingle();
    setFeatureEnabled(data?.is_enabled ?? false);

    await fetchAssignments();
    setLoading(false);
  }

  async function fetchAssignments() {
    try {
      const res = await fetch('/api/admin/assignments');
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? 'Failed to load assignments');
        return;
      }
      const data = await res.json();
      setAssignments((data.assignments as AssignmentRow[]) ?? []);
      setTrainers((data.trainers as PersonOption[]) ?? []);
      setGymMemberOptions((data.members as PersonOption[]) ?? []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load assignments');
    }
  }

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch('/api/admin/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trainer_profile_id: formTrainerId,
          member_profile_id: formMemberId,
        }),
      });
      setSubmitting(false);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? 'Failed to create assignment');
        return;
      }
      setShowForm(false);
      setFormTrainerId('');
      setFormMemberId('');
      await fetchAssignments();
    } catch (err: unknown) {
      setSubmitting(false);
      setError(err instanceof Error ? err.message : 'Failed to create assignment');
    }
  }

  async function handleToggleStatus(assignment: AssignmentRow) {
    const newStatus = assignment.status === 'active' ? 'paused' : 'active';
    const res = await fetch(`/api/admin/assignments/${assignment.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? 'Failed to update assignment');
      return;
    }
    await fetchAssignments();
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Are you sure you want to remove this assignment?')) return;
    try {
      const res = await fetch(`/api/admin/assignments/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? 'Failed to delete assignment');
        return;
      }
      await fetchAssignments();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete assignment');
    }
  }

  if (featureEnabled === false) {
    return (
      <div style={{ padding: 24 }}>
        <PageHeader title="Trainer Assignments" description="Trainer Co-Pilot is not enabled for your gym." />
        <p style={emptyStyle}>Enable the <strong>ai_trainer_copilot</strong> feature flag to use this page.</p>
      </div>
    );
  }

  return (
    <AnimatedPage>
      <div style={{ padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
          <PageHeader title="Trainer Assignments" description="Assign trainers to members for Co-Pilot coach notes." />
          <button style={addBtnStyle} className="btn-primary" onClick={() => setShowForm(!showForm)}>
            {showForm ? 'Cancel' : 'New Assignment'}
          </button>
        </div>

        {error && <div style={errorStyle}>{error}</div>}

        {/* Stats strip */}
        {!loading && assignments.length > 0 && (() => {
          const activeCount = assignments.filter((a) => a.status === 'active').length;
          const pausedCount = assignments.filter((a) => a.status === 'paused').length;
          const uniqueTrainers = new Set(assignments.map((a) => a.trainer_profile_id)).size;
          const uniqueMembers = new Set(assignments.map((a) => a.member_profile_id)).size;
          const uniqueGyms = new Set(assignments.map((a) => a.gym_id)).size;
          return (
            <div style={statsStripStyle}>
              <span style={statsChipStyle}>{assignments.length} assignment{assignments.length !== 1 ? 's' : ''}</span>
              <span style={{ ...statsChipStyle, backgroundColor: 'var(--color-green-subtle)', color: 'var(--color-green-light)' }}>{activeCount} active</span>
              {pausedCount > 0 && <span style={{ ...statsChipStyle, backgroundColor: 'var(--color-gold-subtle)', color: 'var(--color-gold-light)' }}>{pausedCount} paused</span>}
              <span style={statsChipStyle}>{uniqueTrainers} trainer{uniqueTrainers !== 1 ? 's' : ''}</span>
              <span style={statsChipStyle}>{uniqueMembers} member{uniqueMembers !== 1 ? 's' : ''}</span>
              {uniqueGyms > 1 && <span style={statsChipStyle}>{uniqueGyms} gyms</span>}
            </div>
          );
        })()}

        {showForm && (
          <div style={formContainerStyle} className="form-slide-down">
            <h3 style={{ fontSize: 18, fontWeight: 'var(--weight-medium)' as any, color: 'var(--color-text-primary)', marginTop: 0, marginBottom: 20 }}>
              Assign Trainer to Member
            </h3>
            <form onSubmit={handleAdd}>
              <div style={formGridStyle}>
                <div>
                  <label style={labelStyle}>Trainer</label>
                  <select style={selectStyle} value={formTrainerId} onChange={(e) => setFormTrainerId(e.target.value)} required>
                    <option value="">Select trainer...</option>
                    {trainers.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.role})</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Member</label>
                  <select style={selectStyle} value={formMemberId} onChange={(e) => setFormMemberId(e.target.value)} required>
                    <option value="">Select member...</option>
                    {gymMemberOptions.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
                <button type="submit" style={addBtnStyle} className="btn-primary" disabled={submitting}>
                  {submitting ? 'Creating...' : 'Create Assignment'}
                </button>
                <button type="button" style={{ ...actionBtnStyle, color: 'var(--color-text-secondary)', backgroundColor: 'var(--color-bg-elevated)' }} onClick={() => setShowForm(false)}>Cancel</button>
              </div>
            </form>
          </div>
        )}

        <div style={tableContainerStyle} className="section-glow">
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center' }}><div className="spinner-enhanced" /></div>
          ) : assignments.length === 0 ? (
            <p style={emptyStyle}>No trainer assignments yet. Create one above to start generating coach notes.</p>
          ) : (
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Gym</th>
                  <th style={thStyle}>Trainer</th>
                  <th style={thStyle}>Member</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Created</th>
                  <th style={thStyle}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {assignments.map((a) => (
                  <tr key={a.id} className="table-row-hover">
                    <td style={tdStyle}>{a.gym_name ?? '--'}</td>
                    <td style={{ ...tdStyle, fontWeight: 'var(--weight-medium)' as any }}>{a.trainer_name ?? '--'}</td>
                    <td style={tdStyle}>{a.member_name ?? '--'}</td>
                    <td style={tdStyle}><span style={statusBadge(a.status)}>{a.status}</span></td>
                    <td style={tdStyle}>{new Date(a.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          style={{ ...actionBtnStyle, color: 'var(--color-text-primary)', backgroundColor: a.status === 'active' ? 'var(--color-gold)' : 'var(--color-green)' }}
                          onClick={() => handleToggleStatus(a)}
                        >
                          {a.status === 'active' ? 'Pause' : 'Resume'}
                        </button>
                        <button
                          style={{ ...actionBtnStyle, color: 'var(--color-red-light)', backgroundColor: 'transparent', border: '1px solid var(--color-red-light)' }}
                          onClick={() => handleDelete(a.id)}
                        >
                          Remove
                        </button>
                      </div>
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

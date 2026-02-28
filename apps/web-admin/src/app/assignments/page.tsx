'use client';

import { useEffect, useState, CSSProperties, FormEvent } from 'react';
import { supabase } from '@/lib/supabase';
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
  trainer_profile?: { full_name: string } | null;
  member_profile?: { full_name: string } | null;
  gyms?: { name: string } | null;
}

interface GymOption { id: string; name: string; }
interface ProfileOption { id: string; full_name: string; role: string; profile_id: string; gym_id: string; }

// ─── Styles ─────────────────────────────────────────────

const addBtnStyle: CSSProperties = {
  padding: '10px 20px', fontSize: 14, fontWeight: 600, color: '#fff',
  backgroundColor: '#4fc3f7', border: 'none', borderRadius: 6, cursor: 'pointer',
};

const formContainerStyle: CSSProperties = {
  backgroundColor: '#fff', borderRadius: 10, padding: 24, marginBottom: 24,
  border: '1px solid rgba(79,195,247,0.15)',
};

const formGridStyle: CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 };

const labelStyle: CSSProperties = { display: 'block', fontSize: 13, fontWeight: 600, color: '#333', marginBottom: 6 };
const selectStyle: CSSProperties = {
  width: '100%', padding: '8px 12px', fontSize: 14, border: '1px solid #ddd',
  borderRadius: 6, boxSizing: 'border-box', outline: 'none', backgroundColor: '#fff',
};

const tableContainerStyle: CSSProperties = {
  backgroundColor: '#fff', borderRadius: 10, overflow: 'hidden', border: '1px solid rgba(0,0,0,0.06)',
};
const tableStyle: CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: 14 };
const thStyle: CSSProperties = {
  textAlign: 'left', padding: '12px 16px', backgroundColor: '#fafafa', borderBottom: '1px solid #eee',
  fontWeight: 600, color: '#555', fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.3px',
};
const tdStyle: CSSProperties = { padding: '12px 16px', borderBottom: '1px solid #f0f0f0', color: '#333' };

const statusBadge = (status: string): CSSProperties => ({
  display: 'inline-block', padding: '3px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600,
  backgroundColor: status === 'active' ? '#e8f5e9' : '#f5f5f5',
  color: status === 'active' ? '#2e7d32' : '#999',
});

const actionBtnStyle: CSSProperties = {
  padding: '5px 12px', fontSize: 12, fontWeight: 600, border: 'none', borderRadius: 5, cursor: 'pointer',
};

const emptyStyle: CSSProperties = { padding: 40, textAlign: 'center', color: '#999', fontSize: 15 };
const errorStyle: CSSProperties = { backgroundColor: '#fdecea', color: '#b71c1c', padding: '14px 18px', borderRadius: 8, fontSize: 14, marginBottom: 16 };

// ─── Component ────────────────────────────────────────────

export default function AssignmentsPage() {
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [gyms, setGyms] = useState<GymOption[]>([]);
  const [gymMembers, setGymMembers] = useState<ProfileOption[]>([]);

  const [formGymId, setFormGymId] = useState('');
  const [formTrainerId, setFormTrainerId] = useState('');
  const [formMemberId, setFormMemberId] = useState('');

  const [featureEnabled, setFeatureEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    init();
  }, []);

  async function init() {
    const { data } = await supabase
      .from('feature_flags')
      .select('enabled')
      .eq('key', 'ai_trainer_copilot')
      .is('profile_id', null)
      .limit(1)
      .single();
    setFeatureEnabled(data?.enabled ?? false);

    await Promise.all([fetchAssignments(), fetchGyms(), fetchGymMembers()]);
    setLoading(false);
  }

  async function fetchAssignments() {
    const { data, error: err } = await supabase
      .from('trainer_assignments')
      .select('*, trainer_profile:trainer_profile_id(full_name), member_profile:member_profile_id(full_name), gyms:gym_id(name)')
      .order('created_at', { ascending: false });
    if (err) { setError(err.message); return; }
    setAssignments((data as unknown as AssignmentRow[]) ?? []);
  }

  async function fetchGyms() {
    const { data } = await supabase.from('gyms').select('id, name').order('name');
    setGyms((data as GymOption[]) ?? []);
  }

  async function fetchGymMembers() {
    const { data } = await supabase
      .from('gym_members')
      .select('profile_id, role, gym_id, profiles:profile_id(full_name)')
      .order('role');
    setGymMembers(
      (data ?? []).map((d: any) => ({
        id: d.profile_id,
        full_name: d.profiles?.full_name ?? 'Unknown',
        role: d.role,
        profile_id: d.profile_id,
        gym_id: d.gym_id,
      })),
    );
  }

  const trainersInGym = gymMembers.filter((m) => m.gym_id === formGymId && (m.role === 'trainer' || m.role === 'owner'));
  const membersInGym = gymMembers.filter((m) => m.gym_id === formGymId && m.role === 'member');

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const { error: insertErr } = await supabase.from('trainer_assignments').insert({
      gym_id: formGymId,
      trainer_profile_id: formTrainerId,
      member_profile_id: formMemberId,
    });

    setSubmitting(false);
    if (insertErr) { setError(insertErr.message); return; }
    setShowForm(false);
    setFormGymId('');
    setFormTrainerId('');
    setFormMemberId('');
    await fetchAssignments();
  }

  async function handleToggleStatus(assignment: AssignmentRow) {
    const newStatus = assignment.status === 'active' ? 'paused' : 'active';
    await supabase
      .from('trainer_assignments')
      .update({ status: newStatus })
      .eq('id', assignment.id);
    await fetchAssignments();
  }

  async function handleDelete(id: string) {
    await supabase.from('trainer_assignments').delete().eq('id', id);
    await fetchAssignments();
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

        {showForm && (
          <div style={formContainerStyle} className="form-slide-down">
            <h3 style={{ fontSize: 18, fontWeight: 600, color: '#1a1a2e', marginTop: 0, marginBottom: 20 }}>
              Assign Trainer to Member
            </h3>
            <form onSubmit={handleAdd}>
              <div style={formGridStyle}>
                <div>
                  <label style={labelStyle}>Gym</label>
                  <select style={selectStyle} value={formGymId} onChange={(e) => { setFormGymId(e.target.value); setFormTrainerId(''); setFormMemberId(''); }} required>
                    <option value="">Select gym...</option>
                    {gyms.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Trainer</label>
                  <select style={selectStyle} value={formTrainerId} onChange={(e) => setFormTrainerId(e.target.value)} required disabled={!formGymId}>
                    <option value="">Select trainer...</option>
                    {trainersInGym.map((t) => <option key={t.id} value={t.id}>{t.full_name} ({t.role})</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Member</label>
                  <select style={selectStyle} value={formMemberId} onChange={(e) => setFormMemberId(e.target.value)} required disabled={!formGymId}>
                    <option value="">Select member...</option>
                    {membersInGym.map((m) => <option key={m.id} value={m.id}>{m.full_name}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
                <button type="submit" style={addBtnStyle} className="btn-primary" disabled={submitting}>
                  {submitting ? 'Creating...' : 'Create Assignment'}
                </button>
                <button type="button" style={{ ...actionBtnStyle, color: '#666', backgroundColor: '#f0f0f0' }} onClick={() => setShowForm(false)}>Cancel</button>
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
                    <td style={tdStyle}>{(a as any).gyms?.name ?? '--'}</td>
                    <td style={{ ...tdStyle, fontWeight: 600 }}>{(a as any).trainer_profile?.full_name ?? '--'}</td>
                    <td style={tdStyle}>{(a as any).member_profile?.full_name ?? '--'}</td>
                    <td style={tdStyle}><span style={statusBadge(a.status)}>{a.status}</span></td>
                    <td style={tdStyle}>{new Date(a.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          style={{ ...actionBtnStyle, color: '#fff', backgroundColor: a.status === 'active' ? '#ff9800' : '#4caf50' }}
                          onClick={() => handleToggleStatus(a)}
                        >
                          {a.status === 'active' ? 'Pause' : 'Resume'}
                        </button>
                        <button
                          style={{ ...actionBtnStyle, color: '#e53935', backgroundColor: 'transparent', border: '1px solid #e53935' }}
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

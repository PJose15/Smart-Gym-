'use client';

import { useEffect, useState, CSSProperties, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useStaffAuth } from '@/lib/useStaffAuth';
import { PageHeader } from '../components/PageHeader';
import { AnimatedPage } from '../components/AnimatedPage';

// ─── Types ───────────────────────────────────────────────

interface MemberRow {
  id: string;
  gym_id: string;
  user_id: string | null;
  display_name: string;
  email: string | null;
  smartgym_score: number;
  onboarding_status: string;
  joined_at: string;
  gym_name: string;
}

interface ProgramOption {
  id: string;
  name: string;
  gym_id: string;
}

interface AssignmentRow {
  id: string;
  member_id: string;
  program_id: string;
  program_name: string;
}

// ─── Styles ─────────────────────────────────────────────

const addButtonStyle: CSSProperties = {
  padding: '10px 20px',
  fontSize: 'var(--text-base)' as any,
  fontWeight: 'var(--weight-medium)' as any,
  color: 'var(--color-text-primary)',
  backgroundColor: 'var(--color-blue)',
  border: 'none',
  borderRadius: 'var(--radius-sm)' as any,
  cursor: 'pointer',
};

const formContainerStyle: CSSProperties = {
  backgroundColor: 'var(--color-bg-raised)',
  borderRadius: 'var(--radius-md)' as any,
  padding: '24px',
  marginBottom: 24,
  border: '1px solid var(--color-border-default)',
};

const formTitleStyle: CSSProperties = {
  fontSize: 18,
  fontWeight: 'var(--weight-medium)' as any,
  color: 'var(--color-text-primary)',
  marginTop: 0,
  marginBottom: 20,
};

const formGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr',
  gap: 16,
  maxWidth: 420,
};

const fieldStyle: CSSProperties = {
  marginBottom: 16,
};

const labelStyle: CSSProperties = {
  display: 'block',
  fontSize: 'var(--text-sm)' as any,
  fontWeight: 'var(--weight-medium)' as any,
  color: 'var(--color-text-primary)',
  marginBottom: 6,
};

const inputStyle: CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  fontSize: 'var(--text-base)' as any,
  border: '1px solid var(--color-border-default)',
  borderRadius: 'var(--radius-sm)' as any,
  boxSizing: 'border-box',
  outline: 'none',
  backgroundColor: 'var(--color-bg-elevated)',
  color: 'var(--color-text-primary)',
};

const formActionsStyle: CSSProperties = {
  display: 'flex',
  gap: 12,
  marginTop: 8,
};

const submitButtonStyle: CSSProperties = {
  padding: '10px 24px',
  fontSize: 'var(--text-base)' as any,
  fontWeight: 'var(--weight-medium)' as any,
  color: 'var(--color-text-primary)',
  backgroundColor: 'var(--color-blue)',
  border: 'none',
  borderRadius: 'var(--radius-sm)' as any,
  cursor: 'pointer',
};

const cancelButtonStyle: CSSProperties = {
  padding: '10px 24px',
  fontSize: 'var(--text-base)' as any,
  fontWeight: 'var(--weight-medium)' as any,
  color: 'var(--color-text-secondary)',
  backgroundColor: 'var(--color-bg-elevated)',
  border: 'none',
  borderRadius: 'var(--radius-sm)' as any,
  cursor: 'pointer',
};

const tableContainerStyle: CSSProperties = {
  backgroundColor: 'var(--color-bg-raised)',
  borderRadius: 'var(--radius-md)' as any,
  overflow: 'hidden',
  border: '1px solid var(--color-border-subtle)',
};

const tableStyle: CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: 'var(--text-base)' as any,
};

const thStyle: CSSProperties = {
  textAlign: 'left',
  padding: '12px 16px',
  backgroundColor: 'var(--color-bg-elevated)',
  borderBottom: '1px solid var(--color-border-subtle)',
  fontWeight: 'var(--weight-medium)' as any,
  color: 'var(--color-text-secondary)',
  fontSize: 'var(--text-sm)' as any,
  textTransform: 'uppercase',
  letterSpacing: '0.3px',
};

const tdStyle: CSSProperties = {
  padding: '12px 16px',
  borderBottom: '1px solid var(--color-border-subtle)',
  color: 'var(--color-text-primary)',
  verticalAlign: 'middle',
};

const roleBadgeBase: CSSProperties = {
  display: 'inline-block',
  padding: '3px 10px',
  borderRadius: 12,
  fontSize: 12,
  fontWeight: 'var(--weight-medium)' as any,
};

const programBadgeStyle: CSSProperties = {
  display: 'inline-block',
  padding: '3px 10px',
  borderRadius: 12,
  fontSize: 12,
  fontWeight: 'var(--weight-medium)' as any,
  backgroundColor: 'var(--color-blue-subtle)',
  color: 'var(--color-blue-light)',
  marginRight: 8,
};

const assignSelectStyle: CSSProperties = {
  padding: '5px 8px',
  fontSize: 'var(--text-sm)' as any,
  border: '1px solid var(--color-border-default)',
  borderRadius: 'var(--radius-sm)' as any,
  outline: 'none',
  backgroundColor: 'var(--color-bg-elevated)',
  color: 'var(--color-text-primary)',
  marginRight: 6,
  maxWidth: 180,
};

const assignBtnStyle: CSSProperties = {
  padding: '5px 12px',
  fontSize: 12,
  fontWeight: 'var(--weight-medium)' as any,
  color: 'var(--color-text-primary)',
  backgroundColor: 'var(--color-blue)',
  border: 'none',
  borderRadius: 5,
  cursor: 'pointer',
};

const removeProgramBtnStyle: CSSProperties = {
  padding: '4px 10px',
  fontSize: 12,
  fontWeight: 'var(--weight-medium)' as any,
  color: 'var(--color-red-light)',
  backgroundColor: 'transparent',
  border: '1px solid var(--color-red-light)',
  borderRadius: 5,
  cursor: 'pointer',
};

const errorBoxStyle: CSSProperties = {
  backgroundColor: 'var(--color-red-subtle)',
  color: 'var(--color-red-light)',
  padding: '14px 18px',
  borderRadius: 'var(--radius-sm)' as any,
  fontSize: 'var(--text-base)' as any,
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
  fontSize: 'var(--text-base)' as any,
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
  borderRadius: 'var(--radius-lg)' as any,
  fontSize: 12,
  fontWeight: 'var(--weight-medium)' as any,
  backgroundColor: 'var(--color-bg-elevated)',
  color: 'var(--color-text-secondary)',
};

// ─── Helpers ─────────────────────────────────────────────

function getStatusBadgeStyle(status: string): CSSProperties {
  if (status === 'active' || status === 'program_active') {
    return { ...roleBadgeBase, backgroundColor: 'var(--color-green-subtle)', color: 'var(--color-green-light)' };
  }
  if (status === 'pending') {
    return { ...roleBadgeBase, backgroundColor: 'var(--color-gold-subtle)', color: 'var(--color-gold-light)' };
  }
  return { ...roleBadgeBase, backgroundColor: 'var(--color-blue-subtle)', color: 'var(--color-blue-light)' };
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

// ─── Component ────────────────────────────────────────────

export default function MembersPage() {
  const router = useRouter();
  const { authed } = useStaffAuth();
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [programs, setPrograms] = useState<ProgramOption[]>([]);
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Per-row select state: memberId → selected programId
  const [pendingAssign, setPendingAssign] = useState<Record<string, string>>({});

  // Add-member form state
  const [formEmail, setFormEmail] = useState('');

  // ── Fetches ──────────────────────────────────────────

  async function loadMembers() {
    try {
      const res = await fetch('/api/admin/members/list');
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? 'Failed to load members');
        return;
      }
      const data = await res.json();
      setMembers((data.members as MemberRow[]) ?? []);
      setPrograms((data.programs as ProgramOption[]) ?? []);
      setAssignments((data.assignments as AssignmentRow[]) ?? []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load members');
    }
  }

  useEffect(() => {
    if (!authed) return;
    async function init() {
      setLoading(true);
      await loadMembers();
      setLoading(false);
    }
    init();
  }, [authed]);

  // ── Add-member form ───────────────────────────────────

  function resetForm() {
    setFormEmail('');
    setShowForm(false);
    setError(null);
  }

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch('/api/admin/members/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: formEmail }),
      });
      setSubmitting(false);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? 'Failed to add member');
        return;
      }
      resetForm();
      await loadMembers();
    } catch (err: unknown) {
      setSubmitting(false);
      setError(err instanceof Error ? err.message : 'Failed to add member');
    }
  }

  // ── Program assignment mutations ──────────────────────

  async function handleAssign(member: MemberRow) {
    const programId = pendingAssign[member.id];
    if (!programId) return;

    const res = await fetch('/api/admin/members/program', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ member_id: member.id, program_id: programId }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? 'Failed to assign program');
      return;
    }
    const data = await res.json();
    setAssignments((prev) => [...prev, data.assignment as AssignmentRow]);
    setPendingAssign((prev) => { const next = { ...prev }; delete next[member.id]; return next; });
  }

  async function handleRemoveAssignment(assignmentId: string) {
    if (!window.confirm('Remove this program assignment?')) return;
    const res = await fetch(`/api/admin/members/program?id=${encodeURIComponent(assignmentId)}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? 'Failed to remove assignment');
      return;
    }
    setAssignments((prev) => prev.filter((a) => a.id !== assignmentId));
  }

  // ── Derived helpers ───────────────────────────────────

  function getAssignment(memberId: string): AssignmentRow | undefined {
    return assignments.find((a) => a.member_id === memberId);
  }

  function programsForGym(gymId: string): ProgramOption[] {
    return programs.filter((p) => p.gym_id === gymId);
  }

  // ── Render ────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ padding: '24px' }}>
        <PageHeader title="Members" description="View and manage gym members and their assigned programs." />
        <div style={loadingContainerStyle}><div style={spinnerStyle} className="spinner-enhanced" /></div>
      </div>
    );
  }

  return (
    <AnimatedPage>
      <div style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
          <PageHeader
            title="Members"
            description="View and manage gym members and their assigned programs."
          />
          <button style={addButtonStyle} className="btn-primary" onClick={() => setShowForm(!showForm)}>
            {showForm ? 'Cancel' : 'Add Member'}
          </button>
        </div>

        {error && <div style={errorBoxStyle} className="error-shake">{error}</div>}

        {/* ── Stats strip ── */}
        {members.length > 0 && (() => {
          const activeCount = members.filter(m => m.onboarding_status === 'active' || m.onboarding_status === 'program_active').length;
          const assignedCount = new Set(assignments.map(a => a.member_id)).size;
          const assignmentRate = members.length > 0 ? Math.round((assignedCount / members.length) * 100) : 0;
          return (
            <div style={statsStripStyle}>
              <span style={statsChipStyle}>{members.length} total</span>
              <span style={{ ...statsChipStyle, backgroundColor: 'var(--color-green-subtle)', color: 'var(--color-green-light)' }}>{activeCount} active</span>
              <span style={{ ...statsChipStyle, backgroundColor: assignmentRate >= 50 ? 'var(--color-green-subtle)' : 'var(--color-gold-subtle)', color: assignmentRate >= 50 ? 'var(--color-green-light)' : 'var(--color-gold-light)' }}>
                {assignmentRate}% with programs
              </span>
            </div>
          );
        })()}

        {/* ── Add-member form ── */}
        {showForm && (
          <div style={formContainerStyle} className="form-slide-down">
            <h3 style={formTitleStyle}>Add New Member</h3>
            <p style={{ fontSize: 'var(--text-sm)' as any, color: 'var(--color-text-muted)', marginTop: 0, marginBottom: 16 }}>
              Add an existing user to your gym by email. The user must have signed up first.
            </p>
            <form onSubmit={handleAdd}>
              <div style={formGridStyle}>
                <div style={fieldStyle}>
                  <label style={labelStyle} htmlFor="member-email">Email</label>
                  <input
                    id="member-email"
                    type="email"
                    style={inputStyle}
                    className="input-animate"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    placeholder="user@example.com"
                    required
                  />
                </div>
              </div>
              <div style={formActionsStyle}>
                <button type="submit" style={submitButtonStyle} className="btn-primary" disabled={submitting}>
                  {submitting ? 'Adding...' : 'Add Member'}
                </button>
                <button type="button" style={cancelButtonStyle} className="btn-secondary" onClick={resetForm}>Cancel</button>
              </div>
            </form>
          </div>
        )}

        {/* ── Members table ── */}
        <div style={tableContainerStyle} className="section-glow">
          {members.length === 0 ? (
            <p style={emptyStyle} className="empty-breathe">No members found. Add your first member above.</p>
          ) : (
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Name</th>
                  <th style={thStyle}>Email</th>
                  <th style={thStyle}>Gym</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Joined</th>
                  <th style={thStyle}>Program</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m, i) => {
                  const assignment = getAssignment(m.id);
                  const gymPrograms = programsForGym(m.gym_id);
                  const selectedProgramId = pendingAssign[m.id] ?? '';

                  return (
                    <tr key={m.id} className={`row-stagger stagger-${Math.min(i, 19)} table-row-hover`}>
                      <td
                        style={{ ...tdStyle, fontWeight: 'var(--weight-medium)' as any, color: 'var(--color-blue-light)', cursor: m.user_id ? 'pointer' : 'default' }}
                        onClick={() => { if (m.user_id) router.push(`/members/${m.user_id}`); }}
                        onKeyDown={(e) => {
                          if (m.user_id && (e.key === 'Enter' || e.key === ' ')) {
                            e.preventDefault();
                            router.push(`/members/${m.user_id}`);
                          }
                        }}
                        tabIndex={m.user_id ? 0 : undefined}
                        role={m.user_id ? 'link' : undefined}
                        aria-label={m.user_id ? `View ${m.display_name ?? 'member'} details` : undefined}
                      >
                        {m.display_name ?? 'Unknown'}
                      </td>
                      <td style={tdStyle}>{m.email ?? '--'}</td>
                      <td style={tdStyle}>{m.gym_name ?? '--'}</td>
                      <td style={tdStyle}><span style={getStatusBadgeStyle(m.onboarding_status)}>{m.onboarding_status}</span></td>
                      <td style={tdStyle}>{formatDate(m.joined_at)}</td>
                      <td style={tdStyle}>
                        {assignment ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={programBadgeStyle}>{assignment.program_name ?? 'Program'}</span>
                            <button
                              style={removeProgramBtnStyle}
                              className="btn-danger"
                              onClick={() => handleRemoveAssignment(assignment.id)}
                            >
                              Remove
                            </button>
                          </div>
                        ) : gymPrograms.length === 0 ? (
                          <span style={{ color: 'var(--color-text-disabled)', fontSize: 'var(--text-sm)' as any }}>No programs</span>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <select
                              style={assignSelectStyle}
                              className="input-animate"
                              value={selectedProgramId}
                              onChange={(e) =>
                                setPendingAssign((prev) => ({ ...prev, [m.id]: e.target.value }))
                              }
                            >
                              <option value="">Select program...</option>
                              {gymPrograms.map((p) => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                              ))}
                            </select>
                            <button
                              style={{
                                ...assignBtnStyle,
                                opacity: selectedProgramId ? 1 : 0.45,
                                cursor: selectedProgramId ? 'pointer' : 'not-allowed',
                              }}
                              className="btn-primary"
                              disabled={!selectedProgramId}
                              onClick={() => handleAssign(m)}
                            >
                              Assign
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </AnimatedPage>
  );
}

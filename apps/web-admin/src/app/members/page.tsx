'use client';

import { useEffect, useState, CSSProperties, FormEvent } from 'react';
import { supabase } from '@/lib/supabase';
import { PageHeader } from '../components/PageHeader';

interface MemberRow {
  id: string;
  role: string;
  joined_at: string;
  gym_id: string;
  profiles: { email: string; full_name: string } | null;
  gyms: { name: string } | null;
}

interface GymOption {
  id: string;
  name: string;
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

const roleBadgeBase: CSSProperties = {
  display: 'inline-block',
  padding: '3px 10px',
  borderRadius: 12,
  fontSize: 12,
  fontWeight: 600,
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
  animation: 'members-spin 0.8s linear infinite',
};

const emptyStyle: CSSProperties = {
  padding: 40,
  textAlign: 'center',
  color: '#999',
  fontSize: 15,
};

function getRoleBadgeStyle(role: string): CSSProperties {
  if (role === 'owner') {
    return { ...roleBadgeBase, backgroundColor: '#f3e5f5', color: '#7b1fa2' };
  }
  if (role === 'trainer') {
    return { ...roleBadgeBase, backgroundColor: '#e3f2fd', color: '#1565c0' };
  }
  return { ...roleBadgeBase, backgroundColor: '#e8f5e9', color: '#2e7d32' };
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function MembersPage() {
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [gyms, setGyms] = useState<GymOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [formEmail, setFormEmail] = useState('');
  const [formGymId, setFormGymId] = useState('');
  const [formRole, setFormRole] = useState('member');

  async function fetchMembers() {
    try {
      const { data, error: fetchError } = await supabase
        .from('gym_members')
        .select('id, role, joined_at, gym_id, profiles(email, full_name), gyms(name)')
        .order('joined_at', { ascending: false });

      if (fetchError) {
        setError(fetchError.message);
        return;
      }

      setMembers((data as unknown as MemberRow[]) ?? []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load members');
    }
  }

  async function fetchGyms() {
    const { data } = await supabase
      .from('gyms')
      .select('id, name')
      .order('name', { ascending: true });
    setGyms((data as GymOption[]) ?? []);
  }

  useEffect(() => {
    async function init() {
      setLoading(true);
      await Promise.all([fetchMembers(), fetchGyms()]);
      setLoading(false);
    }
    init();
  }, []);

  function resetForm() {
    setFormEmail('');
    setFormGymId('');
    setFormRole('member');
    setShowForm(false);
    setError(null);
  }

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', formEmail)
      .single();

    if (profileError || !profileData) {
      setError(
        profileError?.message ??
        `No profile found for email "${formEmail}". The user must sign up first.`
      );
      setSubmitting(false);
      return;
    }

    const { error: insertError } = await supabase.from('gym_members').insert({
      profile_id: profileData.id,
      gym_id: formGymId,
      role: formRole,
    });

    setSubmitting(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    resetForm();
    await fetchMembers();
  }

  if (loading) {
    return (
      <div style={{ padding: '24px' }}>
        <PageHeader
          title="Members"
          description="View and manage gym members, track membership status, and review activity history."
        />
        <style>{`@keyframes members-spin { to { transform: rotate(360deg); } }`}</style>
        <div style={loadingContainerStyle}>
          <div style={spinnerStyle} />
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px' }}>
      <style>{`@keyframes members-spin { to { transform: rotate(360deg); } }`}</style>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <PageHeader
          title="Members"
          description="View and manage gym members, track membership status, and review activity history."
        />
        <button style={addButtonStyle} onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : 'Add Member'}
        </button>
      </div>

      {error && <div style={errorBoxStyle}>{error}</div>}

      {showForm && (
        <div style={formContainerStyle}>
          <h3 style={formTitleStyle}>Add New Member</h3>
          <form onSubmit={handleAdd}>
            <div style={formGridStyle}>
              <div style={fieldStyle}>
                <label style={labelStyle} htmlFor="member-email">
                  Email
                </label>
                <input
                  id="member-email"
                  type="email"
                  style={inputStyle}
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  placeholder="user@example.com"
                  required
                />
              </div>
              <div style={fieldStyle}>
                <label style={labelStyle} htmlFor="member-gym">
                  Gym
                </label>
                <select
                  id="member-gym"
                  style={selectStyle}
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
              <div style={fieldStyle}>
                <label style={labelStyle} htmlFor="member-role">
                  Role
                </label>
                <select
                  id="member-role"
                  style={selectStyle}
                  value={formRole}
                  onChange={(e) => setFormRole(e.target.value)}
                  required
                >
                  <option value="member">Member</option>
                  <option value="trainer">Trainer</option>
                  <option value="owner">Owner</option>
                </select>
              </div>
            </div>
            <div style={formActionsStyle}>
              <button type="submit" style={submitButtonStyle} disabled={submitting}>
                {submitting ? 'Adding...' : 'Add Member'}
              </button>
              <button type="button" style={cancelButtonStyle} onClick={resetForm}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div style={tableContainerStyle}>
        {members.length === 0 ? (
          <p style={emptyStyle}>No members found. Add your first member above.</p>
        ) : (
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Name</th>
                <th style={thStyle}>Email</th>
                <th style={thStyle}>Gym</th>
                <th style={thStyle}>Role</th>
                <th style={thStyle}>Joined</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id}>
                  <td style={{ ...tdStyle, fontWeight: 600 }}>
                    {m.profiles?.full_name ?? 'Unknown'}
                  </td>
                  <td style={tdStyle}>{m.profiles?.email ?? '--'}</td>
                  <td style={tdStyle}>{m.gyms?.name ?? '--'}</td>
                  <td style={tdStyle}>
                    <span style={getRoleBadgeStyle(m.role)}>{m.role}</span>
                  </td>
                  <td style={tdStyle}>{formatDate(m.joined_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

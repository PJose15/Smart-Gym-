'use client';

import { useEffect, useState, useCallback, CSSProperties } from 'react';

const spinnerStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  minHeight: 300,
};

const tableStyle: CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  marginTop: 16,
  fontSize: 13,
};

const thStyle: CSSProperties = {
  textAlign: 'left',
  padding: '10px 12px',
  color: 'var(--color-text-secondary)',
  fontWeight: 500,
  borderBottom: '1px solid var(--color-bg-elevated)',
  fontSize: 12,
};

const tdStyle: CSSProperties = {
  padding: '10px 12px',
  color: 'var(--color-text-primary)',
  borderBottom: '1px solid var(--color-bg-raised)',
};

const filterBarStyle: CSSProperties = {
  display: 'flex',
  gap: 12,
  marginTop: 16,
  marginBottom: 16,
  flexWrap: 'wrap',
};

const selectStyle: CSSProperties = {
  padding: '8px 12px',
  borderRadius: 6,
  border: '1px solid var(--color-bg-elevated)',
  background: 'var(--color-bg-raised)',
  color: 'var(--color-text-primary)',
  fontSize: 13,
};

const inputStyle: CSSProperties = {
  ...selectStyle,
  flex: 1,
  minWidth: 200,
};

const badgeStyle = (color: string, bg: string): CSSProperties => ({
  display: 'inline-block',
  padding: '2px 8px',
  borderRadius: 4,
  fontSize: 11,
  fontWeight: 600,
  backgroundColor: bg,
  color,
});

interface MemberEntry {
  id: string;
  display_name: string;
  email: string;
  gym_id: string;
  gym_name: string;
  status: string;
  last_session_date: string | null;
  created_at: string;
  score: number | null;
}

const statusColors: Record<string, { color: string; bg: string }> = {
  active: { color: 'var(--color-green)', bg: 'var(--color-green-light)' },
  suspended: { color: 'var(--color-gold)', bg: 'rgba(255, 215, 0,0.15)' },
  cancelled: { color: 'var(--color-red)', bg: 'var(--color-red-light)' },
};

const defaultBadge = { color: 'var(--color-text-muted)', bg: 'var(--color-bg-elevated)' };

export default function AdminMembersPage() {
  const [members, setMembers] = useState<MemberEntry[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const fetchData = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({
      status: statusFilter,
      ...(search ? { search } : {}),
    });
    fetch(`/api/admin/members?${params}`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load');
        return res.json();
      })
      .then((data) => {
        setMembers(data.members);
        setLoading(false);
      })
      .catch(() => {
        setError('Failed to load member data.');
        setLoading(false);
      });
  }, [search, statusFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (error) {
    return (
      <div>
        <h1 style={{ margin: '0 0 8px', fontSize: 24, fontWeight: 700 }}>Members</h1>
        <p style={{ color: 'var(--color-red)', fontSize: 14 }}>{error}</p>
      </div>
    );
  }

  if (loading && members.length === 0) {
    return (
      <div style={spinnerStyle}>
        <div style={{ width: 28, height: 28, border: '3px solid var(--color-bg-elevated)', borderTopColor: 'var(--color-red)', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
      </div>
    );
  }

  return (
    <div>
      <h1 style={{ margin: '0 0 4px', fontSize: 24, fontWeight: 700 }}>Members</h1>
      <p style={{ margin: '0 0 16px', color: 'var(--color-text-muted)', fontSize: 14 }}>
        Platform member search and overview
      </p>

      <div style={filterBarStyle}>
        <input
          type="text"
          placeholder="Search by name or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={inputStyle}
        />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={selectStyle}>
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      <div style={{ backgroundColor: 'var(--color-bg-raised)', borderRadius: 8, overflow: 'hidden' }}>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>Name</th>
              <th style={thStyle}>Email</th>
              <th style={thStyle}>Gym</th>
              <th style={thStyle}>Status</th>
              <th style={thStyle}>Last Session</th>
              <th style={thStyle}>Joined</th>
              <th style={thStyle}>Score</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id}>
                <td style={{ ...tdStyle, fontWeight: 500 }}>{m.display_name}</td>
                <td style={{ ...tdStyle, color: 'var(--color-text-secondary)', fontSize: 12 }}>{m.email}</td>
                <td style={{ ...tdStyle, color: 'var(--color-text-secondary)' }}>{m.gym_name}</td>
                <td style={tdStyle}>
                  <span style={badgeStyle((statusColors[m.status] ?? defaultBadge).color, (statusColors[m.status] ?? defaultBadge).bg)}>
                    {m.status}
                  </span>
                </td>
                <td style={{ ...tdStyle, color: 'var(--color-text-secondary)' }}>
                  {m.last_session_date ?? '—'}
                </td>
                <td style={{ ...tdStyle, color: 'var(--color-text-secondary)', fontSize: 12 }}>
                  {new Date(m.created_at).toLocaleDateString()}
                </td>
                <td style={tdStyle}>{m.score ?? '—'}</td>
              </tr>
            ))}
            {members.length === 0 && (
              <tr>
                <td colSpan={7} style={{ ...tdStyle, textAlign: 'center', color: 'var(--color-text-muted)', padding: 32 }}>
                  No members found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

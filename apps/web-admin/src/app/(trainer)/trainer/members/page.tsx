'use client';

import { useEffect, useState, CSSProperties } from 'react';
import Link from 'next/link';
import type { TrainerMemberListItem } from '@nexera/types';
import { MemberAvatar } from '@/components/ui/MemberAvatar';

const searchStyle: CSSProperties = {
  width: '100%',
  maxWidth: 360,
  padding: '10px 14px',
  backgroundColor: '#0F172A',
  border: '1px solid #334155',
  borderRadius: 8,
  color: '#F1F5F9',
  fontSize: 14,
  outline: 'none',
  marginBottom: 20,
};

const cardStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 14,
  backgroundColor: '#1E293B',
  borderRadius: 10,
  padding: '14px 18px',
  textDecoration: 'none',
  color: '#F1F5F9',
  transition: 'background-color 0.15s',
};

const statusColors: Record<string, string> = {
  active: '#22C55E',
  at_risk: '#EF4444',
  inactive: '#64748B',
};

export default function TrainerMembersPage() {
  const [members, setMembers] = useState<TrainerMemberListItem[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/trainer/members')
      .then((r) => r.json())
      .then((d) => { setMembers(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const filtered = members.filter((m) =>
    m.member_name.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <p style={{ color: '#94A3B8' }}>Loading members...</p>;

  return (
    <div>
      <h1 style={{ margin: '0 0 20px', fontSize: 22, fontWeight: 700 }}>Members ({members.length})</h1>

      <input
        type="text"
        placeholder="Search members..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={searchStyle}
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {filtered.map((m) => (
          <Link key={m.member_id} href={`/trainer/members/${m.member_id}`} style={cardStyle}>
            <MemberAvatar
              src={m.avatar_url}
              name={m.member_name}
              size="medium"
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{m.member_name}</div>
              <div style={{ color: '#94A3B8', fontSize: 12 }}>
                {m.total_sessions} sessions · {m.current_streak}d streak
                {m.has_program && ' · Has program'}
              </div>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <span style={{
                display: 'inline-block',
                padding: '2px 8px',
                borderRadius: 4,
                fontSize: 11,
                fontWeight: 600,
                backgroundColor: statusColors[m.status] + '22',
                color: statusColors[m.status],
              }}>
                {m.status.replace('_', ' ')}
              </span>
              {m.last_session_date && (
                <div style={{ color: '#64748B', fontSize: 11, marginTop: 4 }}>
                  Last: {new Date(m.last_session_date).toLocaleDateString()}
                </div>
              )}
            </div>
          </Link>
        ))}
        {filtered.length === 0 && (
          <p style={{ color: '#64748B', fontSize: 13 }}>No members found.</p>
        )}
      </div>
    </div>
  );
}

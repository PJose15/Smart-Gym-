'use client';

import { useEffect, useState, CSSProperties } from 'react';
import Link from 'next/link';
import type { TrainerMemberListItem } from '@nexera/types';
import { MemberAvatar } from '@/components/ui/MemberAvatar';
import { TrainerMemberSkeleton } from '@/components/skeletons';

const searchStyle: CSSProperties = {
  width: '100%',
  maxWidth: 360,
  padding: 'var(--space-3) var(--space-4)',
  backgroundColor: 'var(--color-bg-elevated)',
  border: '1px solid var(--color-border-default)',
  borderRadius: 'var(--radius-md)',
  color: 'var(--color-text-primary)',
  fontSize: 'var(--text-sm)',
  outline: 'none',
  marginBottom: 'var(--space-5)',
  fontFamily: 'var(--font-sans)',
};

const cardStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-4)',
  backgroundColor: 'var(--color-bg-raised)',
  borderRadius: 'var(--radius-lg)',
  padding: 'var(--space-4) var(--space-5)',
  textDecoration: 'none',
  color: 'var(--color-text-primary)',
  transition: 'background-color var(--duration-fast)',
  border: '1px solid var(--color-border-subtle)',
};

const statusColors: Record<string, string> = {
  active: 'var(--color-green)',
  at_risk: 'var(--color-red)',
  inactive: 'var(--color-text-muted)',
};

export default function TrainerMembersPage() {
  const [members, setMembers] = useState<TrainerMemberListItem[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/trainer/members')
      .then((r) => {
        if (!r.ok) throw new Error('Failed');
        return r.json();
      })
      .then((d) => { setMembers(d); setLoading(false); })
      .catch(() => { setError('Failed to load members.'); setLoading(false); });
  }, []);

  const filtered = members.filter((m) =>
    m.member_name.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <TrainerMemberSkeleton />;
  if (error) return <p style={{ color: 'var(--color-red-light)' }}>{error}</p>;

  return (
    <div>
      <h1 style={{ margin: '0 0 var(--space-5)', fontSize: 'var(--text-xl)', fontWeight: 500, fontFamily: 'var(--font-sans)', letterSpacing: 'var(--tracking-tight)' }}>Members ({members.length})</h1>

      <input
        type="text"
        placeholder="Search members..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={searchStyle}
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        {filtered.map((m) => (
          <Link key={m.member_id} href={`/trainer/members/${m.member_id}`} style={cardStyle}>
            <MemberAvatar
              src={m.avatar_url}
              name={m.member_name}
              size="medium"
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 500, fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)' }}>{m.member_name}</div>
              <div style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-xs)' }}>
                {m.total_sessions} sessions · {m.current_streak}d streak
                {m.has_program && ' · Has program'}
              </div>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <span style={{
                display: 'inline-block',
                padding: '2px 8px',
                borderRadius: 'var(--radius-full)',
                fontSize: 'var(--text-xs)',
                fontWeight: 500,
                backgroundColor: statusColors[m.status] + '22',
                color: statusColors[m.status],
              }}>
                {m.status.replace('_', ' ')}
              </span>
              {m.last_session_date && (
                <div style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-xs)', marginTop: 'var(--space-1)' }}>
                  Last: {new Date(m.last_session_date).toLocaleDateString()}
                </div>
              )}
            </div>
          </Link>
        ))}
        {filtered.length === 0 && (
          <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>No members found.</p>
        )}
      </div>
    </div>
  );
}

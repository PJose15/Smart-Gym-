'use client';

import { useEffect, useState, CSSProperties } from 'react';
import Link from 'next/link';
import type { ConversationPreview } from '@nexera/types';

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

export default function TrainerMessagesPage() {
  const [conversations, setConversations] = useState<ConversationPreview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/trainer/messages')
      .then((r) => {
        if (!r.ok) throw new Error('Failed');
        return r.json();
      })
      .then((d) => { setConversations(d); setLoading(false); })
      .catch(() => { setError('Failed to load conversations.'); setLoading(false); });
  }, []);

  if (loading) return <p style={{ color: 'var(--color-text-muted)' }}>Loading conversations...</p>;
  if (error) return <p style={{ color: 'var(--color-red-light)' }}>{error}</p>;

  return (
    <div>
      <h1 style={{ margin: '0 0 var(--space-5)', fontSize: 'var(--text-xl)', fontWeight: 500, fontFamily: 'var(--font-sans)', letterSpacing: 'var(--tracking-tight)' }}>Messages</h1>

      {conversations.length === 0 ? (
        <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>No conversations yet.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          {conversations.map((c) => (
            <Link key={c.member_id} href={`/trainer/messages/${c.member_id}`} style={cardStyle}>
              <div style={{
                width: 40, height: 40, borderRadius: 'var(--radius-full)', backgroundColor: 'var(--color-bg-elevated)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 'var(--text-base)', fontWeight: 500, flexShrink: 0, color: 'var(--color-text-secondary)',
              }}>
                {c.avatar_url ? (
                  <img src={c.avatar_url} alt="" style={{ width: 40, height: 40, borderRadius: 'var(--radius-full)', objectFit: 'cover' }} />
                ) : (
                  c.member_name.charAt(0).toUpperCase()
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 500, fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)' }}>{c.member_name}</span>
                  <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-xs)' }}>
                    {new Date(c.last_sent_at).toLocaleDateString()}
                  </span>
                </div>
                <div style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-xs)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {c.last_message}
                </div>
              </div>
              {c.unread_count > 0 && (
                <span style={{
                  backgroundColor: 'var(--color-blue)',
                  color: '#fff',
                  borderRadius: 'var(--radius-full)',
                  width: 20,
                  height: 20,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 'var(--text-xs)',
                  fontWeight: 500,
                  flexShrink: 0,
                }}>
                  {c.unread_count}
                </span>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

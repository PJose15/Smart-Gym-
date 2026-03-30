'use client';

import { useEffect, useState, CSSProperties } from 'react';
import Link from 'next/link';
import type { ConversationPreview } from '@nexera/types';

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

export default function TrainerMessagesPage() {
  const [conversations, setConversations] = useState<ConversationPreview[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/trainer/messages')
      .then((r) => r.json())
      .then((d) => { setConversations(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <p style={{ color: '#94A3B8' }}>Loading conversations...</p>;

  return (
    <div>
      <h1 style={{ margin: '0 0 20px', fontSize: 22, fontWeight: 700 }}>Messages</h1>

      {conversations.length === 0 ? (
        <p style={{ color: '#64748B', fontSize: 13 }}>No conversations yet.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {conversations.map((c) => (
            <Link key={c.member_id} href={`/trainer/messages/${c.member_id}`} style={cardStyle}>
              <div style={{
                width: 40, height: 40, borderRadius: '50%', backgroundColor: '#334155',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 16, fontWeight: 600, flexShrink: 0,
              }}>
                {c.avatar_url ? (
                  <img src={c.avatar_url} alt="" style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover' }} />
                ) : (
                  c.member_name.charAt(0).toUpperCase()
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{c.member_name}</span>
                  <span style={{ color: '#64748B', fontSize: 11 }}>
                    {new Date(c.last_sent_at).toLocaleDateString()}
                  </span>
                </div>
                <div style={{ color: '#94A3B8', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {c.last_message}
                </div>
              </div>
              {c.unread_count > 0 && (
                <span style={{
                  backgroundColor: '#3B82F6',
                  color: '#fff',
                  borderRadius: '50%',
                  width: 20,
                  height: 20,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 11,
                  fontWeight: 700,
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

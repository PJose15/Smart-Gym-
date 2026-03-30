'use client';

import { CSSProperties, useEffect, useState } from 'react';
import type { FeedComment } from '@nexera/types';

interface CommentSectionProps {
  eventId: string;
  memberId: string;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const containerStyle: CSSProperties = {
  marginTop: 12,
  paddingTop: 12,
  borderTop: '1px solid rgba(255, 255, 255, 0.06)',
};

const inputRowStyle: CSSProperties = {
  display: 'flex',
  gap: 8,
  marginTop: 10,
};

const inputStyle: CSSProperties = {
  flex: 1,
  padding: '8px 12px',
  borderRadius: 8,
  border: '1px solid #334155',
  backgroundColor: '#0F172A',
  color: '#E2E8F0',
  fontSize: 13,
  outline: 'none',
};

const sendBtnStyle: CSSProperties = {
  padding: '8px 14px',
  borderRadius: 8,
  border: 'none',
  backgroundColor: '#3B82F6',
  color: '#fff',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
};

export function CommentSection({ eventId, memberId }: CommentSectionProps) {
  const [comments, setComments] = useState<FeedComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/member/feed/comments?event_id=${eventId}&member_id=${memberId}`);
        if (res.ok) {
          const data = await res.json();
          setComments(data.comments || []);
        }
      } catch {
        // silent fail
      } finally {
        setLoading(false);
      }
    })();
  }, [eventId, memberId]);

  async function handlePost() {
    if (!text.trim() || posting) return;
    setPosting(true);
    try {
      const res = await fetch('/api/member/feed/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ member_id: memberId, event_id: eventId, comment_text: text.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        setComments(prev => [...prev, {
          id: data.id,
          member_id: memberId,
          member_name: 'You',
          avatar_url: null,
          comment_text: text.trim(),
          mentioned_member_ids: [],
          created_at: data.created_at || new Date().toISOString(),
        }]);
        setText('');
      }
    } catch {
      // silent fail
    } finally {
      setPosting(false);
    }
  }

  async function handleDelete(commentId: string) {
    try {
      const res = await fetch(`/api/member/feed/comments/${commentId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ member_id: memberId }),
      });
      if (res.ok) {
        setComments(prev => prev.filter(c => c.id !== commentId));
      }
    } catch {
      // silent fail
    }
  }

  return (
    <div style={containerStyle}>
      {loading ? (
        <div style={{ fontSize: 12, color: '#64748B', padding: 4 }}>Loading comments...</div>
      ) : (
        <>
          {comments.length === 0 && (
            <div style={{ fontSize: 12, color: '#64748B', padding: 4 }}>No comments yet</div>
          )}
          {comments.map(c => (
            <div key={c.id} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'flex-start' }}>
              <div style={{
                width: 24,
                height: 24,
                borderRadius: '50%',
                backgroundColor: '#334155',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 10,
                color: '#94A3B8',
                fontWeight: 700,
                flexShrink: 0,
              }}>
                {c.member_name.charAt(0).toUpperCase()}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, color: '#E2E8F0' }}>
                  <span style={{ fontWeight: 600 }}>{c.member_name}</span>{' '}
                  {c.comment_text}
                </div>
                <div style={{ display: 'flex', gap: 8, fontSize: 11, color: '#64748B', marginTop: 2 }}>
                  <span>{timeAgo(c.created_at)}</span>
                  {c.member_id === memberId && (
                    <button
                      type="button"
                      onClick={() => handleDelete(c.id)}
                      style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer', fontSize: 11, padding: 0 }}
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </>
      )}

      <div style={inputRowStyle}>
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handlePost()}
          placeholder="Write a comment..."
          style={inputStyle}
          maxLength={500}
        />
        <button type="button" onClick={handlePost} disabled={posting || !text.trim()} style={sendBtnStyle}>
          {posting ? '...' : 'Post'}
        </button>
      </div>
    </div>
  );
}

'use client';

import { useEffect, useState, CSSProperties } from 'react';
import { useParams } from 'next/navigation';
import { MessageThread } from '@/components/trainer/MessageThread';
import { MessageInput } from '@/components/trainer/MessageInput';
import { useRealtimeMessages } from '@/lib/hooks/useRealtimeMessages';
import type { TrainerMessage } from '@nexera/types';

const pageStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  height: 'calc(100vh - 64px)',
};

export default function TrainerMessageThreadPage() {
  const params = useParams();
  const memberId = params.memberId as string;
  const [messages, setMessages] = useState<TrainerMessage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/trainer/messages/${memberId}`)
      .then((r) => r.json())
      .then((d) => { setMessages(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [memberId]);

  useRealtimeMessages(memberId, (msg: TrainerMessage) => {
    if (msg.sender_type === 'member') {
      setMessages((prev) => [...prev, msg]);
    }
  });

  async function handleSend(text: string) {
    const res = await fetch('/api/trainer/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ member_id: memberId, message_text: text }),
    });

    if (res.ok) {
      const newMsg = await res.json();
      setMessages((prev) => [...prev, newMsg]);
    }
  }

  if (loading) return <p style={{ color: 'var(--color-text-muted)' }}>Loading messages...</p>;

  return (
    <div style={pageStyle}>
      <MessageThread messages={messages} />
      <MessageInput onSend={handleSend} />
    </div>
  );
}

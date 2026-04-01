'use client';

import { useEffect, useRef, CSSProperties } from 'react';
import type { TrainerMessage } from '@nexera/types';

const containerStyle: CSSProperties = {
  flex: 1,
  overflowY: 'auto',
  padding: '16px 0',
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
};

const trainerBubble: CSSProperties = {
  maxWidth: '70%',
  padding: '10px 14px',
  borderRadius: '12px 12px 4px 12px',
  backgroundColor: 'var(--color-blue)',
  color: '#fff',
  fontSize: 14,
  alignSelf: 'flex-end',
  lineHeight: 1.5,
};

const memberBubble: CSSProperties = {
  maxWidth: '70%',
  padding: '10px 14px',
  borderRadius: '12px 12px 12px 4px',
  backgroundColor: 'var(--color-bg-raised)',
  color: 'var(--color-text-primary)',
  fontSize: 14,
  alignSelf: 'flex-start',
  lineHeight: 1.5,
};

const timeStyle: CSSProperties = {
  fontSize: 10,
  color: 'var(--color-text-muted)',
  marginTop: 2,
};

interface Props {
  messages: TrainerMessage[];
}

export function MessageThread({ messages }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  if (messages.length === 0) {
    return (
      <div style={{ ...containerStyle, justifyContent: 'center', alignItems: 'center' }}>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>No messages yet. Start the conversation!</p>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      {messages.map((msg) => {
        const isTrainer = msg.sender_type === 'trainer';
        return (
          <div key={msg.id} style={{ alignSelf: isTrainer ? 'flex-end' : 'flex-start' }}>
            <div style={isTrainer ? trainerBubble : memberBubble}>
              {msg.message_text}
            </div>
            <div style={{ ...timeStyle, textAlign: isTrainer ? 'right' : 'left' }}>
              {new Date(msg.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}

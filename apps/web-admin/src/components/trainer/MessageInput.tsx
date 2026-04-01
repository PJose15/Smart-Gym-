'use client';

import { useState, FormEvent, CSSProperties } from 'react';

const formStyle: CSSProperties = {
  display: 'flex',
  gap: 10,
  padding: '12px 0',
  borderTop: '1px solid var(--color-border-default)',
};

const inputStyle: CSSProperties = {
  flex: 1,
  padding: '10px 14px',
  backgroundColor: 'var(--color-bg-base)',
  border: '1px solid var(--color-border-default)',
  borderRadius: 8,
  color: 'var(--color-text-primary)',
  fontSize: 14,
  outline: 'none',
};

const sendStyle: CSSProperties = {
  padding: '10px 20px',
  backgroundColor: 'var(--color-blue)',
  color: '#fff',
  border: 'none',
  borderRadius: 8,
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
};

interface Props {
  onSend: (text: string) => Promise<void>;
}

export function MessageInput({ onSend }: Props) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    setSending(true);
    await onSend(trimmed);
    setText('');
    setSending(false);
  }

  return (
    <form onSubmit={handleSubmit} style={formStyle}>
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Type a message..."
        style={inputStyle}
      />
      <button type="submit" disabled={sending || !text.trim()} style={{ ...sendStyle, opacity: sending ? 0.6 : 1 }}>
        Send
      </button>
    </form>
  );
}

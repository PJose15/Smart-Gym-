'use client';

import { CSSProperties } from 'react';
import Link from 'next/link';

const cardStyle: CSSProperties = {
  backgroundColor: 'var(--color-bg-raised)',
  borderRadius: 10,
  padding: 20,
  textAlign: 'center',
};

export function MemberMessagesTab({ memberId }: { memberId: string }) {
  return (
    <div style={cardStyle}>
      <p style={{ color: 'var(--color-text-secondary)', fontSize: 14, marginBottom: 12 }}>
        View the full message thread with this member.
      </p>
      <Link
        href={`/trainer/messages/${memberId}`}
        style={{
          display: 'inline-block',
          padding: '10px 20px',
          backgroundColor: 'var(--color-blue)',
          color: '#fff',
          borderRadius: 8,
          textDecoration: 'none',
          fontSize: 13,
          fontWeight: 600,
        }}
      >
        Open Messages
      </Link>
    </div>
  );
}

'use client';

import { CSSProperties } from 'react';

const cardStyle: CSSProperties = {
  backgroundColor: 'var(--color-bg-raised)',
  borderRadius: 10,
  padding: 20,
  marginBottom: 16,
};

export function MemberProgramTab({ memberId: _memberId }: { memberId: string }) {
  return (
    <div style={cardStyle}>
      <p style={{ color: 'var(--color-text-secondary)', fontSize: 14, margin: '0 0 8px', fontWeight: 600 }}>
        Programs
      </p>
      <p style={{ color: 'var(--color-text-muted)', fontSize: 13, margin: 0 }}>
        The program assignment system is not yet available. AI-generated programs can be viewed in the member&apos;s mobile app.
      </p>
    </div>
  );
}

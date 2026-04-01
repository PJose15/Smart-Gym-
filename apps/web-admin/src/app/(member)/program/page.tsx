'use client';

export default function ProgramPage() {
  return (
    <div style={{ padding: 'var(--page-padding-x, 16px)', paddingTop: 'var(--space-6, 24px)' }}>
      <h1 style={{ fontSize: 'var(--text-xl, 20px)', fontWeight: 700, margin: 0, color: 'var(--color-text-primary)' }}>
        Program
      </h1>
      <p style={{ color: 'var(--color-text-secondary)', marginTop: 8, fontSize: 14 }}>
        Your training program details will appear here.
      </p>
    </div>
  );
}

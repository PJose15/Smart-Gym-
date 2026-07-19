import type { CSSProperties } from 'react';

const shellStyle: CSSProperties = {
  minHeight: '100vh',
  backgroundColor: 'var(--color-bg-base)',
  color: 'var(--color-text-primary)',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  padding: '0 16px 40px',
};

const innerStyle: CSSProperties = {
  width: '100%',
  maxWidth: 480,
  display: 'flex',
  flexDirection: 'column',
};

const headerStyle: CSSProperties = {
  padding: '32px 0 24px',
  textAlign: 'center',
};

const wordmarkStyle: CSSProperties = {
  fontSize: '1.5rem',
  fontWeight: 700,
  letterSpacing: '-0.02em',
  color: 'var(--color-text-primary)',
  textDecoration: 'none',
};

const accentStyle: CSSProperties = {
  color: 'var(--accent)',
};

export default function OnboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={shellStyle}>
      <div style={innerStyle}>
        <header style={headerStyle}>
          <span style={wordmarkStyle}>
            Nexe<span style={accentStyle}>ra</span>
          </span>
        </header>
        <main>{children}</main>
      </div>
    </div>
  );
}

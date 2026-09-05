import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: 'Nexera — Start Tracking',
  description: 'Scan a machine QR code to start logging your workout',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Pinch-zoom stays enabled (WCAG 1.4.4) — no maximumScale/userScalable caps.
  themeColor: '#0A0A0C',
};

export default function MobileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: 'var(--color-bg-base, #0A0A0C)',
        color: 'var(--color-text-primary, #FFFFFF)',
        fontFamily: 'var(--font-sans)',
        display: 'flex',
        flexDirection: 'column',
        maxWidth: 'var(--content-max-width, 480px)',
        margin: '0 auto',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {children}
    </div>
  );
}

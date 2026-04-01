import type { Metadata } from 'next';
import { AppShell } from '@/components/AppShell';
import '@/styles/tokens.css';
import '@/styles/animations.css';
import '@/styles/scan-flow.css';
import './globals.css';

export const metadata: Metadata = {
  title: 'Nexera Admin',
  description: 'Nexera AI-powered gym fitness platform',
  manifest: '/manifest.json',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: 'var(--font-sans)', backgroundColor: 'var(--color-bg-base)', color: 'var(--color-text-primary)', colorScheme: 'dark' as const, WebkitFontSmoothing: 'antialiased' }}>
        <AppShell>
          {children}
        </AppShell>
      </body>
    </html>
  );
}

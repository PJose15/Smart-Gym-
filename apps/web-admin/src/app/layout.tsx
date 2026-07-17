import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import { AppShell } from '@/components/AppShell';
import '@/styles/tokens.css';
import '@/styles/animations.css';
import '@/styles/scan-flow.css';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
  weight: ['400', '500', '600', '700', '800'],
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
  weight: ['400', '500', '700'],
});

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
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body style={{ margin: 0, fontFamily: 'var(--font-sans)', backgroundColor: 'var(--color-bg-base)', color: 'var(--color-text-primary)', colorScheme: 'dark' as const, WebkitFontSmoothing: 'antialiased' }}>
        <AppShell>
          {children}
        </AppShell>
      </body>
    </html>
  );
}

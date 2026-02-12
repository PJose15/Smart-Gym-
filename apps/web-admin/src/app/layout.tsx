import type { Metadata } from 'next';
import { Sidebar } from './sidebar';
import { AuthGate } from '@/components/AuthGate';

export const metadata: Metadata = {
  title: 'SmartGym Admin',
  description: 'SmartGym administration dashboard',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
        <AuthGate>
          <div style={{ display: 'flex', minHeight: '100vh' }}>
            <Sidebar />
            <main style={{ flex: 1, padding: '32px', backgroundColor: '#f5f5f5' }}>
              {children}
            </main>
          </div>
        </AuthGate>
      </body>
    </html>
  );
}

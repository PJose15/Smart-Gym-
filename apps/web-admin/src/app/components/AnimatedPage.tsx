'use client';

/**
 * AnimatedPage – wraps page content with a fade + slide-up entrance animation.
 * Usage: <AnimatedPage>...page content...</AnimatedPage>
 */
export function AnimatedPage({ children }: { children: React.ReactNode }) {
  return <div className="page-enter">{children}</div>;
}

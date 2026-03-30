const COLORS = [
  '#EF9F27', // gold
  '#F5C563', // light gold
  '#FFD700', // bright gold
  '#FFFFFF', // white
  '#A0D2DB', // accent blue
];

const PIECE_COUNT = 25;
const DURATION_MS = 1500;

/**
 * Launches DOM-based confetti from the bottom 40% of the viewport.
 * Each piece animates upward with random drift and rotation, then
 * self-cleans after DURATION_MS.
 */
export function launchBottomConfetti(): void {
  if (typeof document === 'undefined') return;

  // Respect reduced motion
  const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (mq.matches) return;

  const container = document.createElement('div');
  container.setAttribute('aria-hidden', 'true');
  Object.assign(container.style, {
    position: 'fixed',
    inset: '0',
    pointerEvents: 'none',
    zIndex: '9999',
    overflow: 'hidden',
  });

  for (let i = 0; i < PIECE_COUNT; i++) {
    const piece = document.createElement('div');
    const color = COLORS[Math.floor(Math.random() * COLORS.length)];
    const left = Math.random() * 100;
    const startBottom = Math.random() * 10; // 0-10vh start spread
    const driftX = (Math.random() - 0.5) * 120; // px horizontal drift
    const rotation = Math.random() * 720 - 360;
    const size = 6 + Math.random() * 6; // 6-12px
    const delay = Math.random() * 200;

    Object.assign(piece.style, {
      position: 'absolute',
      bottom: `${startBottom}vh`,
      left: `${left}%`,
      width: `${size}px`,
      height: `${size}px`,
      backgroundColor: color,
      borderRadius: Math.random() > 0.5 ? '50%' : '2px',
      opacity: '1',
      animation: `confettiRise ${DURATION_MS}ms cubic-bezier(0.22, 0.61, 0.36, 1) ${delay}ms forwards`,
      ['--confetti-drift' as string]: `${driftX}px`,
      ['--confetti-rotate' as string]: `${rotation}deg`,
    });

    container.appendChild(piece);
  }

  document.body.appendChild(container);

  setTimeout(() => {
    try { container.remove(); } catch { /* already removed */ }
  }, DURATION_MS + 300);
}

/**
 * Launches DOM-based confetti from the top of the viewport.
 * Each piece animates downward with random drift and rotation, then
 * self-cleans after DURATION_MS.
 */
export function launchTopConfetti(): void {
  if (typeof document === 'undefined') return;

  // Respect reduced motion
  const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (mq.matches) return;

  const container = document.createElement('div');
  container.setAttribute('aria-hidden', 'true');
  Object.assign(container.style, {
    position: 'fixed',
    inset: '0',
    pointerEvents: 'none',
    zIndex: '9999',
    overflow: 'hidden',
  });

  for (let i = 0; i < PIECE_COUNT; i++) {
    const piece = document.createElement('div');
    const color = COLORS[Math.floor(Math.random() * COLORS.length)];
    const left = Math.random() * 100;
    const startTop = Math.random() * 10; // 0-10vh start spread
    const driftX = (Math.random() - 0.5) * 120; // px horizontal drift
    const rotation = Math.random() * 720 - 360;
    const size = 6 + Math.random() * 6; // 6-12px
    const delay = Math.random() * 200;

    Object.assign(piece.style, {
      position: 'absolute',
      top: `${startTop}vh`,
      left: `${left}%`,
      width: `${size}px`,
      height: `${size}px`,
      backgroundColor: color,
      borderRadius: Math.random() > 0.5 ? '50%' : '2px',
      opacity: '1',
      animation: `confettiDrop ${DURATION_MS}ms cubic-bezier(0.22, 0.61, 0.36, 1) ${delay}ms forwards`,
      ['--confetti-drift' as string]: `${driftX}px`,
      ['--confetti-rotate' as string]: `${rotation}deg`,
    });

    container.appendChild(piece);
  }

  document.body.appendChild(container);

  setTimeout(() => {
    try { container.remove(); } catch { /* already removed */ }
  }, DURATION_MS + 300);
}

import { useEffect, useRef, useState } from 'react';
import { Text as RNText, TextStyle } from 'react-native';

interface AnimatedNumberProps {
  value: number;
  duration?: number;
  style?: TextStyle;
  suffix?: string;
}

/**
 * AnimatedNumber – counts up from 0 to target value with easing.
 */
export function AnimatedNumber({ value, duration = 1200, style, suffix = '' }: AnimatedNumberProps) {
  const [display, setDisplay] = useState(0);
  const startTime = useRef<number | null>(null);
  const rafId = useRef<number>(0);

  useEffect(() => {
    if (value === 0) {
      setDisplay(0);
      return;
    }

    startTime.current = null;

    function tick(now: number) {
      if (startTime.current === null) startTime.current = now;
      const elapsed = now - startTime.current;
      const progress = Math.min(elapsed / duration, 1);

      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(eased * value));

      if (progress < 1) {
        rafId.current = requestAnimationFrame(tick);
      }
    }

    rafId.current = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(rafId.current);
  }, [value, duration]);

  return (
    <RNText style={style}>
      {display.toLocaleString()}{suffix}
    </RNText>
  );
}

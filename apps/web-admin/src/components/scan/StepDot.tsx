'use client';

interface StepDotProps {
  active: boolean;
  complete: boolean;
}

export function StepDot({ active, complete }: StepDotProps) {
  const cls = ['step-dot'];
  if (active) cls.push('active');
  else if (complete) cls.push('complete');

  return <div className={cls.join(' ')} aria-hidden="true" />;
}

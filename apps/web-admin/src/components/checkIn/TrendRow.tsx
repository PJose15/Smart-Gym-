'use client';

interface TrendRowProps {
  label: string;
  current: number;
  previous: number;
  format?: (v: number) => string;
}

export function TrendRow({ label, current, previous, format }: TrendRowProps) {
  const diff = current - previous;
  const pct = previous > 0 ? Math.round((diff / previous) * 100) : 0;
  const fmt = format ?? ((v: number) => String(v));

  let trendColor = 'text-zinc-500';
  let arrow = '';
  if (diff > 0) {
    trendColor = 'text-emerald-600';
    arrow = '\u2191'; // ↑
  } else if (diff < 0) {
    trendColor = 'text-red-500';
    arrow = '\u2193'; // ↓
  }

  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-sm text-zinc-500">{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-zinc-800">
          {fmt(current)}
        </span>
        {previous > 0 && (
          <span className={`text-xs ${trendColor}`}>
            {arrow} {Math.abs(pct)}%
          </span>
        )}
      </div>
    </div>
  );
}

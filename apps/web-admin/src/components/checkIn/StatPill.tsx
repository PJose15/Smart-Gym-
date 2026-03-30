'use client';

interface StatPillProps {
  value: string | number;
  label: string;
  highlight?: boolean;
}

export function StatPill({ value, label, highlight }: StatPillProps) {
  return (
    <div
      className={`flex flex-col items-center rounded-lg px-3 py-2 ${
        highlight
          ? 'bg-emerald-50 text-emerald-700'
          : 'bg-zinc-50 text-zinc-700'
      }`}
    >
      <span className="text-lg font-semibold">{value}</span>
      <span className={`text-xs ${highlight ? 'text-emerald-600' : 'text-zinc-500'}`}>{label}</span>
    </div>
  );
}

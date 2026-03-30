'use client';

interface DataRowProps {
  label: string;
  value: string | number;
  highlight?: boolean;
}

export function DataRow({ label, value, highlight }: DataRowProps) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-sm text-zinc-500">{label}</span>
      <span
        className={`text-sm font-medium ${
          highlight ? 'text-emerald-600' : 'text-zinc-800'
        }`}
      >
        {value}
      </span>
    </div>
  );
}

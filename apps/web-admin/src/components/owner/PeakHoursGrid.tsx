'use client';

import { CSSProperties } from 'react';
import type { PeakHourCell } from '@nexera/types';

const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const hours = Array.from({ length: 18 }, (_, i) => i + 5); // 5am-10pm

function getColor(count: number, max: number): string {
  if (count === 0 || max === 0) return 'var(--color-bg-base)';
  const ratio = count / max;
  if (ratio > 0.75) return '#DC2626';
  if (ratio > 0.5) return '#F97316';
  if (ratio > 0.25) return '#EAB308';
  return 'var(--color-green)';
}

const cellStyle: CSSProperties = {
  width: 32,
  height: 24,
  borderRadius: 3,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 9,
  color: 'var(--color-text-primary)',
};

interface Props {
  data: PeakHourCell[];
}

export function PeakHoursGrid({ data }: Props) {
  const cellMap = new Map<string, number>();
  let max = 0;
  data.forEach((c) => {
    cellMap.set(`${c.day_of_week}-${c.hour}`, c.count);
    if (c.count > max) max = c.count;
  });

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ borderCollapse: 'separate', borderSpacing: 2, fontSize: 11 }}>
        <thead>
          <tr>
            <th style={{ padding: '4px 8px', color: 'var(--color-text-muted)', fontSize: 10 }}></th>
            {hours.map((h) => (
              <th key={h} style={{ padding: '4px 2px', color: 'var(--color-text-muted)', fontSize: 10, fontWeight: 400 }}>
                {h % 12 || 12}{h >= 12 ? 'p' : 'a'}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {days.map((day, di) => (
            <tr key={day}>
              <td style={{ padding: '2px 8px', color: 'var(--color-text-secondary)', fontSize: 11, fontWeight: 500 }}>{day}</td>
              {hours.map((h) => {
                const count = cellMap.get(`${di}-${h}`) ?? 0;
                return (
                  <td key={h}>
                    <div
                      style={{ ...cellStyle, backgroundColor: getColor(count, max) }}
                      title={`${day} ${h}:00 — ${count} sessions`}
                    >
                      {count > 0 ? count : ''}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

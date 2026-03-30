'use client';

import { CSSProperties } from 'react';
import { useHourlySessionData } from '@/hooks/useHourlySessionData';

const chartStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-end',
  gap: 3,
  height: 48,
};

const wrapperStyle: CSSProperties = {
  flex: 1,
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'flex-end',
};

const hourLabelStyle: CSSProperties = {
  fontSize: 8,
  color: '#475569',
  marginTop: 4,
};

export function SessionsHourlyChart() {
  const { data, loading } = useHourlySessionData();
  const currentHour = new Date().getHours();

  if (loading) {
    return <div style={{ color: '#64748B', fontSize: 13, height: 48 }}>Loading...</div>;
  }

  const values = Object.values(data);
  const maxCount = values.length > 0 ? Math.max(...values, 1) : 1;

  return (
    <div>
      <div style={chartStyle} role="img" aria-label="Hourly session distribution today">
        {Array.from({ length: 24 }, (_, hour) => {
          const count = data[hour] ?? 0;
          const isCurrentHour = hour === currentHour;
          const heightPct = maxCount > 0 ? (count / maxCount) * 100 : 0;

          const barStyle: CSSProperties = {
            width: '100%',
            background: isCurrentHour ? '#3B82F6' : count > 0 ? '#334155' : '#1E293B',
            borderRadius: '2px 2px 0 0',
            minHeight: 2,
            height: `${Math.max(heightPct, 4)}%`,
            transition: 'height 0.6s ease-out',
          };

          return (
            <div key={hour} style={wrapperStyle}>
              <div
                className={isCurrentHour ? 'hour-bar current' : ''}
                style={barStyle}
                title={`${hour}:00 — ${count} sessions`}
              />
            </div>
          );
        })}
      </div>
      {/* Hour labels — show every 3rd hour */}
      <div style={{ display: 'flex', gap: 3 }}>
        {Array.from({ length: 24 }, (_, hour) => (
          <div key={hour} style={{ ...wrapperStyle, height: 'auto' }}>
            {hour % 3 === 0 && (
              <span style={hourLabelStyle}>
                {hour === 0 ? '12a' : hour < 12 ? `${hour}a` : hour === 12 ? '12p' : `${hour - 12}p`}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

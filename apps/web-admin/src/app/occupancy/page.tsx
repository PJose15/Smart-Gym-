'use client';

import { useEffect, useState, CSSProperties } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { supabase } from '@/lib/supabase';
import { AnimatedPage } from '../components/AnimatedPage';
import type { HourlyUsageCell, MachineUsageFrequency } from '@smartgym/types';

type PeriodDays = 7 | 30 | 90;

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HOUR_START = 6;
const HOUR_END = 22; // 6AM to 10PM

export default function OccupancyPage() {
  const [period, setPeriod] = useState<PeriodDays>(30);
  const [heatData, setHeatData] = useState<HourlyUsageCell[]>([]);
  const [machineUsage, setMachineUsage] = useState<MachineUsageFrequency[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchData(period);
  }, [period]);

  async function fetchData(days: PeriodDays) {
    setLoading(true);
    setError(null);
    try {
      const { data: gyms } = await supabase
        .from('gym_members')
        .select('gym_id')
        .limit(1)
        .single();

      if (!gyms) {
        setError('No gym found');
        setLoading(false);
        return;
      }

      const [heatRes, machineRes] = await Promise.all([
        supabase.rpc('get_hourly_machine_usage', { p_gym_id: gyms.gym_id, p_days: days }),
        supabase.rpc('get_machine_usage_frequency', { p_gym_id: gyms.gym_id, p_days: days }),
      ]);

      if (heatRes.error) throw heatRes.error;
      if (machineRes.error) throw machineRes.error;

      setHeatData((heatRes.data ?? []) as HourlyUsageCell[]);
      setMachineUsage((machineRes.data ?? []) as MachineUsageFrequency[]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load occupancy data');
    } finally {
      setLoading(false);
    }
  }

  // Build heat grid: reorder to Mon-Sun (1,2,3,4,5,6,0)
  const dayOrder = [1, 2, 3, 4, 5, 6, 0];
  const hours = Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i);

  const cellMap = new Map<string, number>();
  let maxCount = 1;
  for (const cell of heatData) {
    const key = `${cell.day_of_week}-${cell.hour_of_day}`;
    cellMap.set(key, cell.session_count);
    if (cell.session_count > maxCount) maxCount = cell.session_count;
  }

  if (loading) {
    return (
      <div style={centeredStyle}>
        <div style={spinnerStyle} className="spinner-enhanced" />
        <p style={{ color: '#999', marginTop: 16 }}>Loading occupancy data...</p>
      </div>
    );
  }

  return (
    <AnimatedPage>
      <div>
        <div style={headerStyle}>
          <h1 style={titleStyle} className="title-animate">Occupancy</h1>
          <p style={subtitleStyle} className="subtitle-animate">
            Historical view of gym usage patterns by time and equipment.
          </p>
        </div>

        {error && (
          <div style={errorBannerStyle} className="error-shake">
            <span>{error}</span>
          </div>
        )}

        {/* Period toggle */}
        <div style={periodToggleStyle}>
          {([7, 30, 90] as PeriodDays[]).map((d) => (
            <button
              key={d}
              style={period === d ? periodActiveStyle : periodBtnStyle}
              onClick={() => setPeriod(d)}
            >
              {d}d
            </button>
          ))}
        </div>

        {/* Heat Grid */}
        <div style={sectionStyle} className="section-glow">
          <h2 style={sectionTitleStyle}>Usage Heatmap</h2>
          <p style={sectionDescStyle}>
            Workout sessions by day and hour. Darker cells indicate higher activity.
          </p>

          <div style={heatGridContainerStyle}>
            {/* Hour labels row */}
            <div style={{ ...heatGridRowStyle, marginLeft: 50 }}>
              {hours.map((h) => (
                <div key={h} style={hourLabelStyle}>
                  {formatHour(h)}
                </div>
              ))}
            </div>

            {/* Day rows */}
            {dayOrder.map((dow) => (
              <div key={dow} style={heatGridRowStyle}>
                <div style={dayLabelStyle}>{DAY_LABELS[dow]}</div>
                {hours.map((h) => {
                  const count = cellMap.get(`${dow}-${h}`) || 0;
                  const intensity = maxCount > 0 ? count / maxCount : 0;
                  return (
                    <div
                      key={h}
                      style={{
                        ...heatCellStyle,
                        backgroundColor: `rgba(67, 97, 238, ${0.08 + intensity * 0.82})`,
                        color: intensity > 0.5 ? '#fff' : '#333',
                      }}
                      title={`${DAY_LABELS[dow]} ${formatHour(h)}: ${count} sessions`}
                    >
                      {count > 0 ? count : ''}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Top Machines */}
        <div style={{ ...sectionStyle, marginTop: 24 }} className="section-glow">
          <h2 style={sectionTitleStyle}>Top Machines</h2>
          <p style={sectionDescStyle}>
            Equipment ranked by session count in the selected period.
          </p>

          {machineUsage.length === 0 ? (
            <p style={emptyStyle}>No usage data available.</p>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(250, machineUsage.slice(0, 15).length * 36)}>
              <BarChart
                data={machineUsage.slice(0, 15)}
                layout="vertical"
                margin={{ left: 120, right: 20, top: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis
                  type="category"
                  dataKey="machine_name"
                  tick={{ fontSize: 12 }}
                  width={110}
                />
                <Tooltip />
                <Bar dataKey="session_count" fill="#4361ee" radius={[0, 4, 4, 0]} name="Sessions" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </AnimatedPage>
  );
}

function formatHour(h: number): string {
  if (h === 0) return '12a';
  if (h < 12) return `${h}a`;
  if (h === 12) return '12p';
  return `${h - 12}p`;
}

/* ── Styles ─────────────────────────────────────────────── */

const headerStyle: CSSProperties = { marginBottom: 32 };

const titleStyle: CSSProperties = {
  fontSize: 28, fontWeight: 700, marginTop: 0, marginBottom: 8, color: '#1a1a2e',
};

const subtitleStyle: CSSProperties = { color: '#666', marginTop: 0, marginBottom: 0 };

const periodToggleStyle: CSSProperties = {
  display: 'inline-flex', gap: 0, backgroundColor: '#f0f0f0',
  borderRadius: 10, padding: 3, marginBottom: 20,
};

const periodBtnStyle: CSSProperties = {
  padding: '8px 20px', borderRadius: 8, border: 'none', cursor: 'pointer',
  fontSize: 14, fontWeight: 600, background: 'transparent', color: '#888',
  transition: 'all 0.2s',
};

const periodActiveStyle: CSSProperties = {
  ...periodBtnStyle, backgroundColor: '#4361ee', color: '#fff',
};

const sectionStyle: CSSProperties = {
  backgroundColor: '#ffffff', borderRadius: 10, padding: 24,
  border: '1px solid rgba(0,0,0,0.06)',
};

const sectionTitleStyle: CSSProperties = {
  fontSize: 20, fontWeight: 600, marginTop: 0, marginBottom: 8, color: '#1a1a2e',
};

const sectionDescStyle: CSSProperties = {
  fontSize: 14, color: '#666', marginTop: 0, marginBottom: 20,
};

const heatGridContainerStyle: CSSProperties = {
  overflowX: 'auto',
};

const heatGridRowStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: `50px repeat(${HOUR_END - HOUR_START}, 1fr)`,
  gap: 2,
  marginBottom: 2,
};

const dayLabelStyle: CSSProperties = {
  fontSize: 12, fontWeight: 600, color: '#666',
  display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
  paddingRight: 8,
};

const hourLabelStyle: CSSProperties = {
  fontSize: 11, color: '#999', textAlign: 'center',
  paddingBottom: 4,
};

const heatCellStyle: CSSProperties = {
  height: 36, borderRadius: 4, display: 'flex',
  alignItems: 'center', justifyContent: 'center',
  fontSize: 11, fontWeight: 600, cursor: 'default',
  minWidth: 36, transition: 'background-color 0.2s',
};

const centeredStyle: CSSProperties = {
  backgroundColor: '#ffffff', borderRadius: 10, padding: 40,
  textAlign: 'center', border: '1px solid rgba(0,0,0,0.06)',
  display: 'flex', flexDirection: 'column', alignItems: 'center',
};

const spinnerStyle: CSSProperties = {
  width: 32, height: 32, border: '3px solid #e0e0e0',
  borderTopColor: '#4fc3f7', borderRadius: '50%',
};

const errorBannerStyle: CSSProperties = {
  backgroundColor: '#fef2f2', border: '1px solid #fecaca',
  borderRadius: 8, padding: '12px 16px', marginBottom: 16,
  color: '#dc2626', fontSize: 14,
};

const emptyStyle: CSSProperties = {
  color: '#999', fontSize: 14, textAlign: 'center', padding: 20,
};

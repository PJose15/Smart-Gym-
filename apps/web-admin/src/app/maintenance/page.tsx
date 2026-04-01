'use client';

import { useEffect, useState, CSSProperties } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { AnimatedPage } from '../components/AnimatedPage';
import { StatCard } from '../components/StatCard';
import type { MachineMaintenanceOverview, MaintenanceStatus } from '@nexera/types';

export default function MaintenancePage() {
  const [machines, setMachines] = useState<MachineMaintenanceOverview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loggingId, setLoggingId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    setError(null);
    try {
      // Get first gym for current user
      const { data: gyms } = await supabase
        .from('gym_members')
        .select('gym_id')
        .limit(1)
        .maybeSingle();

      if (!gyms) {
        setError('No gym found');
        setLoading(false);
        return;
      }

      const { data, error: rpcError } = await supabase
        .rpc('get_maintenance_overview', { p_gym_id: gyms.gym_id });

      if (rpcError) throw rpcError;
      setMachines((data ?? []) as MachineMaintenanceOverview[]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load maintenance data');
    } finally {
      setLoading(false);
    }
  }

  async function handleLogMaintenance(machineId: string) {
    setLoggingId(machineId);
    try {
      const { data: gyms } = await supabase
        .from('gym_members')
        .select('gym_id')
        .limit(1)
        .maybeSingle();

      if (!gyms) throw new Error('No gym found');

      const { data: { user } } = await supabase.auth.getUser();

      // Insert maintenance log
      const { error: insertError } = await supabase
        .from('maintenance_logs')
        .insert({
          gym_id: gyms.gym_id,
          machine_id: machineId,
          performed_by: user?.id ?? null,
          notes: notes[machineId] || null,
          performed_at: new Date().toISOString(),
        });

      if (insertError) throw insertError;

      // Update machine status
      const { error: updateError } = await supabase
        .from('machines')
        .update({
          last_maintained_at: new Date().toISOString(),
          maintenance_status: 'ok',
        })
        .eq('id', machineId);

      if (updateError) throw updateError;

      // Clear notes and refresh
      setNotes((prev) => ({ ...prev, [machineId]: '' }));
      await fetchData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to log maintenance');
    } finally {
      setLoggingId(null);
    }
  }

  const totalMachines = machines.length;
  const dueSoon = machines.filter((m) => m.maintenance_status === 'due_soon').length;
  const overdue = machines.filter((m) => m.maintenance_status === 'overdue').length;

  if (loading) {
    return (
      <div style={centeredStyle}>
        <div style={spinnerStyle} className="spinner-enhanced" />
        <p style={{ color: 'var(--color-text-muted)', marginTop: 16 }}>Loading maintenance data...</p>
      </div>
    );
  }

  return (
    <AnimatedPage>
      <div>
        <div style={headerStyle}>
          <h1 style={titleStyle} className="title-animate">Maintenance</h1>
          <p style={subtitleStyle} className="subtitle-animate">
            Track equipment maintenance status and log service records.
          </p>
        </div>

        {error && (
          <div style={errorBannerStyle} className="error-shake">
            <span>{error}</span>
          </div>
        )}

        <div style={gridStyle}>
          <StatCard title="Total Machines" value={totalMachines} index={0} />
          <StatCard title="Due Soon" value={dueSoon} index={1} />
          <StatCard title="Overdue" value={overdue} index={2} />
        </div>

        {/* Status breakdown strip */}
        {machines.length > 0 && (() => {
          const okCount = machines.filter((m) => m.maintenance_status === 'ok').length;
          const inMaint = machines.filter((m) => m.maintenance_status === 'in_maintenance').length;
          const avgDays = machines.length > 0
            ? Math.round(machines.reduce((s, m) => s + m.days_since_maintenance, 0) / machines.length)
            : 0;
          const totalUsage = machines.reduce((s, m) => s + m.usage_since_maintenance, 0);
          return (
            <div style={statsStripStyle}>
              <span style={{ ...statsChipStyle, backgroundColor: 'var(--color-green-subtle)', color: 'var(--color-green-light)' }}>{okCount} OK</span>
              <span style={{ ...statsChipStyle, backgroundColor: 'var(--color-gold-subtle)', color: 'var(--color-gold-light)' }}>{dueSoon} due soon</span>
              <span style={{ ...statsChipStyle, backgroundColor: 'var(--color-red-subtle)', color: 'var(--color-red-light)' }}>{overdue} overdue</span>
              {inMaint > 0 && <span style={{ ...statsChipStyle, backgroundColor: 'var(--color-blue-subtle)', color: 'var(--color-blue-light)' }}>{inMaint} in maintenance</span>}
              <span style={statsChipStyle}>{avgDays}d avg since service</span>
              <span style={statsChipStyle}>{totalUsage} total uses since service</span>
            </div>
          );
        })()}

        <div style={sectionStyle} className="section-glow">
          <h2 style={sectionTitleStyle}>Equipment Status</h2>

          {machines.length === 0 ? (
            <p style={emptyStyle}>No machines found.</p>
          ) : (
            <div style={tableContainerStyle}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={thStyle}>Machine Name</th>
                    <th style={thStyle}>Type</th>
                    <th style={thStyle}>Status</th>
                    <th style={thStyle}>Days Since</th>
                    <th style={thStyle}>Uses Since</th>
                    <th style={thStyle}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {machines.map((m, i) => (
                    <tr key={m.machine_id} className={`row-stagger stagger-${i} table-row-hover`}>
                      <td style={tdStyle}>
                        <Link href={`/maintenance/${m.machine_id}`} style={linkStyle}>
                          {m.machine_name}
                        </Link>
                      </td>
                      <td style={tdStyle}>{m.equipment_type}</td>
                      <td style={tdStyle}>
                        <span style={getStatusBadgeStyle(m.maintenance_status)}>
                          {formatStatus(m.maintenance_status)}
                        </span>
                      </td>
                      <td style={tdStyle}>{m.days_since_maintenance}</td>
                      <td style={tdStyle}>{m.usage_since_maintenance}</td>
                      <td style={tdStyle}>
                        <div style={actionsStyle}>
                          <input
                            type="text"
                            placeholder="Notes..."
                            value={notes[m.machine_id] || ''}
                            onChange={(e) =>
                              setNotes((prev) => ({ ...prev, [m.machine_id]: e.target.value }))
                            }
                            style={notesInputStyle}
                          />
                          <button
                            onClick={() => handleLogMaintenance(m.machine_id)}
                            disabled={loggingId === m.machine_id}
                            style={{
                              ...logBtnStyle,
                              opacity: loggingId === m.machine_id ? 0.6 : 1,
                            }}
                          >
                            {loggingId === m.machine_id ? 'Logging...' : 'Log Maintenance'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AnimatedPage>
  );
}

function formatStatus(status: MaintenanceStatus): string {
  switch (status) {
    case 'ok': return 'OK';
    case 'due_soon': return 'Due Soon';
    case 'overdue': return 'Overdue';
    case 'in_maintenance': return 'In Maintenance';
  }
}

function getStatusBadgeStyle(status: MaintenanceStatus): CSSProperties {
  const base: CSSProperties = {
    display: 'inline-block',
    padding: '3px 10px',
    borderRadius: 'var(--radius-full)',
    fontSize: 'var(--text-xs)',
    fontWeight: 600,
  };
  switch (status) {
    case 'ok':
      return { ...base, backgroundColor: 'var(--color-green-subtle)', color: 'var(--color-green-light)' };
    case 'due_soon':
      return { ...base, backgroundColor: 'var(--color-gold-subtle)', color: 'var(--color-gold-light)' };
    case 'overdue':
      return { ...base, backgroundColor: 'var(--color-red-subtle)', color: 'var(--color-red-light)' };
    case 'in_maintenance':
      return { ...base, backgroundColor: 'var(--color-blue-subtle)', color: 'var(--color-blue-light)' };
  }
}

/* -- Styles --------------------------------------------------------- */

const headerStyle: CSSProperties = { marginBottom: 32 };

const titleStyle: CSSProperties = {
  fontSize: 'var(--text-2xl)', fontWeight: 600, marginTop: 0, marginBottom: 8, color: 'var(--color-text-primary)',
};

const subtitleStyle: CSSProperties = { color: 'var(--color-text-secondary)', marginTop: 0, marginBottom: 0 };

const gridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
  gap: 16,
  marginBottom: 24,
};

const sectionStyle: CSSProperties = {
  backgroundColor: 'var(--color-bg-raised)', borderRadius: 'var(--radius-md)', padding: 24,
  border: '1px solid var(--color-border-subtle)',
};

const sectionTitleStyle: CSSProperties = {
  fontSize: 'var(--text-lg)', fontWeight: 600, marginTop: 0, marginBottom: 16, color: 'var(--color-text-primary)',
};

const tableContainerStyle: CSSProperties = { overflowX: 'auto' };

const tableStyle: CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-sm)' };

const thStyle: CSSProperties = {
  textAlign: 'left', padding: '12px 16px', borderBottom: '2px solid var(--color-border-default)',
  fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase',
};

const tdStyle: CSSProperties = {
  padding: '12px 16px', borderBottom: '1px solid var(--color-border-subtle)', verticalAlign: 'middle',
};

const linkStyle: CSSProperties = {
  color: 'var(--color-blue)', textDecoration: 'none', fontWeight: 600,
};

const actionsStyle: CSSProperties = {
  display: 'flex', gap: 8, alignItems: 'center',
};

const notesInputStyle: CSSProperties = {
  padding: '6px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border-default)',
  fontSize: 'var(--text-sm)', width: 140, backgroundColor: 'var(--color-bg-elevated)', color: 'var(--color-text-primary)',
};

const logBtnStyle: CSSProperties = {
  padding: '6px 14px', borderRadius: 'var(--radius-sm)', border: 'none',
  backgroundColor: 'var(--color-blue)', color: 'var(--color-text-primary)', fontSize: 'var(--text-sm)',
  fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
};

const centeredStyle: CSSProperties = {
  backgroundColor: 'var(--color-bg-raised)', borderRadius: 'var(--radius-md)', padding: 40,
  textAlign: 'center', border: '1px solid var(--color-border-subtle)',
  display: 'flex', flexDirection: 'column', alignItems: 'center',
};

const spinnerStyle: CSSProperties = {
  width: 32, height: 32, border: '3px solid var(--color-border-default)',
  borderTopColor: 'var(--color-blue)', borderRadius: '50%',
};

const errorBannerStyle: CSSProperties = {
  backgroundColor: 'var(--color-red-subtle)', border: '1px solid var(--color-red)',
  borderRadius: 'var(--radius-md)', padding: '12px 16px', marginBottom: 16,
  color: 'var(--color-red-light)', fontSize: 'var(--text-sm)',
};

const emptyStyle: CSSProperties = {
  color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)', textAlign: 'center', padding: 20,
};

const statsStripStyle: CSSProperties = {
  display: 'flex',
  gap: 8,
  flexWrap: 'wrap',
  marginBottom: 16,
};

const statsChipStyle: CSSProperties = {
  display: 'inline-block',
  padding: '4px 12px',
  borderRadius: 'var(--radius-full)',
  fontSize: 'var(--text-xs)',
  fontWeight: 600,
  backgroundColor: 'var(--color-bg-elevated)',
  color: 'var(--color-text-secondary)',
};

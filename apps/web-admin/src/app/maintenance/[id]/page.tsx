'use client';

import { useEffect, useState, CSSProperties } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { AnimatedPage } from '../../components/AnimatedPage';
import { PageHeader } from '../../components/PageHeader';
import type { MaintenanceLog, MaintenanceStatus } from '@nexera/types';

interface MachineDetail {
  id: string;
  name: string;
  equipment_type: string;
  maintenance_status: MaintenanceStatus;
  maintenance_interval_days: number;
  last_maintained_at: string | null;
}

export default function MachineMaintenanceDetailPage() {
  const params = useParams();
  const machineId = params.id as string;

  const [machine, setMachine] = useState<MachineDetail | null>(null);
  const [logs, setLogs] = useState<MaintenanceLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [intervalDays, setIntervalDays] = useState(90);
  const [usageSinceMaintenance, setUsageSinceMaintenance] = useState(0);

  useEffect(() => {
    fetchData();
  }, [machineId]);

  async function fetchData() {
    setLoading(true);
    setError(null);
    try {
      // Fetch machine details
      const { data: machineData, error: machineErr } = await supabase
        .from('machines')
        .select('id, name, equipment_type, maintenance_status, maintenance_interval_days, last_maintained_at, created_at')
        .eq('id', machineId)
        .single();

      if (machineErr) throw machineErr;
      setMachine(machineData as MachineDetail);
      setIntervalDays(machineData.maintenance_interval_days);

      // Fetch maintenance logs
      const { data: logsData, error: logsErr } = await supabase
        .from('maintenance_logs')
        .select('*')
        .eq('machine_id', machineId)
        .order('performed_at', { ascending: false });

      if (logsErr) throw logsErr;
      setLogs((logsData ?? []) as MaintenanceLog[]);

      // Compute usage since last maintenance
      const sinceDate = machineData.last_maintained_at || machineData.created_at;
      const { count } = await supabase
        .from('workout_exercises')
        .select('id', { count: 'exact', head: true })
        .eq('machine_id', machineId)
        .gte('created_at', sinceDate);

      setUsageSinceMaintenance(count ?? 0);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load machine data');
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdateInterval() {
    setSaving(true);
    try {
      const { error: updateErr } = await supabase
        .from('machines')
        .update({ maintenance_interval_days: intervalDays })
        .eq('id', machineId);

      if (updateErr) throw updateErr;
      setMachine((prev) => prev ? { ...prev, maintenance_interval_days: intervalDays } : prev);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update interval');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div style={centeredStyle}>
        <div style={spinnerStyle} className="spinner-enhanced" />
        <p style={{ color: 'var(--color-text-muted)', marginTop: 16 }}>Loading machine details...</p>
      </div>
    );
  }

  if (!machine) {
    return (
      <div style={centeredStyle}>
        <p style={{ color: 'var(--color-text-muted)' }}>Machine not found.</p>
      </div>
    );
  }

  const daysSinceMaintenance = machine.last_maintained_at
    ? Math.floor((Date.now() - new Date(machine.last_maintained_at).getTime()) / 86400000)
    : null;

  return (
    <AnimatedPage>
      <div>
        <Link href="/maintenance" style={backLinkStyle}>
          &larr; Back to Maintenance
        </Link>

        <PageHeader
          title={machine.name}
          description={`${machine.equipment_type} — Maintenance Details`}
        />

        {error && (
          <div style={errorBannerStyle} className="error-shake">
            <span>{error}</span>
          </div>
        )}

        {/* Stats strip */}
        <div style={statsStripStyle}>
          <span style={{
            ...statsChipStyle,
            backgroundColor: machine.maintenance_status === 'ok' ? 'var(--color-green-subtle)' : machine.maintenance_status === 'overdue' ? 'var(--color-red-subtle)' : machine.maintenance_status === 'due_soon' ? 'var(--color-gold-subtle)' : 'var(--color-blue-subtle)',
            color: machine.maintenance_status === 'ok' ? 'var(--color-green-light)' : machine.maintenance_status === 'overdue' ? 'var(--color-red-light)' : machine.maintenance_status === 'due_soon' ? 'var(--color-gold-light)' : 'var(--color-blue-light)',
          }}>
            {formatStatus(machine.maintenance_status)}
          </span>
          <span style={statsChipStyle}>{machine.equipment_type}</span>
          <span style={statsChipStyle}>{daysSinceMaintenance !== null ? `${daysSinceMaintenance}d since service` : 'Never serviced'}</span>
          <span style={statsChipStyle}>{usageSinceMaintenance} use{usageSinceMaintenance !== 1 ? 's' : ''} since service</span>
          <span style={statsChipStyle}>{logs.length} log entr{logs.length !== 1 ? 'ies' : 'y'}</span>
          <span style={statsChipStyle}>Interval: {machine.maintenance_interval_days}d</span>
        </div>

        {/* Machine Info Card */}
        <div style={cardStyle} className="section-glow">
          <h3 style={cardTitleStyle}>Current Status</h3>
          <div style={infoGridStyle}>
            <div>
              <div style={statLabelStyle}>Status</div>
              <span style={getStatusBadgeStyle(machine.maintenance_status)}>
                {formatStatus(machine.maintenance_status)}
              </span>
            </div>
            <div>
              <div style={statLabelStyle}>Days Since Maintenance</div>
              <div style={statValueStyle}>{daysSinceMaintenance ?? 'Never'}</div>
            </div>
            <div>
              <div style={statLabelStyle}>Uses Since Maintenance</div>
              <div style={statValueStyle}>{usageSinceMaintenance}</div>
            </div>
            <div>
              <div style={statLabelStyle}>Last Maintained</div>
              <div style={statValueStyle}>
                {machine.last_maintained_at
                  ? new Date(machine.last_maintained_at).toLocaleDateString()
                  : 'Never'}
              </div>
            </div>
          </div>
        </div>

        {/* Interval Setting */}
        <div style={{ ...cardStyle, marginTop: 16 }} className="section-glow">
          <h3 style={cardTitleStyle}>Maintenance Interval</h3>
          <div style={intervalRowStyle}>
            <label style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
              Interval (days):
            </label>
            <input
              type="number"
              min={1}
              value={intervalDays}
              onChange={(e) => setIntervalDays(parseInt(e.target.value) || 1)}
              style={intervalInputStyle}
            />
            <button
              onClick={handleUpdateInterval}
              disabled={saving || intervalDays === machine.maintenance_interval_days}
              style={{
                ...saveBtnStyle,
                opacity: saving || intervalDays === machine.maintenance_interval_days ? 0.5 : 1,
              }}
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>

        {/* Maintenance History */}
        <div style={{ ...cardStyle, marginTop: 16 }} className="section-glow">
          <h3 style={cardTitleStyle}>Maintenance History</h3>

          {logs.length === 0 ? (
            <p style={emptyStyle}>No maintenance records yet.</p>
          ) : (
            <div style={tableContainerStyle}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={thStyle}>Date</th>
                    <th style={thStyle}>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log, i) => (
                    <tr key={log.id} className={`row-stagger stagger-${i} table-row-hover`}>
                      <td style={tdStyle}>
                        {new Date(log.performed_at).toLocaleDateString('en-US', {
                          month: 'short', day: 'numeric', year: 'numeric',
                          hour: '2-digit', minute: '2-digit',
                        })}
                      </td>
                      <td style={tdStyle}>{log.notes || '--'}</td>
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
    display: 'inline-block', padding: '3px 10px', borderRadius: 'var(--radius-full)',
    fontSize: 'var(--text-xs)', fontWeight: 600,
  };
  switch (status) {
    case 'ok': return { ...base, backgroundColor: 'var(--color-green-subtle)', color: 'var(--color-green-light)' };
    case 'due_soon': return { ...base, backgroundColor: 'var(--color-gold-subtle)', color: 'var(--color-gold-light)' };
    case 'overdue': return { ...base, backgroundColor: 'var(--color-red-subtle)', color: 'var(--color-red-light)' };
    case 'in_maintenance': return { ...base, backgroundColor: 'var(--color-blue-subtle)', color: 'var(--color-blue-light)' };
  }
}

/* -- Styles --------------------------------------------------------- */

const backLinkStyle: CSSProperties = {
  display: 'inline-block', marginBottom: 16, fontSize: 'var(--text-sm)',
  color: 'var(--color-blue)', textDecoration: 'none', fontWeight: 600,
};

const cardStyle: CSSProperties = {
  backgroundColor: 'var(--color-bg-raised)', borderRadius: 'var(--radius-md)', padding: 24,
  border: '1px solid var(--color-border-subtle)', marginBottom: 0,
};

const cardTitleStyle: CSSProperties = {
  fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--color-text-primary)', marginTop: 0, marginBottom: 16,
};

const infoGridStyle: CSSProperties = {
  display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 20,
};

const statLabelStyle: CSSProperties = { fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', marginBottom: 4 };

const statValueStyle: CSSProperties = { fontSize: 'var(--text-lg)', fontWeight: 600, color: 'var(--color-text-primary)' };

const intervalRowStyle: CSSProperties = {
  display: 'flex', gap: 12, alignItems: 'center',
};

const intervalInputStyle: CSSProperties = {
  padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border-default)',
  fontSize: 'var(--text-sm)', width: 100, backgroundColor: 'var(--color-bg-elevated)', color: 'var(--color-text-primary)',
};

const saveBtnStyle: CSSProperties = {
  padding: '8px 16px', borderRadius: 'var(--radius-sm)', border: 'none',
  backgroundColor: 'var(--color-blue)', color: 'var(--color-text-primary)', fontSize: 'var(--text-sm)',
  fontWeight: 600, cursor: 'pointer',
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

'use client';

import { useEffect, useState, CSSProperties } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { AnimatedPage } from '../../components/AnimatedPage';
import { PageHeader } from '../../components/PageHeader';
import type { MaintenanceLog, MaintenanceStatus } from '@smartgym/types';

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
        <p style={{ color: '#999', marginTop: 16 }}>Loading machine details...</p>
      </div>
    );
  }

  if (!machine) {
    return (
      <div style={centeredStyle}>
        <p style={{ color: '#999' }}>Machine not found.</p>
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
            backgroundColor: machine.maintenance_status === 'ok' ? '#e8f5e9' : machine.maintenance_status === 'overdue' ? '#fce4e6' : machine.maintenance_status === 'due_soon' ? '#fff3e0' : '#e3f2fd',
            color: machine.maintenance_status === 'ok' ? '#2e7d32' : machine.maintenance_status === 'overdue' ? '#c62828' : machine.maintenance_status === 'due_soon' ? '#e65100' : '#1565c0',
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
            <label style={{ fontSize: 14, color: '#333' }}>
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
    display: 'inline-block', padding: '3px 10px', borderRadius: 12,
    fontSize: 12, fontWeight: 600,
  };
  switch (status) {
    case 'ok': return { ...base, backgroundColor: '#e8f5e9', color: '#2e7d32' };
    case 'due_soon': return { ...base, backgroundColor: '#fff3e0', color: '#e65100' };
    case 'overdue': return { ...base, backgroundColor: '#fce4e6', color: '#c62828' };
    case 'in_maintenance': return { ...base, backgroundColor: '#e3f2fd', color: '#1565c0' };
  }
}

/* ── Styles ─────────────────────────────────────────────── */

const backLinkStyle: CSSProperties = {
  display: 'inline-block', marginBottom: 16, fontSize: 14,
  color: '#4361ee', textDecoration: 'none', fontWeight: 600,
};

const cardStyle: CSSProperties = {
  backgroundColor: '#ffffff', borderRadius: 10, padding: 24,
  border: '1px solid rgba(0,0,0,0.06)', marginBottom: 0,
};

const cardTitleStyle: CSSProperties = {
  fontSize: 16, fontWeight: 600, color: '#333', marginTop: 0, marginBottom: 16,
};

const infoGridStyle: CSSProperties = {
  display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 20,
};

const statLabelStyle: CSSProperties = { fontSize: 13, color: '#999', marginBottom: 4 };

const statValueStyle: CSSProperties = { fontSize: 20, fontWeight: 700, color: '#1a1a2e' };

const intervalRowStyle: CSSProperties = {
  display: 'flex', gap: 12, alignItems: 'center',
};

const intervalInputStyle: CSSProperties = {
  padding: '8px 12px', borderRadius: 6, border: '1px solid #ddd',
  fontSize: 14, width: 100,
};

const saveBtnStyle: CSSProperties = {
  padding: '8px 16px', borderRadius: 6, border: 'none',
  backgroundColor: '#4361ee', color: '#fff', fontSize: 13,
  fontWeight: 600, cursor: 'pointer',
};

const tableContainerStyle: CSSProperties = { overflowX: 'auto' };

const tableStyle: CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: 14 };

const thStyle: CSSProperties = {
  textAlign: 'left', padding: '12px 16px', borderBottom: '2px solid #eee',
  fontSize: 13, fontWeight: 600, color: '#666', textTransform: 'uppercase',
};

const tdStyle: CSSProperties = {
  padding: '12px 16px', borderBottom: '1px solid #f0f0f0', verticalAlign: 'middle',
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

const statsStripStyle: CSSProperties = {
  display: 'flex',
  gap: 8,
  flexWrap: 'wrap',
  marginBottom: 16,
};

const statsChipStyle: CSSProperties = {
  display: 'inline-block',
  padding: '4px 12px',
  borderRadius: 14,
  fontSize: 12,
  fontWeight: 600,
  backgroundColor: '#f0f0f0',
  color: '#555',
};

'use client';

import { useEffect, useState, CSSProperties } from 'react';
import { MetricCard } from '@/components/owner/MetricCard';

const spinnerStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  minHeight: 300,
};

const gridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
  gap: 16,
  marginTop: 24,
};

const tableStyle: CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  marginTop: 16,
  fontSize: 13,
};

const thStyle: CSSProperties = {
  textAlign: 'left',
  padding: '10px 12px',
  color: 'var(--color-text-secondary)',
  fontWeight: 500,
  borderBottom: '1px solid var(--color-border-default)',
  fontSize: 12,
};

const tdStyle: CSSProperties = {
  padding: '10px 12px',
  color: 'var(--color-text-primary)',
  borderBottom: '1px solid var(--color-bg-raised)',
};

interface AgentData {
  summary: {
    total_configs: number;
    total_enabled: number;
    total_fires: number;
    last_fired_at: string | null;
  };
  agents: {
    agent_id: string;
    total_configs: number;
    enabled_count: number;
    total_fires: number;
    last_fired_at: string | null;
  }[];
  recent_actions: {
    action_type: string;
    target_type: string;
    details: Record<string, unknown>;
    created_at: string;
  }[];
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function AdminAgentsPage() {
  const [data, setData] = useState<AgentData | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/admin/agents')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load');
        return res.json();
      })
      .then(setData)
      .catch(() => setError('Failed to load agent data.'));
  }, []);

  if (error) {
    return (
      <div>
        <h1 style={{ margin: '0 0 8px', fontSize: 24, fontWeight: 700 }}>Agent Log</h1>
        <p style={{ color: 'var(--color-red)', fontSize: 14 }}>{error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div style={spinnerStyle}>
        <style>{`@keyframes aspin { to { transform: rotate(360deg); } }`}</style>
        <div style={{ width: 28, height: 28, border: '3px solid var(--color-bg-elevated)', borderTopColor: 'var(--color-red)', borderRadius: '50%', animation: 'aspin 0.7s linear infinite' }} />
      </div>
    );
  }

  return (
    <div>
      <h1 style={{ margin: '0 0 4px', fontSize: 24, fontWeight: 700 }}>Agent Log</h1>
      <p style={{ margin: '0 0 16px', color: 'var(--color-text-muted)', fontSize: 14 }}>
        Agent configuration and activity overview
      </p>

      <div style={gridStyle}>
        <MetricCard title="Total Configs" value={data.summary.total_configs} />
        <MetricCard title="Enabled Agents" value={data.summary.total_enabled} />
        <MetricCard title="Total Fires" value={data.summary.total_fires} />
        <MetricCard title="Last Fired" value={timeAgo(data.summary.last_fired_at)} />
      </div>

      {/* Agent Performance Table */}
      <div style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 8px', color: 'var(--color-text-primary)' }}>
          Agents by Type
        </h2>
        <div style={{ backgroundColor: 'var(--color-bg-raised)', borderRadius: 8, overflow: 'hidden' }}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Agent ID</th>
                <th style={thStyle}>Enabled Gyms</th>
                <th style={thStyle}>Total Fires</th>
                <th style={thStyle}>Last Fired</th>
                <th style={thStyle}>Status</th>
              </tr>
            </thead>
            <tbody>
              {data.agents.map((agent) => (
                <tr key={agent.agent_id}>
                  <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: 12 }}>{agent.agent_id}</td>
                  <td style={tdStyle}>{agent.enabled_count} / {agent.total_configs}</td>
                  <td style={tdStyle}>{agent.total_fires.toLocaleString()}</td>
                  <td style={{ ...tdStyle, color: 'var(--color-text-secondary)' }}>{timeAgo(agent.last_fired_at)}</td>
                  <td style={tdStyle}>
                    <span style={{
                      display: 'inline-block',
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      backgroundColor: agent.enabled_count > 0 ? 'var(--color-green)' : 'var(--color-text-muted)',
                      marginRight: 6,
                    }} />
                    {agent.enabled_count > 0 ? 'Active' : 'Inactive'}
                  </td>
                </tr>
              ))}
              {data.agents.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ ...tdStyle, textAlign: 'center', color: 'var(--color-text-muted)', padding: 32 }}>
                    No agent configurations found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Actions */}
      {data.recent_actions.length > 0 && (
        <div style={{ marginTop: 32 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 8px', color: 'var(--color-text-primary)' }}>
            Recent Agent Actions (24h)
          </h2>
          <div style={{ backgroundColor: 'var(--color-bg-raised)', borderRadius: 8, overflow: 'hidden' }}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Action</th>
                  <th style={thStyle}>Target</th>
                  <th style={thStyle}>When</th>
                </tr>
              </thead>
              <tbody>
                {data.recent_actions.map((action, i) => (
                  <tr key={i}>
                    <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: 12 }}>{action.action_type}</td>
                    <td style={{ ...tdStyle, color: 'var(--color-text-secondary)' }}>{action.target_type}</td>
                    <td style={{ ...tdStyle, color: 'var(--color-text-secondary)' }}>{timeAgo(action.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

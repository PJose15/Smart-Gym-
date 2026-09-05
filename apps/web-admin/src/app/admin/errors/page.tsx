'use client';

import { Fragment, useEffect, useState, useCallback, useRef, CSSProperties } from 'react';
import { MetricCard } from '@/components/owner/MetricCard';

const spinnerStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  minHeight: 300,
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
  borderBottom: '1px solid var(--color-bg-elevated)',
  fontSize: 12,
};

const tdStyle: CSSProperties = {
  padding: '10px 12px',
  color: 'var(--color-text-primary)',
  borderBottom: '1px solid var(--color-bg-raised)',
};

const filterBarStyle: CSSProperties = {
  display: 'flex',
  gap: 12,
  marginTop: 16,
  marginBottom: 16,
  flexWrap: 'wrap',
};

const selectStyle: CSSProperties = {
  padding: '8px 12px',
  borderRadius: 6,
  border: '1px solid var(--color-bg-elevated)',
  background: 'var(--color-bg-raised)',
  color: 'var(--color-text-primary)',
  fontSize: 13,
};

const inputStyle: CSSProperties = {
  ...selectStyle,
  flex: 1,
  minWidth: 200,
};

interface ErrorEntry {
  id: string;
  error_code: string;
  error_message: string;
  stack_trace: string | null;
  context: string | null;
  gym_id: string | null;
  resolved: boolean;
  occurred_at: string;
  environment: string;
}

interface ErrorData {
  errors: ErrorEntry[];
  summary: {
    unresolved_24h: number;
    resolved_24h: number;
    affected_gyms: number;
  };
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function AdminErrorsPage() {
  const [data, setData] = useState<ErrorData | null>(null);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('unresolved');
  const [envFilter, setEnvFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [resolving, setResolving] = useState<string | null>(null);
  const [resolveErrorMsg, setResolveErrorMsg] = useState<string | null>(null);
  // Guards against slow responses for stale filters overwriting newer results.
  const fetchSeqRef = useRef(0);

  // Debounce keystrokes — fetch 300 ms after the user stops typing.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const fetchData = useCallback(() => {
    const seq = ++fetchSeqRef.current;
    const params = new URLSearchParams({
      status: statusFilter,
      env: envFilter,
      ...(debouncedSearch ? { search: debouncedSearch } : {}),
    });
    fetch(`/api/admin/errors?${params}`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load');
        return res.json();
      })
      .then((d) => { if (seq === fetchSeqRef.current) setData(d); })
      .catch(() => { if (seq === fetchSeqRef.current) setError('Failed to load error data.'); });
  }, [statusFilter, envFilter, debouncedSearch]);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function resolveError(errorId: string) {
    setResolving(errorId);
    setResolveErrorMsg(null);
    try {
      const res = await fetch(`/api/admin/errors/${errorId}`, { method: 'PATCH' });
      if (!res.ok) throw new Error('Failed');
      fetchData();
    } catch {
      setResolveErrorMsg('Failed to resolve error. Please try again.');
    } finally {
      setResolving(null);
    }
  }

  if (error) {
    return (
      <div>
        <h1 style={{ margin: '0 0 8px', fontSize: 24, fontWeight: 700 }}>Error Log</h1>
        <p style={{ color: 'var(--color-red)', fontSize: 14 }}>{error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div style={spinnerStyle}>
        <div style={{ width: 28, height: 28, border: '3px solid var(--color-bg-elevated)', borderTopColor: 'var(--color-red)', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
      </div>
    );
  }

  return (
    <div>
      <h1 style={{ margin: '0 0 4px', fontSize: 24, fontWeight: 700 }}>Error Log</h1>
      <p style={{ margin: '0 0 16px', color: 'var(--color-text-muted)', fontSize: 14 }}>
        Platform error monitoring and resolution
      </p>

      {resolveErrorMsg && (
        <div style={{ padding: 10, marginBottom: 12, borderRadius: 8, backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--color-red)', fontSize: 13 }}>
          {resolveErrorMsg}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 16 }}>
        <MetricCard title="Unresolved (24h)" value={data.summary.unresolved_24h} />
        <MetricCard title="Resolved (24h)" value={data.summary.resolved_24h} />
        <MetricCard title="Affected Gyms" value={data.summary.affected_gyms} />
      </div>

      <div style={filterBarStyle}>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={selectStyle}>
          <option value="unresolved">Unresolved</option>
          <option value="resolved">Resolved</option>
          <option value="all">All</option>
        </select>
        <select value={envFilter} onChange={(e) => setEnvFilter(e.target.value)} style={selectStyle}>
          <option value="all">All Environments</option>
          <option value="production">Production</option>
          <option value="staging">Staging</option>
        </select>
        <input
          type="text"
          placeholder="Search error code or message..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={inputStyle}
        />
      </div>

      <div style={{ backgroundColor: 'var(--color-bg-raised)', borderRadius: 8, overflow: 'hidden' }}>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>Code</th>
              <th style={thStyle}>Context</th>
              <th style={thStyle}>Message</th>
              <th style={thStyle}>Gym</th>
              <th style={thStyle}>When</th>
              <th style={thStyle}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {data.errors.map((err) => (
              <Fragment key={err.id}>
                <tr
                  onClick={() => setExpandedId(expandedId === err.id ? null : err.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setExpandedId(expandedId === err.id ? null : err.id);
                    }
                  }}
                  tabIndex={0}
                  role="button"
                  aria-expanded={expandedId === err.id}
                  style={{ cursor: 'pointer' }}
                >
                  <td style={{ ...tdStyle, color: 'var(--color-gold)', fontFamily: 'monospace', fontSize: 12 }}>
                    {err.error_code ?? '—'}
                  </td>
                  <td style={{ ...tdStyle, color: 'var(--color-text-secondary)' }}>{err.context ?? '—'}</td>
                  <td style={{ ...tdStyle, maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {err.error_message}
                  </td>
                  <td style={{ ...tdStyle, fontSize: 12, fontFamily: 'monospace', color: 'var(--color-text-secondary)' }}>
                    {err.gym_id ? err.gym_id.slice(0, 8) : '—'}
                  </td>
                  <td style={{ ...tdStyle, color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>
                    {timeAgo(err.occurred_at)}
                  </td>
                  <td style={tdStyle}>
                    {!err.resolved && (
                      <button
                        onClick={(e) => { e.stopPropagation(); resolveError(err.id); }}
                        disabled={resolving === err.id}
                        style={{
                          padding: '4px 10px',
                          borderRadius: 4,
                          border: '1px solid var(--color-bg-elevated)',
                          background: 'var(--color-bg-base)',
                          color: 'var(--color-green)',
                          fontSize: 12,
                          cursor: 'pointer',
                          opacity: resolving === err.id ? 0.5 : 1,
                        }}
                      >
                        {resolving === err.id ? '...' : 'Resolve'}
                      </button>
                    )}
                    {err.resolved && (
                      <span style={{ color: 'var(--color-green)', fontSize: 12 }}>Resolved</span>
                    )}
                  </td>
                </tr>
                {expandedId === err.id && (
                  <tr>
                    <td colSpan={6} style={{ padding: '12px 16px', backgroundColor: 'var(--color-bg-base)', borderBottom: '1px solid var(--color-bg-raised)' }}>
                      <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 8 }}>
                        <strong style={{ color: 'var(--color-text-primary)' }}>Environment:</strong> {err.environment ?? 'unknown'}
                      </div>
                      {err.stack_trace && (
                        <pre style={{ fontSize: 11, color: 'var(--color-text-secondary)', whiteSpace: 'pre-wrap', wordBreak: 'break-all', margin: 0, maxHeight: 200, overflow: 'auto' }}>
                          {err.stack_trace}
                        </pre>
                      )}
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
            {data.errors.length === 0 && (
              <tr>
                <td colSpan={6} style={{ ...tdStyle, textAlign: 'center', color: 'var(--color-text-muted)', padding: 32 }}>
                  No errors found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

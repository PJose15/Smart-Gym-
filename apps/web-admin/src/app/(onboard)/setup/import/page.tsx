'use client';

import { useState, useRef, useCallback, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import { WizardProgress } from '../../components/WizardProgress';

// ─── Types ───────────────────────────────────────────────

type UIState = 'upload' | 'preview' | 'importing' | 'results';

interface ParsedMemberRow {
  display_name: string;
  first_name: string | null;
  email: string | null;
  phone: string | null;
  warnings?: string[];
}

interface RowError {
  row: number;
  errors: string[];
  raw: Record<string, string>;
}

interface ValidateResult {
  valid: ParsedMemberRow[];
  invalid: RowError[];
  total: number;
}

interface ImportResult {
  imported: number;
  skipped: Array<{ row_index: number; reason: string }>;
  invalid_count: number;
}

// ─── Styles ──────────────────────────────────────────────

const cardStyle: CSSProperties = {
  backgroundColor: 'var(--color-bg-elevated)',
  border: '1px solid var(--color-border-default)',
  borderRadius: 12,
  padding: '28px 24px 32px',
};

const headingStyle: CSSProperties = {
  fontSize: '1.375rem',
  fontWeight: 700,
  color: 'var(--color-text-primary)',
  margin: '0 0 4px',
  letterSpacing: '-0.02em',
};

const subStyle: CSSProperties = {
  fontSize: '0.875rem',
  color: 'var(--color-text-secondary)',
  margin: '0 0 24px',
};

const dropZoneStyle: CSSProperties = {
  border: '2px dashed var(--color-border-default)',
  borderRadius: 8,
  padding: '32px 24px',
  textAlign: 'center',
  cursor: 'pointer',
  transition: 'border-color 0.15s',
  marginBottom: 16,
};

const dropZoneActiveStyle: CSSProperties = {
  ...dropZoneStyle,
  borderColor: 'var(--accent)',
  backgroundColor: 'var(--color-bg-base)',
};

const helperTextStyle: CSSProperties = {
  fontSize: '0.8125rem',
  color: 'var(--color-text-muted)',
  marginTop: 8,
  lineHeight: 1.4,
};

const chipRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8,
  marginBottom: 20,
};

const chipStyle = (variant: 'green' | 'red' | 'amber'): CSSProperties => {
  const colors: Record<string, { bg: string; color: string; border: string }> = {
    green: { bg: 'var(--bg-success-subtle, #0d2b1b)', color: 'var(--color-green, #4ade80)', border: 'var(--border-success, #166534)' },
    red: { bg: 'var(--bg-error-subtle, #2b0d0d)', color: 'var(--color-red, #f87171)', border: 'var(--border-error, #991b1b)' },
    amber: { bg: 'var(--bg-warning-subtle, #2b2200)', color: 'var(--color-amber, #fbbf24)', border: 'var(--border-warning, #92400e)' },
  };
  const c = colors[variant];
  return {
    backgroundColor: c.bg,
    color: c.color,
    border: `1px solid ${c.border}`,
    borderRadius: 20,
    padding: '4px 12px',
    fontSize: '0.8125rem',
    fontWeight: 600,
    whiteSpace: 'nowrap',
  };
};

const tableStyle: CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: '0.8125rem',
  marginBottom: 16,
};

const thStyle: CSSProperties = {
  textAlign: 'left',
  padding: '6px 8px',
  borderBottom: '1px solid var(--color-border-default)',
  color: 'var(--color-text-muted)',
  fontWeight: 600,
};

const tdStyle: CSSProperties = {
  padding: '6px 8px',
  borderBottom: '1px solid var(--color-border-default)',
  color: 'var(--color-text-primary)',
};

const primaryBtnStyle: CSSProperties = {
  width: '100%',
  padding: '12px',
  backgroundColor: 'var(--accent)',
  color: '#fff',
  border: 'none',
  borderRadius: 8,
  fontSize: '0.9375rem',
  fontWeight: 600,
  cursor: 'pointer',
  letterSpacing: '-0.01em',
  marginBottom: 10,
};

const disabledBtnStyle: CSSProperties = {
  ...primaryBtnStyle,
  opacity: 0.45,
  cursor: 'not-allowed',
};

const secondaryBtnStyle: CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  backgroundColor: 'transparent',
  color: 'var(--color-text-secondary)',
  border: '1px solid var(--color-border-default)',
  borderRadius: 8,
  fontSize: '0.875rem',
  fontWeight: 500,
  cursor: 'pointer',
};

const errorBannerStyle: CSSProperties = {
  backgroundColor: 'var(--bg-error-subtle, #2b0d0d)',
  border: '1px solid var(--border-error, #991b1b)',
  borderRadius: 8,
  padding: '12px 14px',
  marginBottom: 16,
  fontSize: '0.875rem',
  color: 'var(--color-red, #f87171)',
};

const collapsibleStyle: CSSProperties = {
  marginBottom: 16,
  border: '1px solid var(--color-border-default)',
  borderRadius: 8,
  overflow: 'hidden',
};

const collapsibleHeaderStyle: CSSProperties = {
  width: '100%',
  padding: '10px 14px',
  background: 'var(--color-bg-base)',
  border: 'none',
  cursor: 'pointer',
  textAlign: 'left',
  fontSize: '0.875rem',
  fontWeight: 500,
  color: 'var(--color-text-secondary)',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
};

const errorItemStyle: CSSProperties = {
  padding: '8px 14px',
  fontSize: '0.8125rem',
  color: 'var(--color-red, #f87171)',
  borderTop: '1px solid var(--color-border-default)',
};

const successBannerStyle: CSSProperties = {
  backgroundColor: 'var(--bg-success-subtle, #0d2b1b)',
  border: '1px solid var(--border-success, #166534)',
  borderRadius: 8,
  padding: '16px 18px',
  marginBottom: 20,
};

const noteStyle: CSSProperties = {
  fontSize: '0.8125rem',
  color: 'var(--color-text-muted)',
  marginTop: 16,
  lineHeight: 1.5,
};

const spinnerStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  padding: '40px 0',
  gap: 16,
  color: 'var(--color-text-secondary)',
  fontSize: '0.9375rem',
};

// ─── Component ────────────────────────────────────────────

export default function ImportPage() {
  const router = useRouter();
  const [uiState, setUiState] = useState<UIState>('upload');
  const [isDragOver, setIsDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ValidateResult | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorsExpanded, setErrorsExpanded] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Validate (phase 1) ──────────────────────────────────
  const validateFile = useCallback(async (file: File) => {
    setError(null);
    setSelectedFile(file);

    const fd = new FormData();
    fd.append('file', file);
    fd.append('mode', 'validate');

    try {
      const res = await fetch('/api/owner/members/import', { method: 'POST', body: fd });
      if (!res.ok) {
        const body = await res.json() as { error?: string };
        setError(body.error ?? 'Validation failed. Please try again.');
        return;
      }
      const data = await res.json() as ValidateResult;
      setPreview(data);
      setUiState('preview');
    } catch {
      setError('Network error. Please check your connection and try again.');
    }
  }, []);

  // ── Drop handlers ────────────────────────────────────────
  const handleDrop = useCallback(async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) await validateFile(file);
  }, [validateFile]);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await validateFile(file);
    // Reset so same file can be re-selected
    e.target.value = '';
  }, [validateFile]);

  // ── Import (phase 2) ─────────────────────────────────────
  const handleImport = useCallback(async () => {
    if (!selectedFile || !preview) return;
    setError(null);
    setUiState('importing');

    const fd = new FormData();
    fd.append('file', selectedFile);
    fd.append('mode', 'import');

    try {
      const res = await fetch('/api/owner/members/import', { method: 'POST', body: fd });
      if (!res.ok) {
        const body = await res.json() as { error?: string };
        setError(body.error ?? 'Import failed. Please try again.');
        setUiState('preview');
        return;
      }
      const data = await res.json() as ImportResult;
      setImportResult(data);
      setUiState('results');
    } catch {
      setError('Network error. Please check your connection and try again.');
      setUiState('preview');
    }
  }, [selectedFile, preview]);

  // ── Download error report ─────────────────────────────────
  const downloadErrorReport = useCallback(() => {
    if (!preview?.invalid.length) return;
    const rows = [
      ['row', 'errors', 'original_data'],
      ...preview.invalid.map((r) => [
        String(r.row),
        r.errors.join('; '),
        JSON.stringify(r.raw),
      ]),
    ];
    const csv = rows.map((r) => r.map((v) => `"${v.replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'import-errors.csv';
    a.click();
    URL.revokeObjectURL(url);
  }, [preview]);

  // ── Reset ────────────────────────────────────────────────
  const reset = useCallback(() => {
    setUiState('upload');
    setSelectedFile(null);
    setPreview(null);
    setImportResult(null);
    setError(null);
    setErrorsExpanded(false);
  }, []);

  // ── Render ────────────────────────────────────────────────

  const warningCount = preview?.valid.filter((r) => r.warnings?.length).length ?? 0;

  return (
    <>
      <WizardProgress currentStep={4} />

      <div style={cardStyle}>
        {/* ── Upload state ─────────────────────────────────── */}
        {uiState === 'upload' && (
          <>
            <h1 style={headingStyle}>Import your members</h1>
            <p style={subStyle}>
              Add existing members in bulk from a spreadsheet.
            </p>

            {error && (
              <div style={errorBannerStyle} role="alert">
                {error}
              </div>
            )}

            <div
              style={isDragOver ? dropZoneActiveStyle : dropZoneStyle}
              onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              role="button"
              tabIndex={0}
              aria-label="Drop CSV file here or click to browse"
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click(); }}
            >
              <div style={{ fontSize: '2rem', marginBottom: 8, userSelect: 'none' }}>
                📄
              </div>
              <div style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                Drop your CSV here
              </div>
              <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginTop: 4 }}>
                or click to browse
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                style={{ display: 'none' }}
                onChange={handleFileChange}
                aria-label="Choose CSV file"
              />
            </div>

            <p style={helperTextStyle}>
              Export from Excel or Google Sheets as CSV. Columns we understand:{' '}
              <strong>Name</strong>, <strong>Email</strong>, <strong>Phone</strong>.
              Up to 500 members per file.
            </p>
          </>
        )}

        {/* ── Preview state ─────────────────────────────────── */}
        {uiState === 'preview' && preview && (
          <>
            <h1 style={headingStyle}>Review your import</h1>
            <p style={subStyle}>Check the preview before confirming.</p>

            {error && (
              <div style={errorBannerStyle} role="alert">
                {error}
              </div>
            )}

            {/* Summary chips */}
            <div style={chipRowStyle}>
              <span style={chipStyle('green')}>
                {preview.valid.length} ready
              </span>
              {preview.invalid.length > 0 && (
                <span style={chipStyle('red')}>
                  {preview.invalid.length} with errors
                </span>
              )}
              {warningCount > 0 && (
                <span style={chipStyle('amber')}>
                  {warningCount} without phone
                </span>
              )}
            </div>

            {/* Preview table — first 10 valid rows */}
            {preview.valid.length > 0 && (
              <table style={tableStyle} aria-label="Preview of valid member rows">
                <thead>
                  <tr>
                    <th style={thStyle}>Name</th>
                    <th style={thStyle}>Email</th>
                    <th style={thStyle}>Phone</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.valid.slice(0, 10).map((row, idx) => (
                    <tr key={idx}>
                      <td style={tdStyle}>{row.display_name}</td>
                      <td style={tdStyle}>{row.email ?? '—'}</td>
                      <td style={tdStyle}>{row.phone ?? '—'}</td>
                    </tr>
                  ))}
                  {preview.valid.length > 10 && (
                    <tr>
                      <td colSpan={3} style={{ ...tdStyle, color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                        +{preview.valid.length - 10} more rows…
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}

            {/* Error list (collapsible) */}
            {preview.invalid.length > 0 && (
              <div style={collapsibleStyle}>
                <button
                  type="button"
                  style={collapsibleHeaderStyle}
                  onClick={() => setErrorsExpanded((v) => !v)}
                  aria-expanded={errorsExpanded}
                >
                  <span>Rows with errors ({preview.invalid.length})</span>
                  <span aria-hidden="true">{errorsExpanded ? '▲' : '▼'}</span>
                </button>
                {errorsExpanded && preview.invalid.map((r, idx) => (
                  <div key={idx} style={errorItemStyle}>
                    Row {r.row}: {r.errors.join('; ')}
                  </div>
                ))}
              </div>
            )}

            {/* Download error report */}
            {preview.invalid.length > 0 && (
              <button
                type="button"
                style={{ ...secondaryBtnStyle, marginBottom: 16 }}
                onClick={downloadErrorReport}
              >
                Download error report (.csv)
              </button>
            )}

            {/* Action buttons */}
            <button
              type="button"
              style={preview.valid.length === 0 ? disabledBtnStyle : primaryBtnStyle}
              disabled={preview.valid.length === 0}
              onClick={handleImport}
            >
              Import {preview.valid.length} member{preview.valid.length !== 1 ? 's' : ''}
            </button>
            <button type="button" style={secondaryBtnStyle} onClick={reset}>
              Choose a different file
            </button>
          </>
        )}

        {/* ── Importing state ───────────────────────────────── */}
        {uiState === 'importing' && (
          <div style={spinnerStyle} aria-live="polite" aria-label="Importing members">
            <div style={{ fontSize: '2rem' }}>⏳</div>
            <span>Importing members…</span>
          </div>
        )}

        {/* ── Results state ─────────────────────────────────── */}
        {uiState === 'results' && importResult && (
          <>
            <h1 style={headingStyle}>Import complete</h1>

            <div style={successBannerStyle}>
              <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--color-green, #4ade80)', marginBottom: 4 }}>
                {importResult.imported} member{importResult.imported !== 1 ? 's' : ''} imported
              </div>
              {importResult.skipped.length > 0 && (
                <div style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', marginTop: 4 }}>
                  {importResult.skipped.length} skipped (already in your gym)
                </div>
              )}
              {importResult.invalid_count > 0 && (
                <div style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginTop: 4 }}>
                  {importResult.invalid_count} row{importResult.invalid_count !== 1 ? 's' : ''} skipped due to validation errors
                </div>
              )}
            </div>

            {/* Skipped reasons */}
            {importResult.skipped.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 8 }}>
                  Skipped details:
                </div>
                {importResult.skipped.map((s, idx) => (
                  <div key={idx} style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', padding: '2px 0' }}>
                    Row {s.row_index + 1}: {s.reason}
                  </div>
                ))}
              </div>
            )}

            <p style={noteStyle}>
              Members sign in on the mobile app with their phone number to claim their profile.
            </p>

            <button
              type="button"
              style={primaryBtnStyle}
              onClick={() => router.push('/owner/dashboard')}
            >
              Go to my dashboard
            </button>
            <button type="button" style={secondaryBtnStyle} onClick={reset}>
              Import another file
            </button>
          </>
        )}
      </div>
    </>
  );
}

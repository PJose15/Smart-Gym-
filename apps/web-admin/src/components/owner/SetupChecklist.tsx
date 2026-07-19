'use client';

import type { CSSProperties } from 'react';
import Link from 'next/link';

export interface ChecklistState {
  has_machine: boolean;
  has_members: boolean;
  has_shared_qr: boolean;
}

interface Props {
  checklist: ChecklistState;
}

const cardStyle: CSSProperties = {
  backgroundColor: 'var(--color-bg-raised)',
  borderRadius: 10,
  padding: '20px 24px',
  border: '1px solid var(--color-border-default)',
  marginBottom: 20,
};

const titleStyle: CSSProperties = {
  margin: '0 0 4px',
  fontSize: 15,
  fontWeight: 600,
  color: 'var(--color-text-primary)',
};

const captionStyle: CSSProperties = {
  margin: '0 0 16px',
  fontSize: 12,
  color: 'var(--color-text-muted)',
};

const rowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: '10px 0',
  borderBottom: '1px solid var(--color-bg-elevated)',
};

const rowLastStyle: CSSProperties = {
  ...rowStyle,
  borderBottom: 'none',
};

function CheckIcon({ done }: { done: boolean }) {
  if (done) {
    return (
      <svg
        width={20}
        height={20}
        viewBox="0 0 20 20"
        fill="none"
        aria-hidden="true"
        style={{ flexShrink: 0 }}
      >
        <circle cx="10" cy="10" r="10" fill="var(--color-green)" />
        <path
          d="M5.5 10l3 3 6-6"
          stroke="#fff"
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  return (
    <svg
      width={20}
      height={20}
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
      style={{ flexShrink: 0 }}
    >
      <circle cx="10" cy="10" r="9" stroke="var(--color-border-default)" strokeWidth={2} />
    </svg>
  );
}

interface ChecklistRowProps {
  done: boolean;
  label: string;
  href: string;
  isLast?: boolean;
  /** If true, clicking the row triggers a download rather than navigation */
  download?: boolean;
}

function ChecklistRow({ done, label, href, isLast, download }: ChecklistRowProps) {
  const textStyle: CSSProperties = {
    fontSize: 13,
    fontWeight: 500,
    color: done ? 'var(--color-text-muted)' : 'var(--color-text-primary)',
    textDecoration: done ? 'line-through' : 'none',
    flexGrow: 1,
  };
  const linkStyle: CSSProperties = {
    fontSize: 12,
    color: 'var(--color-blue)',
    textDecoration: 'none',
    fontWeight: 500,
    flexShrink: 0,
  };

  return (
    <div style={isLast ? rowLastStyle : rowStyle}>
      <CheckIcon done={done} />
      <span style={textStyle}>{label}</span>
      {!done && (
        <Link
          href={href}
          download={download ? true : undefined}
          style={linkStyle}
        >
          {download ? 'Download' : 'Go'}
        </Link>
      )}
    </div>
  );
}

/**
 * SetupChecklist — shows onboarding steps with live completion state.
 * Returns null once all three steps are complete.
 */
export function SetupChecklist({ checklist }: Props) {
  const { has_machine, has_members, has_shared_qr } = checklist;

  // Disappear when all three items are complete
  if (has_machine && has_members && has_shared_qr) return null;

  const completedCount = [has_machine, has_members, has_shared_qr].filter(Boolean).length;

  return (
    <div style={cardStyle}>
      <h2 style={titleStyle}>Finish setting up your gym</h2>
      <p style={captionStyle}>
        <span style={{ color: 'var(--color-blue)', fontWeight: 600 }}>{completedCount}</span> of 3 complete
      </p>
      <div>
        <ChecklistRow
          done={has_machine}
          label="Add your first machine"
          href="/machines"
        />
        <ChecklistRow
          done={has_members}
          label="Import or invite your members"
          href="/setup/import"
        />
        <ChecklistRow
          done={has_shared_qr}
          label="Print &amp; share your machine QR codes"
          href="/api/machines/qr-pdf"
          download
          isLast
        />
      </div>
    </div>
  );
}

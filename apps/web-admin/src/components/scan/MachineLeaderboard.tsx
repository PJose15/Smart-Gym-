'use client';

import { CSSProperties, useEffect, useState } from 'react';
import type { MachineLeaderboardEntry } from '@nexera/types';
import { MachineLBEntry } from './MachineLBEntry';

interface MachineLeaderboardProps {
  machineId: string;
  memberId: string;
  gymId: string;
  /** Only show after member logs first set */
  hasLoggedSet: boolean;
}

const containerStyle: CSSProperties = {
  backgroundColor: 'var(--color-bg-raised)',
  borderRadius: 12,
  padding: 14,
};

const headerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  marginBottom: 10,
};

const dividerStyle: CSSProperties = {
  height: 1,
  backgroundColor: 'var(--color-bg-elevated)',
  margin: '4px 0',
};

export function MachineLeaderboard({ machineId, memberId, gymId, hasLoggedSet }: MachineLeaderboardProps) {
  const [entries, setEntries] = useState<MachineLeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!hasLoggedSet) {
      setLoading(false);
      return;
    }

    const load = async () => {
      try {
        const res = await fetch(
          `/api/machine/${machineId}/leaderboard?member_id=${memberId}&gym_id=${gymId}`
        );
        if (res.ok) {
          const data = await res.json();
          setEntries(data.entries ?? []);
        }
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [machineId, memberId, gymId, hasLoggedSet]);

  // Don't show if not logged set or no entries (< 3 members)
  if (!hasLoggedSet || (!loading && entries.length === 0)) return null;

  if (loading) {
    return (
      <div style={containerStyle}>
        <div style={{ textAlign: 'center', padding: 12, color: 'var(--color-text-muted)', fontSize: 12 }}>
          Loading leaderboard...
        </div>
      </div>
    );
  }

  // Split: entries in top N vs appended current member (last entry if gap in rank)
  const topEntries = entries.filter((e, i) => i < entries.length - 1 || e.rank === i + 1);
  const appendedEntry = entries.length > 0 && entries[entries.length - 1].rank > entries.length
    ? entries[entries.length - 1]
    : null;

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <span style={{ fontSize: 14 }}>🏆</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)' }}>
          Machine Leaderboard
        </span>
      </div>

      {topEntries.map((entry) => (
        <MachineLBEntry key={entry.member_id} entry={entry} />
      ))}

      {appendedEntry && (
        <>
          <div style={dividerStyle} />
          <div style={{ textAlign: 'center', fontSize: 10, color: 'var(--color-text-muted)', padding: '2px 0' }}>
            ···
          </div>
          <MachineLBEntry entry={appendedEntry} />
        </>
      )}
    </div>
  );
}

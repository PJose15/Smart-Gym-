'use client';

import { useState, CSSProperties } from 'react';
import { useParams } from 'next/navigation';
import { MemberOverviewTab } from '@/components/trainer/MemberOverviewTab';
import { MemberSessionsTab } from '@/components/trainer/MemberSessionsTab';
import { MemberProgramTab } from '@/components/trainer/MemberProgramTab';
import { MemberNotesTab } from '@/components/trainer/MemberNotesTab';
import { MemberMessagesTab } from '@/components/trainer/MemberMessagesTab';

const tabs = ['Overview', 'Sessions', 'Program', 'Notes', 'Messages'] as const;
type Tab = typeof tabs[number];

const tabBarStyle: CSSProperties = {
  display: 'flex',
  gap: 'var(--space-1)',
  marginBottom: 'var(--space-6)',
  borderBottom: '1px solid var(--color-border-default)',
  paddingBottom: 0,
};

const tabStyle = (active: boolean): CSSProperties => ({
  padding: 'var(--space-3) var(--space-4)',
  fontSize: 'var(--text-sm)',
  fontWeight: active ? 500 : 400,
  color: active ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
  backgroundColor: 'transparent',
  border: 'none',
  borderBottom: active ? '2px solid var(--color-blue)' : '2px solid transparent',
  cursor: 'pointer',
  transition: 'color var(--duration-fast)',
  fontFamily: 'var(--font-sans)',
  minHeight: 'var(--tap-target-min)',
});

export default function TrainerMemberDetailPage() {
  const params = useParams();
  const memberId = params.memberId as string;
  const [activeTab, setActiveTab] = useState<Tab>('Overview');

  return (
    <div>
      <div style={tabBarStyle}>
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={tabStyle(activeTab === tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'Overview' && <MemberOverviewTab memberId={memberId} />}
      {activeTab === 'Sessions' && <MemberSessionsTab memberId={memberId} />}
      {activeTab === 'Program' && <MemberProgramTab memberId={memberId} />}
      {activeTab === 'Notes' && <MemberNotesTab memberId={memberId} />}
      {activeTab === 'Messages' && <MemberMessagesTab memberId={memberId} />}
    </div>
  );
}

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
  gap: 4,
  marginBottom: 24,
  borderBottom: '1px solid #334155',
  paddingBottom: 0,
};

const tabStyle = (active: boolean): CSSProperties => ({
  padding: '10px 16px',
  fontSize: 13,
  fontWeight: active ? 600 : 400,
  color: active ? '#F1F5F9' : '#64748B',
  backgroundColor: 'transparent',
  border: 'none',
  borderBottom: active ? '2px solid #3B82F6' : '2px solid transparent',
  cursor: 'pointer',
  transition: 'color 0.15s',
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

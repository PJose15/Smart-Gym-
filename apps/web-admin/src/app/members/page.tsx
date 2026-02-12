import { PageHeader } from '../components/PageHeader';
import { EmptyState } from '../components/EmptyState';

export default function MembersPage() {
  return (
    <div>
      <PageHeader
        title="Members"
        description="View and manage gym members, track membership status, and review activity history."
      />
      <EmptyState
        icon="👥"
        message="Member list will be displayed here. Connect to Supabase to load data."
      />
    </div>
  );
}

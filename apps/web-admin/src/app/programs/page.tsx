import { PageHeader } from '../components/PageHeader';
import { EmptyState } from '../components/EmptyState';

export default function ProgramsPage() {
  return (
    <div>
      <PageHeader
        title="Programs"
        description="Create and manage workout programs, assign exercises, and set training schedules."
      />
      <EmptyState
        icon="📋"
        message="Program list will be displayed here. Connect to Supabase to load data."
      />
    </div>
  );
}

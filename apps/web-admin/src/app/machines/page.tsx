import { PageHeader } from '../components/PageHeader';
import { EmptyState } from '../components/EmptyState';

export default function MachinesPage() {
  return (
    <div>
      <PageHeader
        title="Machines"
        description="Manage gym machines, monitor status, and configure settings for each piece of equipment."
      />
      <EmptyState
        icon="🏋️"
        message="Machine list will be displayed here. Connect to Supabase to load data."
      />
    </div>
  );
}

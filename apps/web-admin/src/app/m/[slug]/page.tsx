import { createServerSupabaseClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import { MachineFlow } from './MachineFlow';
import type { MachineData } from '@/lib/stores/scanFlowStore';

// ISR: revalidate every hour — machine data rarely changes
export const revalidate = 3600;

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function MachinePage({ params }: PageProps) {
  const { slug } = await params;
  const supabase = await createServerSupabaseClient();

  // Uses idx_machines_qr_slug UNIQUE index — O(1) lookup
  const { data: machine, error } = await supabase
    .from('machines')
    .select(`
      id,
      gym_id,
      name,
      qr_slug,
      category,
      muscle_groups,
      instructions,
      demo_image_url,
      location_in_gym,
      is_active,
      gyms!inner (
        id,
        name,
        slug,
        logo_url
      )
    `)
    .eq('qr_slug', slug)
    .single();

  if (error || !machine || !machine.is_active) {
    notFound();
  }

  const gym = machine.gyms as unknown as {
    id: string;
    name: string;
    slug: string;
    logo_url: string | null;
  };

  const machineData: MachineData = {
    id: machine.id,
    gym_id: machine.gym_id,
    name: machine.name,
    qr_slug: machine.qr_slug,
    category: machine.category,
    muscle_groups: machine.muscle_groups,
    instructions: machine.instructions,
    demo_image_url: machine.demo_image_url,
    location_in_gym: machine.location_in_gym,
    is_active: machine.is_active,
    gym: {
      id: gym.id,
      name: gym.name,
      slug: gym.slug,
      logo_url: gym.logo_url,
    },
  };

  return <MachineFlow machine={machineData} />;
}

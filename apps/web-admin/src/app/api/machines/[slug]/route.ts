import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

interface RouteParams {
  params: Promise<{ slug: string }>;
}

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { slug } = await params;

  if (!slug || slug.length < 2) {
    return NextResponse.json(
      { error: 'Invalid machine slug' },
      { status: 400 }
    );
  }

  const admin = getAdminClient();

  // Uses idx_machines_qr_slug UNIQUE index — O(1) lookup
  const { data: machine, error } = await admin
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

  if (error || !machine) {
    return NextResponse.json(
      { error: 'Machine not found' },
      { status: 404 }
    );
  }

  if (!machine.is_active) {
    return NextResponse.json(
      { error: 'Machine is currently inactive' },
      { status: 410 }
    );
  }

  // Flatten gym join
  const gym = machine.gyms as unknown as {
    id: string;
    name: string;
    slug: string;
    logo_url: string | null;
  };

  return NextResponse.json({
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
  });
}

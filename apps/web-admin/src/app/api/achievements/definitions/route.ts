import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data, error } = await supabase
      .from('achievement_definitions')
      .select('id, code, title, description, category, points, required_value, required_unit, icon_name, sort_order, is_active, created_at')
      .order('category', { ascending: true })
      .limit(500);

    if (error) return NextResponse.json({ error: 'Failed to fetch definitions' }, { status: 500 });
    return NextResponse.json({ definitions: data ?? [] });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

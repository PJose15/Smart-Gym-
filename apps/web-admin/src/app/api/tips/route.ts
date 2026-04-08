import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerSupabaseClient } from '@/lib/supabase/server';

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

const STATIC_TIPS = [
  'Focus on controlled movements — slow eccentric, explosive concentric.',
  'Stay hydrated. Even mild dehydration can reduce strength by 10%.',
  'Rest 2-3 minutes between heavy sets for optimal recovery.',
  'Track your workouts consistently — what gets measured gets improved.',
  'Progressive overload is key: add weight, reps, or sets over time.',
];

/**
 * GET /api/tips?category=strength&experience=beginner&member_id=X&machine_id=Y
 * Returns a workout tip with 5-level fallback:
 * 1. AI coaching_tip via edge function (needs member_id + machine_id)
 * 2. ai_tip_cache (same member+machine+today)
 * 3. tip_library (category + experience)
 * 4. tip_library (category only)
 * 5. Static hardcoded
 */
export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = request.nextUrl;
  const category = searchParams.get('category');
  const experience = searchParams.get('experience');
  const memberId = searchParams.get('member_id');
  const machineId = searchParams.get('machine_id');

  const admin = getAdminClient();

  // Level 1: AI-generated tip via edge function (needs member_id + machine_id)
  if (memberId && machineId) {
    try {
      // Fetch machine details for the prompt
      const { data: machine } = await admin
        .from('machines')
        .select('name, category, muscle_groups')
        .eq('id', machineId)
        .single();

      if (machine) {
        const edgeFnUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/ai-generate`;
        const res = await fetch(edgeFnUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({
            action: 'coaching_tip',
            payload: {
              member_id: memberId,
              gym_id: '', // not strictly needed for tip gen
              machine_id: machineId,
              machine_name: machine.name,
              muscle_groups: machine.muscle_groups ?? [],
              category: machine.category ?? category ?? '',
              experience_level: experience ?? 'beginner',
              sets_logged: 0,
            },
          }),
          signal: AbortSignal.timeout(10_000),
        });

        if (res.ok) {
          const json = await res.json();
          if (json.data?.tip_text) {
            return NextResponse.json({
              tip: json.data.tip_text,
              source: json.data.cached ? 'ai_cache' : 'ai_generated',
            });
          }
        }
      }
    } catch {
      // Fall through to Level 2
    }

    // Level 2: Check ai_tip_cache directly (in case edge function failed but cache exists)
    try {
      const today = new Date().toISOString().split('T')[0];
      const { data: cached } = await admin
        .from('ai_tip_cache')
        .select('tip_text')
        .eq('member_id', memberId)
        .eq('machine_id', machineId)
        .eq('cache_date', today)
        .maybeSingle();

      if (cached?.tip_text) {
        return NextResponse.json({ tip: cached.tip_text, source: 'ai_cache' });
      }
    } catch {
      // Fall through to Level 3
    }
  }

  // Level 3: tip_library (category + experience match)
  if (category && experience) {
    const { data } = await admin
      .from('tip_library')
      .select('tip_text')
      .eq('machine_category', category)
      .eq('experience_level', experience)
      .eq('is_active', true)
      .limit(5);

    if (data && data.length > 0) {
      const tip = data[Math.floor(Math.random() * data.length)];
      return NextResponse.json({ tip: tip.tip_text, source: 'tip_library' });
    }
  }

  // Level 4: tip_library (category only)
  if (category) {
    const { data } = await admin
      .from('tip_library')
      .select('tip_text')
      .eq('machine_category', category)
      .eq('is_active', true)
      .limit(5);

    if (data && data.length > 0) {
      const tip = data[Math.floor(Math.random() * data.length)];
      return NextResponse.json({ tip: tip.tip_text, source: 'tip_library_category' });
    }
  }

  // Level 5: static fallback
  const tip = STATIC_TIPS[Math.floor(Math.random() * STATIC_TIPS.length)];
  return NextResponse.json({ tip, source: 'static' });
}

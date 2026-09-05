import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { lookupSchema } from '@/lib/validation/auth';
import { checkRateLimit } from '@/lib/rateLimit';

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

/**
 * POST /api/auth/lookup
 * Detects if a phone number belongs to an existing member.
 *
 * BE-H6: this endpoint is pre-auth, so the payload is deliberately minimal —
 * `{ path, firstName? }` only. Never return ids, phone, full display_name,
 * goals, or any other member PII from here.
 * Returns auth path: 'cold' | 'preloaded' | 'returning'
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = lookupSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid input' },
        { status: 400 }
      );
    }

    const { phone, gym_id } = parsed.data;

    // BE-H6: pre-auth endpoint — two limits: an overall per-IP cap (stops one
    // caller enumerating many distinct phones) plus a per-IP+phone cap (stops
    // hammering a single phone). First hop of x-forwarded-for = client on
    // Vercel; behind other proxies this header is client-controlled, which is
    // why the per-IP cap is a hardening layer, not the only defense.
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const ipLimited = checkRateLimit(`lookup-ip:${ip}`, 30, 300_000);
    if (ipLimited) return ipLimited;
    const limited = checkRateLimit(`lookup:${ip}:${phone}`, 20, 300_000);
    if (limited) return limited;

    const admin = getAdminClient();

    // Look up member by phone in this gym
    const { data: member, error } = await admin
      .from('members')
      .select('user_id, display_name, first_name')
      .eq('gym_id', gym_id)
      .eq('phone', phone)
      .eq('is_active', true)
      .maybeSingle();

    if (error) {
      console.error('Lookup error:', error);
      return NextResponse.json(
        { error: 'Lookup failed' },
        { status: 500 }
      );
    }

    if (!member) {
      // No match — cold path (new user)
      return NextResponse.json({ path: 'cold' as const });
    }

    // First name only, for the greeting — fall back to the first word of
    // display_name when first_name is unset.
    const firstName =
      member.first_name || member.display_name?.split(' ')[0] || null;

    if (member.user_id === null) {
      // Member exists but no auth user linked — preloaded by gym owner
      return NextResponse.json({ path: 'preloaded' as const, firstName });
    }

    // Member has an auth user — returning (whether or not onboarding finished)
    return NextResponse.json({ path: 'returning' as const, firstName });
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

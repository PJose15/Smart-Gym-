import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyStaff } from '@/lib/auth/verifyStaff';

const addSchema = z.object({
  email: z.string().email().max(256),
});

/**
 * POST /api/admin/members/add
 * Staff-scoped (trainer/owner). Adds an existing user (resolved by email from
 * `users`) as a member of the caller's gym by inserting into the real `members`
 * table. The `gym_members` view is read-only for clients, so the insert goes
 * through the service-role admin client.
 */
export async function POST(request: NextRequest) {
  const result = await verifyStaff();
  if (result instanceof NextResponse) return result;

  try {
    const { admin, gym_id } = result;

    const body = await request.json().catch(() => null);
    const parsed = addSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid input' },
        { status: 400 },
      );
    }

    const email = parsed.data.email.trim().toLowerCase();

    // Resolve the user account by email.
    const { data: user, error: userError } = await admin
      .from('users')
      .select('id, email, display_name, first_name')
      .ilike('email', email)
      .maybeSingle();

    if (userError) {
      console.error('[/api/admin/members/add] User lookup error:', userError);
      return NextResponse.json({ error: 'Failed to look up user' }, { status: 500 });
    }
    if (!user) {
      return NextResponse.json(
        { error: `No user found for "${email}". The user must sign up first.` },
        { status: 404 },
      );
    }

    // Prevent duplicate membership in this gym.
    const { data: existing } = await admin
      .from('members')
      .select('id')
      .eq('gym_id', gym_id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: 'This user is already a member of your gym.' },
        { status: 409 },
      );
    }

    const { data: inserted, error: insertError } = await admin
      .from('members')
      .insert({
        gym_id,
        user_id: user.id,
        display_name: user.display_name ?? user.first_name ?? user.email,
        first_name: user.first_name ?? null,
        email: user.email,
        onboarding_status: 'pending',
      })
      .select('id, gym_id, user_id, display_name, email, smartgym_score, onboarding_status, joined_gym_at')
      .single();

    if (insertError || !inserted) {
      console.error('[/api/admin/members/add] Insert error:', insertError);
      return NextResponse.json({ error: 'Failed to add member' }, { status: 500 });
    }

    return NextResponse.json({
      member: {
        id: inserted.id,
        gym_id: inserted.gym_id,
        user_id: inserted.user_id,
        display_name: user.display_name ?? inserted.display_name,
        email: inserted.email,
        smartgym_score: inserted.smartgym_score ?? 0,
        onboarding_status: inserted.onboarding_status,
        joined_at: inserted.joined_gym_at,
      },
    });
  } catch (err) {
    console.error('[/api/admin/members/add] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

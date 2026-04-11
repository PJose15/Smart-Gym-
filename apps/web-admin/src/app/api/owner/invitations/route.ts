import { NextRequest, NextResponse } from 'next/server';
import { verifyStaff } from '@/lib/auth/verifyStaff';
import { trainerInvitationSchema } from '@/lib/validation/staff';
import { checkRateLimit } from '@/lib/rateLimit';
import crypto from 'crypto';

export async function GET() {
  try {
    const result = await verifyStaff('owner');
    if (result instanceof NextResponse) return result;

    const { admin, gym_id } = result;

    const { data: invitations } = await admin
      .from('trainer_invitations')
      .select('*')
      .eq('gym_id', gym_id)
      .order('created_at', { ascending: false });

    return NextResponse.json(invitations ?? []);
  } catch (err) {
    console.error('[owner/invitations GET] Error:', err instanceof Error ? err.message : 'Unknown error');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const result = await verifyStaff('owner');
    if (result instanceof NextResponse) return result;

    const { admin, user_id, gym_id } = result;
    const body = await req.json();

    const parsed = trainerInvitationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
    }

    const { email, trainer_name, permissions } = parsed.data;

    const rl = checkRateLimit(`trainer-invite:${gym_id}`, 10, 300_000);
    if (rl) return rl;

    // Generate unique token
    const token = crypto.randomBytes(32).toString('hex');

    // Expires in 7 days
    const expires_at = new Date(Date.now() + 7 * 86400000).toISOString();

    const { data: invitation, error } = await admin
      .from('trainer_invitations')
      .insert({
        gym_id,
        email,
        trainer_name,
        invited_by: user_id,
        token,
        permissions: permissions ?? {},
        status: 'pending',
        expires_at,
      })
      .select()
      .single();

    if (error) {
      console.error('[owner/invitations POST] DB error:', error);
      return NextResponse.json({ error: 'Failed to create invitation' }, { status: 500 });
    }

    // MVP: No email sending — just create the record
    return NextResponse.json(invitation, { status: 201 });
  } catch (err) {
    console.error('[owner/invitations POST] Error:', err instanceof Error ? err.message : 'Unknown error');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

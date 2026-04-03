import { NextRequest, NextResponse } from 'next/server';
import { verifySuperAdmin } from '@/lib/auth/verifySuperAdmin';

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const result = await verifySuperAdmin();
    if (result instanceof NextResponse) return result;
    const { admin, user_id } = result;

    if (params.userId === user_id)
      return NextResponse.json(
        { error: 'Cannot suspend yourself' },
        { status: 400 }
      );

    const { error } = await admin.auth.admin.updateUserById(params.userId, {
      ban_duration: '876000h',
    });
    if (error)
      return NextResponse.json(
        { error: 'Failed to suspend user' },
        { status: 500 }
      );

    // Log action
    await admin.from('admin_actions_log').insert({
      admin_user_id: user_id,
      action: 'suspend_user',
      target_user_id: params.userId,
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

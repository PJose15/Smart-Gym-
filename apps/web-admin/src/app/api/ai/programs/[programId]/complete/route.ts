import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';
import { checkRateLimit } from '@/lib/rateLimit';
import { validateUUIDs } from '@/lib/validation/uuid';

/**
 * POST /api/ai/programs/[programId]/complete — mark program finished
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ programId: string }> }
) {
  try {
    const { programId } = await params;
    const uuidError = validateUUIDs({ programId });
    if (uuidError) return uuidError;

    const supabase = await createServerSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rl = checkRateLimit(`program-complete:${programId}`, 5, 60_000);
    if (rl) return rl;

    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Verify member owns this program
    const { data: program } = await admin
      .from('ai_programs')
      .select('id, member_id, is_active')
      .eq('id', programId)
      .maybeSingle();

    if (!program) {
      return NextResponse.json({ error: 'Program not found' }, { status: 404 });
    }

    // Verify the authenticated user owns this member record
    const { data: member } = await admin
      .from('members')
      .select('id')
      .eq('id', program.member_id)
      .eq('user_id', session.user.id)
      .maybeSingle();

    if (!member) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (!program.is_active) {
      return NextResponse.json({ error: 'Program already completed' }, { status: 400 });
    }

    const { error } = await admin
      .from('ai_programs')
      .update({
        is_active: false,
        completed_at: new Date().toISOString(),
      })
      .eq('id', programId);

    if (error) {
      return NextResponse.json({ error: 'Failed to complete program' }, { status: 500 });
    }

    return NextResponse.json({ success: true, completed_at: new Date().toISOString() });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

import { NextResponse, NextRequest } from 'next/server';
import { verifyStaff } from '@/lib/auth/verifyStaff';
import { validateUUIDs } from '@/lib/validation/uuid';

export const dynamic = 'force-dynamic';

/** POST /api/machine/[machineId]/demo-video — Owner uploads demo video */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ machineId: string }> }
) {
  try {
    const { machineId } = await params;
    const uuidError = validateUUIDs({ machineId });
    if (uuidError) return uuidError;
    const staffResult = await verifyStaff('owner');
    if (staffResult instanceof NextResponse) return staffResult;
    const { user_id, gym_id, admin } = staffResult;

    // Verify machine belongs to this gym
    const { data: machine } = await admin
      .from('machines')
      .select('id')
      .eq('id', machineId)
      .eq('gym_id', gym_id)
      .single();

    if (!machine) {
      return NextResponse.json({ error: 'Machine not found' }, { status: 404 });
    }

    const formData = await request.formData();
    const file = formData.get('video') as File | null;
    if (!file) {
      return NextResponse.json({ error: 'video file required' }, { status: 400 });
    }

    if (file.size > 50 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large (max 50MB)' }, { status: 400 });
    }

    const ext = file.name.split('.').pop() ?? 'mp4';
    const path = `${gym_id}/${machineId}.${ext}`;

    const { error: uploadError } = await admin.storage
      .from('machine-demos')
      .upload(path, file, { upsert: true, contentType: file.type });

    if (uploadError) throw uploadError;

    const { data: urlData } = admin.storage.from('machine-demos').getPublicUrl(path);

    await admin
      .from('machines')
      .update({
        demo_video_url: urlData.publicUrl,
        demo_video_uploaded_by: user_id,
        demo_video_uploaded_at: new Date().toISOString(),
      })
      .eq('id', machineId);

    return NextResponse.json({ demo_video_url: urlData.publicUrl });
  } catch (err) {
    console.error('[demo-video] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { verifyMember } from '@/lib/auth/verifyMember';
import { checkRateLimit } from '@/lib/rateLimit';

interface RouteParams {
  params: Promise<{ memberId: string }>;
}

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE = 5 * 1024 * 1024; // 5 MB

const EXT_MAP: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

/** Validate file magic bytes match declared MIME type */
function validateMagicBytes(buffer: Buffer, mimeType: string): boolean {
  if (buffer.length < 4) return false;
  switch (mimeType) {
    case 'image/jpeg':
      return buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF;
    case 'image/png':
      return buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47;
    case 'image/webp':
      // RIFF....WEBP
      return buffer.length >= 12
        && buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46
        && buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50;
    default:
      return false;
  }
}

/**
 * POST /api/member/[memberId]/avatar
 * Upload or replace the member's avatar image.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { memberId } = await params;

    const rl = checkRateLimit(`avatar:${memberId}`, 10, 60_000);
    if (rl) return rl;

    const authResult = await verifyMember(memberId);
    if (authResult instanceof NextResponse) return authResult;
    const { admin } = authResult;

    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'File too large (max 5 MB)' }, { status: 400 });
    }

    const contentType = file.type;
    if (!ALLOWED_TYPES.includes(contentType)) {
      return NextResponse.json(
        { error: 'Invalid file type. Allowed: JPEG, PNG, WebP' },
        { status: 400 }
      );
    }

    const ext = EXT_MAP[contentType] ?? 'jpg';
    const buffer = Buffer.from(await file.arrayBuffer());

    // Validate magic bytes match declared MIME type
    if (!validateMagicBytes(buffer, contentType)) {
      return NextResponse.json(
        { error: 'File contents do not match declared type' },
        { status: 400 }
      );
    }

    const path = `${memberId}/avatar.${ext}`;

    const { error: uploadError } = await admin.storage
      .from('avatars')
      .upload(path, buffer, { contentType, upsert: true });

    if (uploadError) {
      console.error('[avatar] Upload error:', uploadError);
      return NextResponse.json({ error: 'Failed to upload avatar' }, { status: 500 });
    }

    const { data: urlData } = admin.storage
      .from('avatars')
      .getPublicUrl(path);

    const avatar_url = `${urlData.publicUrl}?t=${Date.now()}`;

    const { error: updateError } = await admin
      .from('members')
      .update({ avatar_url })
      .eq('id', memberId);

    if (updateError) {
      console.error('[avatar] DB update error:', updateError);
      return NextResponse.json({ error: 'Failed to save avatar URL' }, { status: 500 });
    }

    return NextResponse.json({ avatar_url });
  } catch (err) {
    console.error('[avatar] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

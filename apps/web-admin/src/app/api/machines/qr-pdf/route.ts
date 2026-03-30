import { NextRequest, NextResponse } from 'next/server';
import { verifyStaff } from '@/lib/auth/verifyStaff';
import { generateQrPdf } from '@/lib/qr/generateQrPdf';

export async function GET(req: NextRequest) {
  try {
    const result = await verifyStaff('owner');
    if (result instanceof NextResponse) return result;

    const { admin, gym_id } = result;

    // Get gym info
    const { data: gym } = await admin
      .from('gyms')
      .select('name, slug')
      .eq('id', gym_id)
      .single();

    // Get all machines for this gym
    const { data: machines } = await admin
      .from('machines')
      .select('name, qr_slug, equipment_type')
      .eq('gym_id', gym_id)
      .order('name');

    if (!machines || machines.length === 0) {
      return NextResponse.json({ error: 'No machines found' }, { status: 404 });
    }

    const baseUrl = req.headers.get('origin') ?? process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.nexera.fit';

    const pdfBytes = await generateQrPdf(
      machines,
      gym?.name ?? 'Gym',
      baseUrl
    );

    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${(gym?.slug ?? 'gym')}-qr-codes.pdf"`,
      },
    });
  } catch (err) {
    console.error('[machines/qr-pdf] Error:', err);
    return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 });
  }
}

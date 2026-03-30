import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const timestamp = new Date().toISOString()
  const version = process.env.NEXT_PUBLIC_APP_VERSION ?? '0.1.0'

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { status: 'ok', version, timestamp, db: 'skipped' },
      { status: 200 }
    )
  }

  try {
    const { getSupabaseAdmin } = await import('@/lib/supabase/admin')
    const admin = getSupabaseAdmin()

    const { error } = await admin
      .from('gyms')
      .select('id')
      .limit(1)
      .maybeSingle()

    if (error) throw error

    return NextResponse.json(
      { status: 'ok', version, timestamp },
      { status: 200 }
    )
  } catch (err) {
    console.error('[/api/health] DB check failed:', err)
    return NextResponse.json(
      { status: 'degraded', error: 'Service check failed', timestamp },
      { status: 503 }
    )
  }
}

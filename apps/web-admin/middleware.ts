import { updateSession } from '@/lib/supabase/middleware'
import { NextResponse, type NextRequest } from 'next/server'

const CSRF_EXEMPT = [
  '/api/billing/webhook',
  '/api/cron/',
  '/api/agents/',
  '/api/health',
  '/api/dev/',
  '/api/onboard/',
]

function isCsrfExempt(pathname: string): boolean {
  return CSRF_EXEMPT.some(
    (p) => pathname === p || pathname.startsWith(p)
  )
}

function getAllowedOrigin(): string {
  return process.env.NEXT_PUBLIC_APP_URL || ''
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // /m/* (mobile scan flow) skips all middleware
  if (pathname.startsWith('/m/')) {
    return NextResponse.next()
  }

  // API routes: CORS + CSRF protection
  if (pathname.startsWith('/api/')) {
    const allowedOrigin = getAllowedOrigin()
    const origin = request.headers.get('origin')

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new NextResponse(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': allowedOrigin,
          'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'Access-Control-Max-Age': '86400',
          'Vary': 'Origin',
        },
      })
    }

    const response = NextResponse.next()

    // Generate request ID for tracing
    const requestId = request.headers.get('x-request-id') || crypto.randomUUID()
    response.headers.set('x-request-id', requestId)

    // Add CORS headers to all API responses
    if (allowedOrigin) {
      response.headers.set('Access-Control-Allow-Origin', allowedOrigin)
      response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS')
      response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
      response.headers.set('Vary', 'Origin')
    }

    // CSRF: validate Origin on state-changing methods
    const isStateChanging = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)
    if (isStateChanging && !isCsrfExempt(pathname)) {
      if (origin && allowedOrigin && origin !== allowedOrigin) {
        return NextResponse.json(
          { error: 'CSRF origin mismatch' },
          { status: 403 }
        )
      }
    }

    return response
  }

  // Page routes: session middleware
  return await updateSession(request)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}

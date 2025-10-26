import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
// import { createServerClient } from '@supabase/ssr'

export async function middleware(request: NextRequest) {
  // Middleware temporariamente desabilitado
  // TODO: Implementar verificação de sessão correta quando o problema de cookies for resolvido
  return NextResponse.next()
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/dashboard/:path*',
    '/my-courses/:path*',
    '/settings/:path*'
  ]
}

import { NextRequest, NextResponse } from 'next/server'

const PROTECTED_PATHS = ['/dashboard', '/gate']

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  const isProtected = PROTECTED_PATHS.some((path) =>
    pathname.startsWith(path),
  )

  if (!isProtected) {
    return NextResponse.next()
  }

  // Supabase v2 escribe una cookie "sb-<project-ref>-auth-token" cuando
  // persistSession: true. Si no existe, el usuario claramente no está autenticado.
  // La seguridad real está en RLS; esto solo evita el flash de loading en el cliente.
  const hasSession = request.cookies
    .getAll()
    .some((c) => c.name.startsWith('sb-') && c.name.endsWith('-auth-token'))

  if (!hasSession) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirectTo', pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard/:path*', '/gate/:path*'],
}

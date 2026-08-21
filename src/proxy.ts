import { type NextRequest, NextResponse } from 'next/server'
import { isAdminRole, verifySession } from '@/lib/sessionToken'

const PUBLIC_ROUTES = [
  '/api/auth/login',
  '/api/auth/logout',
  '/api/auth/reset-request',
  '/api/auth/reset-confirm',
  '/api/stats',
  '/auth',
]

const PROTECTED_ROUTES = [
  '/api/usuarios',
  '/api/empresas',
  '/api/motoristas',
  '/api/veiculos',
  '/api/custos',
  '/api/relatorios',
  '/dashboard',
]

/**
 * Barreira rápida de navegação. As APIs repetem a autorização no servidor
 * e revalidam a identidade no banco; o proxy não é a fronteira final.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (PUBLIC_ROUTES.some((route) => pathname.startsWith(route))) {
    return NextResponse.next()
  }

  if (!PROTECTED_ROUTES.some((route) => pathname.startsWith(route))) {
    return NextResponse.next()
  }

  const session = await verifySession(request)
  if (!session) {
    if (pathname.startsWith('/dashboard')) {
      return NextResponse.redirect(new URL('/auth/login', request.url))
    }
    return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })
  }

  if (pathname.startsWith('/dashboard/admin') && !isAdminRole(session.role)) {
    return NextResponse.redirect(new URL('/dashboard/empresa', request.url))
  }

  const rotasSomenteGestor = [
    '/dashboard/empresa/motoristas',
    '/dashboard/empresa/arquivos',
    '/dashboard/empresa/relatorios',
    '/dashboard/empresa/usuarios',
    '/dashboard/empresa/configuracoes',
  ]
  if (
    rotasSomenteGestor.some((rota) => pathname.startsWith(rota)) &&
    session.role !== 'GESTOR_EMPRESA' &&
    session.role !== 'GESTOR'
  ) {
    return NextResponse.redirect(new URL('/dashboard/empresa/frota', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|public).*)'],
}

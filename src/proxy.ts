import { type NextRequest, NextResponse } from 'next/server'
import { isAdminRole, verifySession } from '@/lib/sessionToken'

function createContentSecurityPolicy(nonce: string) {
  const isDevelopment = process.env.NODE_ENV !== 'production'
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "frame-src https://challenges.cloudflare.com",
    "object-src 'none'",
    `script-src 'self' 'nonce-${nonce}' 'wasm-unsafe-eval' https://challenges.cloudflare.com${isDevelopment ? " 'unsafe-eval'" : ''}`,
    "script-src-attr 'none'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    "img-src 'self' data: blob: https://*.supabase.co",
    `connect-src 'self' blob: https://*.supabase.co wss://*.supabase.co https://challenges.cloudflare.com${isDevelopment ? ' ws://localhost:* ws://127.0.0.1:*' : ''}`,
    "media-src 'self' blob:",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    ...(isDevelopment ? [] : ['upgrade-insecure-requests']),
  ].join('; ')
}

function withCsp(response: NextResponse, contentSecurityPolicy: string) {
  response.headers.set('Content-Security-Policy', contentSecurityPolicy)
  return response
}

function developmentOrigins(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') return []
  const port = request.nextUrl.port ? `:${request.nextUrl.port}` : ''
  return [`http://localhost${port}`, `http://127.0.0.1${port}`]
}

const PUBLIC_ROUTES = [
  '/api/auth/login',
  '/api/auth/logout',
  '/api/auth/reset-request',
  '/api/auth/reset-confirm',
  '/api/stats',
  '/auth',
]

const PROTECTED_ROUTES = [
  '/api/auth/change-password',
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
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64')
  const contentSecurityPolicy = createContentSecurityPolicy(nonce)
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-nonce', nonce)
  requestHeaders.set('Content-Security-Policy', contentSecurityPolicy)
  const next = () => withCsp(NextResponse.next({ request: { headers: requestHeaders } }), contentSecurityPolicy)

  if (pathname.startsWith('/api/')) {
    const mutatingMethod = !['GET', 'HEAD', 'OPTIONS'].includes(request.method)
    if (mutatingMethod) {
      const origin = request.headers.get('origin')
      const fetchSite = request.headers.get('sec-fetch-site')
      const allowedOrigins = new Set([
        request.nextUrl.origin,
        process.env.NEXT_PUBLIC_SITE_URL,
        ...developmentOrigins(request),
        ...(process.env.APP_ALLOWED_ORIGINS || '').split(','),
      ].filter((value): value is string => Boolean(value)).map((value) => value.trim().replace(/\/$/, '')))
      if ((origin && !allowedOrigins.has(origin.replace(/\/$/, ''))) || fetchSite === 'cross-site') {
        return withCsp(NextResponse.json({ erro: 'Origem da requisição não permitida.' }, { status: 403 }), contentSecurityPolicy)
      }

      const contentLength = Number(request.headers.get('content-length') || 0)
      const maxBodyBytes = pathname.includes('/foto') ? 8 * 1024 * 1024 : 2 * 1024 * 1024
      if (Number.isFinite(contentLength) && contentLength > maxBodyBytes) {
        return withCsp(NextResponse.json({ erro: 'Corpo da requisição excede o limite permitido.' }, { status: 413 }), contentSecurityPolicy)
      }
    }
  }

  if (PUBLIC_ROUTES.some((route) => pathname.startsWith(route))) {
    return next()
  }

  if (!PROTECTED_ROUTES.some((route) => pathname.startsWith(route))) {
    return next()
  }

  const session = await verifySession(request)
  if (!session) {
    if (pathname.startsWith('/dashboard')) {
      return withCsp(NextResponse.redirect(new URL('/auth/login', request.url)), contentSecurityPolicy)
    }
    return withCsp(NextResponse.json({ erro: 'Não autenticado' }, { status: 401 }), contentSecurityPolicy)
  }

  if (pathname.startsWith('/dashboard/admin') && !isAdminRole(session.role)) {
    return withCsp(NextResponse.redirect(new URL('/dashboard/empresa', request.url)), contentSecurityPolicy)
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
    return withCsp(NextResponse.redirect(new URL('/dashboard/empresa/frota', request.url)), contentSecurityPolicy)
  }

  return next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|public).*)'],
}

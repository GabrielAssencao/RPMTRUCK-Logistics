// src/middleware.ts
// Middleware global para autenticação e proteção de rotas
import { NextRequest, NextResponse } from 'next/server';
import { isAdminRole, verifySession } from '@/lib/auth';

// Rotas públicas que não requerem autenticação
const PUBLIC_ROUTES = [
  '/api/auth/login',
  '/api/auth/logout',
  '/api/auth/reset-request',
  '/api/stats',
  '/auth',
];

// Rotas que requerem autenticação
const PROTECTED_ROUTES = [
  '/api/usuarios',
  '/api/empresas',
  '/api/motoristas',
  '/api/veiculos',
  '/api/custos',
  '/api/relatorios',
  '/dashboard',
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Permite rotas públicas sem verificação
  const isPublicRoute = PUBLIC_ROUTES.some(route => pathname.startsWith(route));
  if (isPublicRoute) {
    return NextResponse.next();
  }

  // 2. Protege rotas que requerem autenticação
  const isProtectedRoute = PROTECTED_ROUTES.some(route => pathname.startsWith(route));
  if (isProtectedRoute) {
    const session = await verifySession(request);

    if (!session) {
      // Se não autenticado, redireciona para login
      if (pathname.startsWith('/dashboard')) {
        return NextResponse.redirect(new URL('/auth/login', request.url));
      }

      // Para API routes, retorna erro 401
      return NextResponse.json(
        { erro: 'Não autenticado' },
        { status: 401 }
      );
    }

    if (pathname.startsWith('/dashboard/admin') && !isAdminRole(session.role)) {
      return NextResponse.redirect(new URL('/dashboard/empresa', request.url));
    }

    const rotasSomenteGestor = [
      '/dashboard/empresa/motoristas',
      '/dashboard/empresa/arquivos',
      '/dashboard/empresa/relatorios',
      '/dashboard/empresa/usuarios',
      '/dashboard/empresa/configuracoes',
    ];
    if (
      rotasSomenteGestor.some((rota) => pathname.startsWith(rota)) &&
      session.role !== 'GESTOR_EMPRESA' &&
      session.role !== 'GESTOR'
    ) {
      return NextResponse.redirect(new URL('/dashboard/empresa/frota', request.url));
    }
  }

  return NextResponse.next();
}

// Configurar quais rotas o middleware deve processar
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|public).*)',
  ],
};

// src/lib/auth.ts
// Módulo de autenticação segura com JWT e HttpOnly Cookies
import { jwtVerify, SignJWT } from 'jose';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'dev-secret-key-change-in-production'
);

export type AppRole =
  | 'ADMIN_RPM'
  | 'GESTOR_EMPRESA'
  | 'OPERADOR'
  | 'VISUALIZADOR'
  | 'ADMIN'
  | 'GESTOR';

export interface SessionPayload {
  userId: string;
  email: string;
  role: AppRole;
  empresaId?: string;
  iat: number;
  exp: number;
}

export function isAdminRole(role?: string | null) {
  return role === 'ADMIN_RPM' || role === 'ADMIN';
}

export function normalizeRole(role?: string | null): AppRole | undefined {
  if (!role) return undefined;
  if (role === 'ADMIN') return 'ADMIN';
  if (role === 'GESTOR') return 'GESTOR';
  if (role === 'ADMIN_RPM') return 'ADMIN_RPM';
  if (role === 'GESTOR_EMPRESA') return 'GESTOR_EMPRESA';
  if (role === 'OPERADOR') return 'OPERADOR';
  if (role === 'VISUALIZADOR') return 'VISUALIZADOR';
  return role as AppRole;
}

/**
 * Cria um JWT assinado e o salva em HttpOnly Cookie
 */
export async function createSession(payload: Omit<SessionPayload, 'iat' | 'exp'>) {
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 horas

  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .sign(SECRET);

  const cookieStore = cookies();
  cookieStore.set('rpmtruck_session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 24 * 60 * 60, // 24 horas
    path: '/',
  });

  return token;
}

/**
 * Valida o JWT do cookie HttpOnly
 */
export async function verifySession(request: NextRequest): Promise<SessionPayload | null> {
  const token = request.cookies.get('rpmtruck_session')?.value;

  if (!token) return null;

  try {
    const verified = await jwtVerify(token, SECRET);
    const payload = verified.payload;
    if (
      typeof payload.userId !== 'string' ||
      typeof payload.email !== 'string' ||
      typeof payload.role !== 'string' ||
      typeof payload.iat !== 'number' ||
      typeof payload.exp !== 'number'
    ) {
      return null;
    }
    return {
      userId: payload.userId,
      email: payload.email,
      role: normalizeRole(payload.role)!,
      empresaId: typeof payload.empresaId === 'string' ? payload.empresaId : undefined,
      iat: payload.iat,
      exp: payload.exp,
    };
  } catch (error) {
    console.error('Token verification failed:', error);
    return null;
  }
}

/**
 * Middleware para proteger rotas da API
 * Verifica se o usuário está autenticado e tem permissão
 */
export async function requireAuth(request: NextRequest) {
  const session = await verifySession(request);

  if (!session) {
    return {
      error: 'Não autenticado',
      status: 401,
      session: null,
    };
  }

  return {
    error: null,
    status: 200,
    session,
  };
}

/**
 * Middleware para verificar se é Admin
 */
export async function requireAdminAuth(request: NextRequest) {
  const { session, error, status } = await requireAuth(request);

  if (error) {
    return { error, status, session: null };
  }

  if (!isAdminRole(session?.role)) {
    return {
      error: 'Acesso negado: apenas administradores',
      status: 403,
      session: null,
    };
  }

  return {
    error: null,
    status: 200,
    session,
  };
}

/**
 * Limpa a sessão (logout)
 */
export async function clearSession() {
  const cookieStore = cookies();
  cookieStore.delete('rpmtruck_session');
}

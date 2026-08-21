import { SignJWT } from 'jose'
import { cookies } from 'next/headers'
import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  getJwtSecret,
  isAdminRole,
  SESSION_COOKIE_NAME,
  verifySession,
  type AppRole,
  type SessionPayload,
} from '@/lib/sessionToken'

export {
  isAdminRole,
  normalizeRole,
  verifySession,
  type AppRole,
  type SessionPayload,
} from '@/lib/sessionToken'

type SessionInput = Omit<SessionPayload, 'iat' | 'exp'>

export async function createSession(payload: SessionInput) {
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)
  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .sign(getJwtSecret())

  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 24 * 60 * 60,
    path: '/',
  })

  return token
}

export interface AuthResult {
  error: string | null
  status: number
  session: SessionPayload | null
}

const requestAuthCache = new WeakMap<NextRequest, Promise<AuthResult>>()

async function validarSessaoAtual(request: NextRequest): Promise<AuthResult> {
  const tokenSession = await verifySession(request)
  if (!tokenSession) {
    return { error: 'Não autenticado', status: 401, session: null }
  }

  const usuario = await prisma.usuario.findUnique({
    where: { id: tokenSession.userId },
    select: {
      id: true,
      email: true,
      role: true,
      empresaId: true,
      sessaoVersao: true,
    },
  })

  if (
    !usuario ||
    usuario.email !== tokenSession.email ||
    usuario.role !== tokenSession.role ||
    (usuario.empresaId ?? undefined) !== tokenSession.empresaId ||
    usuario.sessaoVersao !== tokenSession.sessionVersion
  ) {
    return { error: 'Sessão expirada ou revogada', status: 401, session: null }
  }

  return {
    error: null,
    status: 200,
    session: {
      ...tokenSession,
      email: usuario.email,
      role: usuario.role as AppRole,
      empresaId: usuario.empresaId ?? undefined,
      sessionVersion: usuario.sessaoVersao,
    },
  }
}

/**
 * Revalida a identidade e as permissões atuais no banco.
 * O JWT comprova a assinatura; o banco continua sendo a fonte de autoridade.
 */
export function requireAuth(request: NextRequest): Promise<AuthResult> {
  const cached = requestAuthCache.get(request)
  if (cached) return cached

  const result = validarSessaoAtual(request)
  requestAuthCache.set(request, result)
  return result
}

export async function requireAdminAuth(request: NextRequest): Promise<AuthResult> {
  const auth = await requireAuth(request)
  if (auth.error || !auth.session) return auth

  if (!isAdminRole(auth.session.role)) {
    return {
      error: 'Acesso negado: apenas administradores',
      status: 403,
      session: null,
    }
  }

  return auth
}

export async function clearSession() {
  const cookieStore = await cookies()
  cookieStore.delete(SESSION_COOKIE_NAME)
}

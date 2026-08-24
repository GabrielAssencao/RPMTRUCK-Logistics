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
const SESSION_DURATION_MS = 24 * 60 * 60 * 1000
const activityWrites = new Map<string, number>()

export async function createSession(payload: SessionInput, expiresAt = new Date(Date.now() + SESSION_DURATION_MS)) {
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
    priority: 'high',
    maxAge: 24 * 60 * 60,
    expires: expiresAt,
    path: '/',
  })

  return token
}

export interface AuthResult {
  error: string | null
  status: number
  session: SessionPayload | null
  usuario?: {
    id: string
    nome: string
    email: string
    role: AppRole
    empresaId: string | null
    acessoDashboardGeral: boolean
    sessaoVersao: number
  }
}

const requestAuthCache = new WeakMap<NextRequest, Promise<AuthResult>>()

async function validarSessaoAtual(request: NextRequest): Promise<AuthResult> {
  const tokenSession = await verifySession(request)
  if (!tokenSession) {
    return { error: 'Não autenticado', status: 401, session: null }
  }

  const usuarioSelect = {
    id: true,
    nome: true,
    email: true,
    role: true,
    empresaId: true,
    acessoDashboardGeral: true,
    sessaoVersao: true,
  } as const
  const usuario = tokenSession.sessionId
    ? (await prisma.sessaoUsuario.findFirst({
        where: {
          id: tokenSession.sessionId,
          usuarioId: tokenSession.userId,
          revogadaEm: null,
          expiraEm: { gt: new Date() },
        },
        select: { usuario: { select: usuarioSelect } },
      }))?.usuario
    : await prisma.usuario.findUnique({ where: { id: tokenSession.userId }, select: usuarioSelect })

  if (
    !usuario ||
    usuario.email !== tokenSession.email ||
    usuario.role !== tokenSession.role ||
    (usuario.empresaId ?? undefined) !== tokenSession.empresaId ||
    usuario.sessaoVersao !== tokenSession.sessionVersion
  ) {
    return { error: 'Sessão expirada ou revogada', status: 401, session: null }
  }

  if (tokenSession.sessionId) {
    const agora = Date.now()
    const ultimaEscrita = activityWrites.get(tokenSession.sessionId) || 0
    if (agora - ultimaEscrita >= 5 * 60 * 1000) {
      await prisma.sessaoUsuario.updateMany({
        where: {
          id: tokenSession.sessionId,
          ultimaAtividade: { lt: new Date(agora - 5 * 60 * 1000) },
          revogadaEm: null,
        },
        data: { ultimaAtividade: new Date(agora) },
      })
      if (activityWrites.size > 5_000) activityWrites.clear()
      activityWrites.set(tokenSession.sessionId, agora)
    }
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
    usuario: {
      ...usuario,
      role: usuario.role as AppRole,
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

export async function clearSession(request?: NextRequest) {
  if (request) {
    const session = await verifySession(request)
    if (session?.sessionId) {
      await prisma.sessaoUsuario.updateMany({
        where: { id: session.sessionId, usuarioId: session.userId, revogadaEm: null },
        data: { revogadaEm: new Date() },
      })
    }
  }
  const cookieStore = await cookies()
  cookieStore.delete(SESSION_COOKIE_NAME)
}

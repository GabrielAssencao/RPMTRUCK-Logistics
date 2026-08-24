import { jwtVerify } from 'jose'
import type { NextRequest } from 'next/server'

export const SESSION_COOKIE_NAME = 'rpmtruck_session'

export type AppRole =
  | 'ADMIN_RPM'
  | 'GESTOR_EMPRESA'
  | 'OPERADOR'
  | 'VISUALIZADOR'
  | 'ADMIN'
  | 'GESTOR'

export interface SessionPayload {
  sessionId?: string
  userId: string
  email: string
  role: AppRole
  empresaId?: string
  sessionVersion: number
  iat: number
  exp: number
}

let encodedSecret: Uint8Array | undefined

export function getJwtSecret() {
  if (encodedSecret) return encodedSecret

  const secret = process.env.JWT_SECRET
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET deve possuir pelo menos 32 caracteres aleatórios.')
  }

  encodedSecret = new TextEncoder().encode(secret)
  return encodedSecret
}

export function isAdminRole(role?: string | null) {
  return role === 'ADMIN_RPM' || role === 'ADMIN'
}

export function normalizeRole(role?: string | null): AppRole | undefined {
  switch (role) {
    case 'ADMIN':
    case 'GESTOR':
    case 'ADMIN_RPM':
    case 'GESTOR_EMPRESA':
    case 'OPERADOR':
    case 'VISUALIZADOR':
      return role
    default:
      return undefined
  }
}

/**
 * Verificação criptográfica leve, adequada ao middleware Edge.
 * A revalidação no banco acontece em requireAuth dentro das APIs.
 */
export async function verifySession(request: NextRequest): Promise<SessionPayload | null> {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value
  if (!token) return null

  try {
    const verified = await jwtVerify(token, getJwtSecret(), { algorithms: ['HS256'] })
    const payload = verified.payload
    const role = normalizeRole(typeof payload.role === 'string' ? payload.role : undefined)

    if (
      typeof payload.userId !== 'string' ||
      typeof payload.email !== 'string' ||
      !role ||
      !Number.isInteger(payload.sessionVersion) ||
      typeof payload.iat !== 'number' ||
      typeof payload.exp !== 'number'
    ) {
      return null
    }

    return {
      sessionId: typeof payload.sessionId === 'string' ? payload.sessionId : undefined,
      userId: payload.userId,
      email: payload.email,
      role,
      empresaId: typeof payload.empresaId === 'string' ? payload.empresaId : undefined,
      sessionVersion: payload.sessionVersion as number,
      iat: payload.iat,
      exp: payload.exp,
    }
  } catch {
    return null
  }
}

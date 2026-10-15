import 'server-only'
import { createHash, randomBytes } from 'node:crypto'
import type { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getClientIp } from '@/lib/rateLimit'
import { pseudonymize, safeUserAgent } from '@/lib/securityEvents'

export const TRUSTED_DEVICE_COOKIE = 'rpmtruck_trusted_device'
export const TRUSTED_DEVICE_DAYS = 7
export const TRUSTED_DEVICE_LOGINS = 10

function hash(value: string) { return createHash('sha256').update(value).digest('hex') }
function userAgentHash(request: NextRequest) { return hash(safeUserAgent(request) || 'unknown') }

export async function consumirDispositivoConfiavel(request: NextRequest, usuarioId: string) {
  const token = request.cookies.get(TRUSTED_DEVICE_COOKIE)?.value
  if (!token) return false
  const agora = new Date()
  const atualizado = await prisma.dispositivoConfiavel.updateMany({
    where: {
      usuarioId,
      tokenHash: hash(token),
      userAgentHash: userAgentHash(request),
      ipHash: pseudonymize(getClientIp(request)),
      revogadoEm: null,
      expiraEm: { gt: agora },
      acessosRestantes: { gt: 0 },
    },
    data: { acessosRestantes: { decrement: 1 }, ultimoAcessoEm: agora },
  })
  return atualizado.count === 1
}

export async function registrarDispositivoConfiavel(request: NextRequest, response: NextResponse, usuarioId: string) {
  const token = randomBytes(32).toString('base64url')
  const expiraEm = new Date(Date.now() + TRUSTED_DEVICE_DAYS * 24 * 60 * 60 * 1000)
  await prisma.dispositivoConfiavel.create({
    data: {
      usuarioId,
      tokenHash: hash(token),
      userAgentHash: userAgentHash(request),
      ipHash: pseudonymize(getClientIp(request)),
      acessosRestantes: TRUSTED_DEVICE_LOGINS,
      expiraEm,
    },
  })
  response.cookies.set(TRUSTED_DEVICE_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    priority: 'high',
    expires: expiraEm,
    path: '/',
  })
}

export async function revogarDispositivosConfiaveis(usuarioId: string) {
  await prisma.dispositivoConfiavel.updateMany({
    where: { usuarioId, revogadoEm: null },
    data: { revogadoEm: new Date() },
  })
}

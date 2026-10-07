import 'server-only'
import { createHash, randomBytes } from 'node:crypto'
import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { encryptSensitive, decryptSensitive, encryptionConfigured } from '@/lib/fieldEncryption'
import { getJwtSecret } from '@/lib/sessionToken'
import { novoSegredoTotp } from '@/lib/totp'

export const MFA_COOKIE = 'rpmtruck_mfa_challenge'
export function hashMfa(value: string) { return createHash('sha256').update(value).digest('hex') }
export function hashRecuperacao(usuarioId: string, code: string) { return hashMfa(`${usuarioId}:${code.toUpperCase().replace(/\s|-/g, '')}`) }

export async function iniciarDesafioMfa(usuarioId: string, email: string, versao: number, obrigatorio = false) {
  if (!encryptionConfigured()) throw new Error('MFA requires data encryption configuration')
  const nonce = randomBytes(32).toString('hex')
  const expires = new Date(Date.now() + 5 * 60000)
  const state = await prisma.mfaAdmin.upsert({
    where: { usuarioId },
    create: { usuarioId, segredo: encryptSensitive(novoSegredoTotp(), usuarioId, 'mfa.segredo')!, desafioHash: hashMfa(nonce), desafioExpiraEm: expires, obrigatorio },
    update: { desafioHash: hashMfa(nonce), desafioExpiraEm: expires, ...(obrigatorio ? { obrigatorio: true } : {}) },
  })
  const token = await new SignJWT({ userId: usuarioId, version: versao, nonce })
    .setProtectedHeader({ alg: 'HS256' }).setAudience('rpmtruck-admin-mfa').setIssuedAt().setExpirationTime(expires).sign(getJwtSecret())
  ;(await cookies()).set(MFA_COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', path: '/api/auth/mfa', maxAge: 300 })
  const secret = !state.ativadoEm ? decryptSensitive(state.segredo, usuarioId, 'mfa.segredo')! : undefined
  return {
    mfaObrigatorio: true, configurar: !state.ativadoEm,
    segredo: secret,
    otpauth: secret ? `otpauth://totp/${encodeURIComponent(`RPM Truck:${email}`)}?secret=${secret}&issuer=RPM%20Truck&algorithm=SHA1&digits=6&period=30` : undefined,
  }
}

export async function lerDesafioMfa(request: NextRequest) {
  try {
    const token = request.cookies.get(MFA_COOKIE)?.value
    if (!token) return null
    const { payload } = await jwtVerify(token, getJwtSecret(), { algorithms: ['HS256'], audience: 'rpmtruck-admin-mfa' })
    if (typeof payload.userId !== 'string' || typeof payload.nonce !== 'string' || !Number.isInteger(payload.version)) return null
    return { usuarioId: payload.userId, hash: hashMfa(payload.nonce), versao: payload.version as number }
  } catch { return null }
}

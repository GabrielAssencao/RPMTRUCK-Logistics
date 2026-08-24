import 'server-only'
import { createHmac } from 'node:crypto'
import type { EventoSegurancaTipo, Prisma } from '@prisma/client'
import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'

function secret() {
  const value = process.env.RATE_LIMIT_HASH_SECRET || process.env.JWT_SECRET
  if (!value || value.length < 32) throw new Error('Segredo de pseudonimização não configurado.')
  return value
}

export function pseudonymize(value?: string | null) {
  if (!value) return null
  return createHmac('sha256', secret()).update(value.trim().toLowerCase()).digest('hex')
}

export function safeUserAgent(request: NextRequest) {
  return request.headers.get('user-agent')?.replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 300) || null
}

export async function recordSecurityEvent({
  tipo,
  request,
  usuarioId,
  empresaId,
  email,
  ip,
  contexto,
}: {
  tipo: EventoSegurancaTipo
  request: NextRequest
  usuarioId?: string | null
  empresaId?: string | null
  email?: string | null
  ip?: string | null
  contexto?: Prisma.InputJsonObject
}) {
  try {
    await prisma.eventoSeguranca.create({
      data: {
        tipo,
        usuarioId: usuarioId || null,
        empresaId: empresaId || null,
        emailHash: pseudonymize(email),
        ipHash: pseudonymize(ip),
        userAgent: safeUserAgent(request),
        contexto,
      },
    })
  } catch (error) {
    console.error('Falha ao registrar evento de segurança:', error)
  }
}

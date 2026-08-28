import { createHmac } from 'node:crypto'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { recordSecurityEvent } from '@/lib/securityEvents'

interface RateLimitResult {
  permitido: boolean
  restante: number
  tentar_novamente: number
  expira_em: Date
}

function obterSegredoRateLimit() {
  const segredo = process.env.RATE_LIMIT_HASH_SECRET || process.env.JWT_SECRET
  if (!segredo || segredo.length < 32) {
    throw new Error('RATE_LIMIT_HASH_SECRET ou JWT_SECRET deve possuir pelo menos 32 caracteres.')
  }
  return segredo
}

function hashIdentificador(identifier: string) {
  return createHmac('sha256', obterSegredoRateLimit())
    .update(identifier.trim().toLocaleLowerCase('en-US'))
    .digest('hex')
}

/**
 * Consome uma tentativa em uma janela persistida no PostgreSQL.
 * O UPSERT da função SQL é atômico entre processos e instâncias do servidor.
 */
export async function rateLimit(
  identifier: string,
  limit = 5,
  windowMs = 60 * 1000,
) {
  if (!Number.isInteger(limit) || limit < 1 || !Number.isInteger(windowMs) || windowMs < 1000) {
    throw new Error('Configuração de rate limit inválida.')
  }

  const [resultado] = await prisma.$queryRaw<RateLimitResult[]>`
    SELECT permitido, restante, tentar_novamente, expira_em
    FROM public.consumir_rate_limit(
      ${hashIdentificador(identifier)},
      ${limit}::integer,
      ${windowMs}::integer
    )
  `

  if (!resultado) throw new Error('O PostgreSQL não retornou o resultado do rate limit.')
  return resultado
}

/**
 * Falha de forma fechada: se o limitador estiver indisponível, a operação protegida
 * não prossegue sem controle.
 */
export async function applyRateLimit(
  _request: NextRequest,
  identifier: string,
  limit = 5,
  windowMs = 60 * 1000,
) {
  try {
    const result = await rateLimit(identifier, limit, windowMs)

    if (!result.permitido) {
      // Registra somente o primeiro bloqueio aproximado da janela para o próprio
      // log não virar vetor de consumo de banco durante um ataque automatizado.
      if (result.tentar_novamente >= Math.ceil(windowMs / 1000) - 5) {
        await recordSecurityEvent({
          tipo: 'RATE_LIMIT',
          request: _request,
          ip: getClientIp(_request),
          contexto: { categoria: identifier.split(':', 1)[0] || 'unknown' },
        })
      }
      return NextResponse.json(
        {
          erro: 'Muitas requisições. Tente novamente mais tarde.',
          retryAfter: result.tentar_novamente,
        },
        {
          status: 429,
          headers: {
            'Retry-After': result.tentar_novamente.toString(),
            'X-RateLimit-Limit': limit.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': result.expira_em.toISOString(),
            'Cache-Control': 'no-store',
          },
        },
      )
    }

    return null
  } catch (error) {
    console.error('Rate limit persistente indisponível:', error)
    return NextResponse.json(
      { erro: 'Proteção de acesso temporariamente indisponível. Tente novamente.' },
      { status: 503, headers: { 'Retry-After': '30', 'Cache-Control': 'no-store' } },
    )
  }
}

/** Extrai o endereço informado pelo proxy de borda. */
export function getClientIp(request: NextRequest): string {
  const cloudflareIp = request.headers.get('cf-connecting-ip')
  const forwardedFor = request.headers.get('x-forwarded-for')
  const realIp = request.headers.get('x-real-ip')

  const ip = cloudflareIp || forwardedFor?.split(',')[0] || realIp
  if (ip) return ip.trim().slice(0, 64)
  return 'unknown'
}

export const RATE_LIMITS = {
  // O IP recebe uma margem maior para não punir empresas atrás do mesmo NAT.
  LOGIN_IP: { limit: 20, windowMs: 15 * 60 * 1000 },
  LOGIN_ACCOUNT: { limit: 5, windowMs: 15 * 60 * 1000 },
  PUBLIC_SIGNUP: { limit: 3, windowMs: 60 * 60 * 1000 },
  PASSWORD_RESET_IP: { limit: 8, windowMs: 60 * 60 * 1000 },
  PASSWORD_RESET_ACCOUNT: { limit: 3, windowMs: 60 * 60 * 1000 },
  OPERATOR_PASSWORD_RESET: { limit: 6, windowMs: 60 * 60 * 1000 },
  REPORT_GENERATE: { limit: 5, windowMs: 60 * 60 * 1000 },
  REPORT_READ: { limit: 30, windowMs: 60 * 1000 },
  REPORT_DOWNLOAD: { limit: 20, windowMs: 60 * 1000 },
  REPORT_MUTATION: { limit: 10, windowMs: 60 * 60 * 1000 },
  NOTIFICATION_READ: { limit: 60, windowMs: 60 * 1000 },
  NOTIFICATION_MUTATION: { limit: 30, windowMs: 60 * 1000 },
  NOTIFICATION_SEND: { limit: 10, windowMs: 60 * 60 * 1000 },
  FILE_UPLOAD: { limit: 10, windowMs: 60 * 60 * 1000 },
  BULK_MUTATION: { limit: 12, windowMs: 60 * 1000 },
  ADMIN_READ: { limit: 60, windowMs: 60 * 1000 },
  ADMIN_MUTATION: { limit: 20, windowMs: 60 * 1000 },
  SUBSCRIPTION_REQUEST: { limit: 6, windowMs: 60 * 60 * 1000 },
  PUBLIC_STATS: { limit: 60, windowMs: 60 * 1000 },
} as const

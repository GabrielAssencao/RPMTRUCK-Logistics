import { createHmac } from 'node:crypto'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

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
  const forwardedFor = request.headers.get('x-forwarded-for')
  const realIp = request.headers.get('x-real-ip')

  if (forwardedFor) return forwardedFor.split(',')[0].trim()
  if (realIp) return realIp.trim()
  return 'unknown'
}

export const RATE_LIMITS = {
  LOGIN: { limit: 5, windowMs: 15 * 60 * 1000 },
  SIGNUP: { limit: 3, windowMs: 60 * 60 * 1000 },
  PASSWORD_RESET: { limit: 3, windowMs: 60 * 60 * 1000 },
  API_GENERAL: { limit: 100, windowMs: 60 * 1000 },
} as const

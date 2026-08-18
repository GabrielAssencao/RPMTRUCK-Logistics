// src/lib/rateLimit.ts
// Rate limiting para proteção contra força bruta
import { NextRequest, NextResponse } from 'next/server';

interface RateLimitStore {
  [key: string]: { count: number; resetTime: number };
}

const store: RateLimitStore = {};

/**
 * Rate limiter baseado em IP/Identificador
 * @param identifier - IP do cliente ou email (para login)
 * @param limit - Número máximo de requisições
 * @param windowMs - Janela de tempo em milissegundos
 */
export function rateLimit(
  identifier: string,
  limit: number = 5,
  windowMs: number = 60 * 1000 // 1 minuto por padrão
): { allowed: boolean; remaining: number; retryAfter: number } {
  const now = Date.now();
  const key = identifier;

  if (!store[key] || store[key].resetTime < now) {
    store[key] = { count: 0, resetTime: now + windowMs };
  }

  const record = store[key];
  const remaining = Math.max(0, limit - record.count - 1);
  const retryAfter = Math.ceil((record.resetTime - now) / 1000);

  if (record.count >= limit) {
    return { allowed: false, remaining, retryAfter };
  }

  record.count++;
  return { allowed: true, remaining, retryAfter };
}

/**
 * Middleware para aplicar rate limiting em requisições
 */
export function applyRateLimit(
  request: NextRequest,
  identifier: string,
  limit: number = 5,
  windowMs: number = 60 * 1000
) {
  const result = rateLimit(identifier, limit, windowMs);

  if (!result.allowed) {
    return NextResponse.json(
      {
        erro: 'Muitas requisições. Tente novamente mais tarde.',
        retryAfter: result.retryAfter,
      },
      {
        status: 429,
        headers: {
          'Retry-After': result.retryAfter.toString(),
          'X-RateLimit-Limit': limit.toString(),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': new Date(Date.now() + result.retryAfter * 1000).toISOString(),
        },
      }
    );
  }

  return null; // Continua normalmente
}

/**
 * Extrai IP real do cliente (funciona atrás de proxies)
 */
export function getClientIp(request: NextRequest): string {
  const forwardedFor = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');

  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }

  if (realIp) {
    return realIp;
  }

  return request.ip || '127.0.0.1';
}

/**
 * Presets comuns de rate limiting
 */
export const RATE_LIMITS = {
  LOGIN: { limit: 5, windowMs: 15 * 60 * 1000 }, // 5 tentativas em 15 min
  SIGNUP: { limit: 3, windowMs: 60 * 60 * 1000 }, // 3 signups em 1 hora
  PASSWORD_RESET: { limit: 3, windowMs: 60 * 60 * 1000 }, // 3 resets em 1 hora
  API_GENERAL: { limit: 100, windowMs: 60 * 1000 }, // 100 requisições em 1 min
};

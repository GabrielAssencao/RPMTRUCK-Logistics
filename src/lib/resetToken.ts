import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'

export const RESET_TOKEN_TTL_MS = 30 * 60 * 1000

export function gerarTokenReset() {
  return `RPM-${randomBytes(18).toString('base64url')}`
}

export function hashTokenReset(token: string) {
  return createHash('sha256').update(token.trim(), 'utf8').digest('hex')
}

export function tokenResetConfere(token: string, hashEsperado: string) {
  const recebido = Buffer.from(hashTokenReset(token), 'hex')
  const esperado = Buffer.from(hashEsperado, 'hex')
  return recebido.length === esperado.length && timingSafeEqual(recebido, esperado)
}

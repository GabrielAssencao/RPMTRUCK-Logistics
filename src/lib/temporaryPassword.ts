import 'server-only'

import { randomBytes } from 'node:crypto'

export const TEMPORARY_PASSWORD_TTL_MS = 72 * 60 * 60 * 1000

/** Garante todos os grupos exigidos pela política e adiciona entropia criptográfica. */
export function gerarSenhaTemporaria() {
  return `Rpm@7-${randomBytes(9).toString('base64url')}`
}

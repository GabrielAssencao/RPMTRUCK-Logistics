import 'server-only'

import { randomUUID } from 'node:crypto'
import { jwtVerify, SignJWT } from 'jose'
import { getJwtSecret } from '@/lib/sessionToken'

const ISSUER = 'rpmtruck'
const AUDIENCE = 'empresa-account-deletion'

export async function criarTokenBackupEmpresa(usuarioId: string, empresaId: string) {
  return new SignJWT({ empresaId, finalidade: 'BACKUP_EXCLUSAO' })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setSubject(usuarioId)
    .setJti(randomUUID())
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(getJwtSecret())
}

export async function validarTokenBackupEmpresa(token: string, usuarioId: string, empresaId: string) {
  try {
    const resultado = await jwtVerify(token, getJwtSecret(), {
      algorithms: ['HS256'],
      issuer: ISSUER,
      audience: AUDIENCE,
      subject: usuarioId,
    })
    return resultado.payload.empresaId === empresaId
      && resultado.payload.finalidade === 'BACKUP_EXCLUSAO'
      && typeof resultado.payload.jti === 'string'
  } catch {
    return false
  }
}

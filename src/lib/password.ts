import 'server-only'
import bcrypt from 'bcrypt'

const PASSWORD_COST = 12
const DUMMY_PASSWORD_HASH = '$2b$12$7DmxzHn9jfq.ljU/0ksii.o02xTX7LFFkre/3B8Kv6mf2CX0fK11i'

export function hashPassword(password: string) {
  return bcrypt.hash(password, PASSWORD_COST)
}

export function verifyPassword(password: string, passwordHash: string) {
  return bcrypt.compare(password, passwordHash)
}

/** Mantém o custo de bcrypt no login mesmo quando a conta não existe. */
export function verifyLoginPassword(password: string, passwordHash?: string) {
  return bcrypt.compare(password, passwordHash ?? DUMMY_PASSWORD_HASH)
}

export function passwordNeedsRehash(passwordHash: string) {
  try {
    return bcrypt.getRounds(passwordHash) < PASSWORD_COST
  } catch {
    return true
  }
}

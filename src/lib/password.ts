import 'server-only'
import bcrypt from 'bcrypt'

const PASSWORD_COST = 12

export function hashPassword(password: string) {
  return bcrypt.hash(password, PASSWORD_COST)
}

export function verifyPassword(password: string, passwordHash: string) {
  return bcrypt.compare(password, passwordHash)
}

export function passwordNeedsRehash(passwordHash: string) {
  try {
    return bcrypt.getRounds(passwordHash) < PASSWORD_COST
  } catch {
    return true
  }
}

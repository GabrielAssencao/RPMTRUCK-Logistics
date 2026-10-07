import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
export function novoSegredoTotp() {
  const bytes = randomBytes(20)
  let bits = 0, value = 0, result = ''
  for (const byte of bytes) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 5) { result += alphabet[(value >>> (bits - 5)) & 31]; bits -= 5 }
  }
  return result
}

function decodeBase32(secret: string) {
  if (!/^[A-Z2-7]{32}$/.test(secret)) throw new Error('Invalid TOTP secret')
  let bits = 0, value = 0
  const bytes: number[] = []
  for (const char of secret) {
    value = (value << 5) | alphabet.indexOf(char)
    bits += 5
    if (bits >= 8) { bytes.push((value >>> (bits - 8)) & 255); bits -= 8 }
  }
  return Buffer.from(bytes)
}

// RFC 6238 / RFC 4226: SHA-1, 30 seconds, 6 digits; crypto primitives are Node's.
export function codigoTotp(secret: string, counter: number, digits = 6) {
  const moving = Buffer.alloc(8)
  moving.writeBigUInt64BE(BigInt(counter))
  const hash = createHmac('sha1', decodeBase32(secret)).update(moving).digest()
  const offset = hash[hash.length - 1] & 15
  return ((hash.readUInt32BE(offset) & 0x7fffffff) % (10 ** digits)).toString().padStart(digits, '0')
}

export function verificarTotp(secret: string, code: string, lastCounter: number, now = Date.now()) {
  if (!/^\d{6}$/.test(code)) return null
  const current = Math.floor(now / 30000)
  for (const counter of [current, current - 1, current + 1]) {
    if (counter <= lastCounter || counter < 0) continue
    if (timingSafeEqual(Buffer.from(code), Buffer.from(codigoTotp(secret, counter)))) return counter
  }
  return null
}

import { createCipheriv, createDecipheriv, createHmac, hkdfSync, randomBytes } from 'node:crypto'

const ENCRYPTED_PREFIX = 'enc'
const VERSION_PATTERN = /^v([1-9]\d{0,8})$/

export function parseEncryptionVersion(value, fallback) {
  const candidate = value || fallback
  const match = candidate?.match(VERSION_PATTERN)
  if (!match) {
    throw new Error('Versão de criptografia inválida. Use o formato vN, por exemplo v3.')
  }
  return candidate
}

export function encryptionVersionNumber(version) {
  return Number(parseEncryptionVersion(version).slice(1))
}

export function assertSequentialRotation(previousVersion, activeVersion) {
  const previousNumber = encryptionVersionNumber(previousVersion)
  const activeNumber = encryptionVersionNumber(activeVersion)
  if (activeNumber !== previousNumber + 1) {
    throw new Error(`A rotação deve ser sequencial: ${previousVersion} só pode avançar para v${previousNumber + 1}.`)
  }
}

export function decodeEncryptionKey(value, name) {
  const normalized = value?.trim() || ''
  const key = Buffer.from(normalized, 'base64')
  if (key.length !== 32 || key.toString('base64') !== normalized) {
    throw new Error(`${name} deve conter exatamente 32 bytes em Base64 válido.`)
  }
  return key
}

export function encryptedValueVersion(value) {
  if (!value?.startsWith(`${ENCRYPTED_PREFIX}:`)) return null
  return parseEncryptionVersion(value.split(':', 3)[1])
}

function derivedKey(master, tenantId, field, version) {
  return Buffer.from(
    hkdfSync('sha256', master, Buffer.from(tenantId), Buffer.from(`rpmtruck:${field}:${version}`), 32),
  )
}

function additionalAuthenticatedData(tenantId, field, version) {
  return Buffer.from(`rpmtruck:${tenantId}:${field}:${version}`)
}

export function encryptWithKey(plaintext, key, tenantId, field, version) {
  const parsedVersion = parseEncryptionVersion(version)
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', derivedKey(key, tenantId, field, parsedVersion), iv)
  cipher.setAAD(additionalAuthenticatedData(tenantId, field, parsedVersion))
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  return [
    ENCRYPTED_PREFIX,
    parsedVersion,
    iv.toString('base64url'),
    cipher.getAuthTag().toString('base64url'),
    ciphertext.toString('base64url'),
  ].join(':')
}

export function decryptWithKey(value, key, tenantId, field) {
  const version = encryptedValueVersion(value)
  if (!version) return value

  const parts = value.split(':')
  if (parts.length !== 5) throw new Error('Formato de dado criptografado inválido.')

  const decipher = createDecipheriv(
    'aes-256-gcm',
    derivedKey(key, tenantId, field, version),
    Buffer.from(parts[2], 'base64url'),
  )
  decipher.setAAD(additionalAuthenticatedData(tenantId, field, version))
  decipher.setAuthTag(Buffer.from(parts[3], 'base64url'))
  return Buffer.concat([
    decipher.update(Buffer.from(parts[4], 'base64url')),
    decipher.final(),
  ]).toString('utf8')
}

export function blindIndexWithKey(key, value, tenantId, field) {
  if (!value) return null
  const normalized = value.normalize('NFKC').trim().toLowerCase().replace(/[^a-z0-9]/g, '')
  return createHmac('sha256', key).update(`${tenantId}:${field}:${normalized}`).digest('hex')
}

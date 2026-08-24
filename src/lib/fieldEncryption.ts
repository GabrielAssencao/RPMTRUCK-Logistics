import 'server-only'
import { createCipheriv, createDecipheriv, createHmac, hkdfSync, randomBytes } from 'node:crypto'

type EncryptionVersion = 'v1' | 'v2'
type KeyEnvironmentName =
  | 'DATA_ENCRYPTION_MASTER_KEY'
  | 'DATA_BLIND_INDEX_KEY'
  | 'DATA_ENCRYPTION_PREVIOUS_MASTER_KEY'
  | 'DATA_BLIND_INDEX_PREVIOUS_KEY'

const ENCRYPTED_PREFIX = 'enc'
const SUPPORTED_VERSIONS = new Set<EncryptionVersion>(['v1', 'v2'])

function parseVersion(value: string | undefined, fallback?: EncryptionVersion) {
  if (!value && fallback) return fallback
  if (!value || !SUPPORTED_VERSIONS.has(value as EncryptionVersion)) {
    throw new Error('Versão de criptografia inválida. Use v1 ou v2.')
  }
  return value as EncryptionVersion
}

function activeVersion() {
  return parseVersion(process.env.DATA_ENCRYPTION_ACTIVE_VERSION, 'v1')
}

function previousVersion() {
  const value = process.env.DATA_ENCRYPTION_PREVIOUS_VERSION
  return value ? parseVersion(value) : null
}

function decodeKey(name: KeyEnvironmentName) {
  const value = process.env[name]
  if (!value) return null
  const normalized = value.trim()
  const key = Buffer.from(normalized, 'base64')
  if (key.length !== 32 || key.toString('base64') !== normalized) {
    throw new Error(`${name} deve ser uma chave Base64 válida de 32 bytes.`)
  }
  return key
}

function masterKeyFor(version: EncryptionVersion) {
  if (version === activeVersion()) return decodeKey('DATA_ENCRYPTION_MASTER_KEY')
  if (version === previousVersion()) return decodeKey('DATA_ENCRYPTION_PREVIOUS_MASTER_KEY')
  throw new Error(`Não existe chave configurada para descriptografar dados ${version}.`)
}

function derivedKey(master: Buffer, tenantId: string, field: string, version: EncryptionVersion) {
  return Buffer.from(
    hkdfSync('sha256', master, Buffer.from(tenantId), Buffer.from(`rpmtruck:${field}:${version}`), 32),
  )
}

function aad(tenantId: string, field: string, version: EncryptionVersion) {
  return Buffer.from(`rpmtruck:${tenantId}:${field}:${version}`)
}

function encryptedVersion(value: string) {
  if (!value.startsWith(`${ENCRYPTED_PREFIX}:`)) return null
  const version = value.split(':', 3)[1]
  return parseVersion(version)
}

function assertCompleteEncryptionConfig() {
  const hasMaster = Boolean(process.env.DATA_ENCRYPTION_MASTER_KEY)
  const hasBlindIndex = Boolean(process.env.DATA_BLIND_INDEX_KEY)
  if (hasMaster !== hasBlindIndex) {
    throw new Error('Configure as duas chaves ativas de proteção de dados ou remova ambas antes de iniciar a aplicação.')
  }

  const configuredPreviousVersion = previousVersion()
  const hasPreviousMaster = Boolean(process.env.DATA_ENCRYPTION_PREVIOUS_MASTER_KEY)
  const hasPreviousBlindIndex = Boolean(process.env.DATA_BLIND_INDEX_PREVIOUS_KEY)
  if (configuredPreviousVersion && (!hasPreviousMaster || !hasPreviousBlindIndex)) {
    throw new Error('A rotação exige a versão e as duas chaves anteriores enquanto houver dados legados.')
  }
  if (!configuredPreviousVersion && (hasPreviousMaster || hasPreviousBlindIndex)) {
    throw new Error('Configure DATA_ENCRYPTION_PREVIOUS_VERSION para identificar as chaves anteriores.')
  }
  if (configuredPreviousVersion === activeVersion()) {
    throw new Error('As versões de criptografia ativa e anterior devem ser diferentes.')
  }
}

export function encryptionConfigured() {
  assertCompleteEncryptionConfig()
  return Boolean(process.env.DATA_ENCRYPTION_MASTER_KEY && process.env.DATA_BLIND_INDEX_KEY)
}

/** Mantém texto legado sem configuração; com chaves configuradas, novas escritas usam a versão ativa. */
export function encryptSensitive(value: string | null | undefined, tenantId: string, field: string) {
  if (!value) return value ?? null
  const master = decodeKey('DATA_ENCRYPTION_MASTER_KEY')
  if (!master) return value

  const version = activeVersion()
  const existingVersion = encryptedVersion(value)
  if (existingVersion === version) return value
  const plaintext = existingVersion ? decryptSensitive(value, tenantId, field) : value
  if (!plaintext) return plaintext

  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', derivedKey(master, tenantId, field, version), iv)
  cipher.setAAD(aad(tenantId, field, version))
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  return [
    ENCRYPTED_PREFIX,
    version,
    iv.toString('base64url'),
    cipher.getAuthTag().toString('base64url'),
    ciphertext.toString('base64url'),
  ].join(':')
}

export function decryptSensitive(value: string | null | undefined, tenantId: string, field: string) {
  if (!value) return value ?? null
  const version = encryptedVersion(value)
  if (!version) return value

  const parts = value.split(':')
  if (parts.length !== 5) throw new Error('Formato de dado criptografado inválido.')
  const master = masterKeyFor(version)
  if (!master) throw new Error(`Chave de criptografia ${version} ausente para ler dados protegidos.`)

  const decipher = createDecipheriv(
    'aes-256-gcm',
    derivedKey(master, tenantId, field, version),
    Buffer.from(parts[2], 'base64url'),
  )
  decipher.setAAD(aad(tenantId, field, version))
  decipher.setAuthTag(Buffer.from(parts[3], 'base64url'))
  return Buffer.concat([
    decipher.update(Buffer.from(parts[4], 'base64url')),
    decipher.final(),
  ]).toString('utf8')
}

export function blindIndex(value: string | null | undefined, tenantId: string, field: string) {
  if (!value) return null
  const key = decodeKey('DATA_BLIND_INDEX_KEY')
  if (!key) return null
  const normalized = value.normalize('NFKC').trim().toLowerCase().replace(/[^a-z0-9]/g, '')
  return createHmac('sha256', key).update(`${tenantId}:${field}:${normalized}`).digest('hex')
}

export function protectMotorista<T extends { cpf?: string | null; rg?: string | null; cnh: string }>(data: T, empresaId: string) {
  assertCompleteEncryptionConfig()
  return {
    ...data,
    cpf: encryptSensitive(data.cpf, empresaId, 'motorista.cpf'),
    rg: encryptSensitive(data.rg, empresaId, 'motorista.rg'),
    cnh: encryptSensitive(data.cnh, empresaId, 'motorista.cnh')!,
    cpfHash: blindIndex(data.cpf, empresaId, 'motorista.cpf'),
    cnhHash: blindIndex(data.cnh, empresaId, 'motorista.cnh'),
  }
}

export function exposeMotorista<T extends { empresaId: string; cpf?: string | null; rg?: string | null; cnh: string; cpfHash?: unknown; cnhHash?: unknown }>(data: T) {
  const { cpfHash: _cpfHash, cnhHash: _cnhHash, ...safe } = data
  void _cpfHash
  void _cnhHash
  return {
    ...safe,
    cpf: decryptSensitive(data.cpf, data.empresaId, 'motorista.cpf'),
    rg: decryptSensitive(data.rg, data.empresaId, 'motorista.rg'),
    cnh: decryptSensitive(data.cnh, data.empresaId, 'motorista.cnh'),
  }
}

export function protectEmpresa<T extends { cnpj?: string | null; telefone?: string | null }>(data: T, empresaId: string) {
  assertCompleteEncryptionConfig()
  return {
    ...data,
    cnpj: encryptSensitive(data.cnpj, empresaId, 'empresa.cnpj'),
    telefone: encryptSensitive(data.telefone, empresaId, 'empresa.telefone'),
    cnpjHash: blindIndex(data.cnpj, 'global', 'empresa.cnpj'),
  }
}

export function exposeEmpresa<T extends { id: string; cnpj?: string | null; telefone?: string | null; cnpjHash?: unknown }>(data: T) {
  const { cnpjHash: _cnpjHash, ...safe } = data
  void _cnpjHash
  return {
    ...safe,
    cnpj: decryptSensitive(data.cnpj, data.id, 'empresa.cnpj'),
    telefone: decryptSensitive(data.telefone, data.id, 'empresa.telefone'),
  }
}

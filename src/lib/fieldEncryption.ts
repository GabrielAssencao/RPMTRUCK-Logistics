import 'server-only'
import {
  assertSequentialRotation,
  blindIndexWithKey,
  decodeEncryptionKey,
  decryptWithKey,
  encryptedValueVersion,
  encryptWithKey,
  parseEncryptionVersion,
} from '@/lib/dataEncryptionCore.mjs'

type KeyEnvironmentName =
  | 'DATA_ENCRYPTION_MASTER_KEY'
  | 'DATA_BLIND_INDEX_KEY'
  | 'DATA_ENCRYPTION_PREVIOUS_MASTER_KEY'
  | 'DATA_BLIND_INDEX_PREVIOUS_KEY'

function activeVersion() {
  return parseEncryptionVersion(process.env.DATA_ENCRYPTION_ACTIVE_VERSION, 'v1')
}

function previousVersion() {
  const value = process.env.DATA_ENCRYPTION_PREVIOUS_VERSION
  return value ? parseEncryptionVersion(value) : null
}

function decodeKey(name: KeyEnvironmentName) {
  const value = process.env[name]
  if (!value) return null
  return decodeEncryptionKey(value, name)
}

function masterKeyFor(version: string) {
  if (version === activeVersion()) return decodeKey('DATA_ENCRYPTION_MASTER_KEY')
  if (version === previousVersion()) return decodeKey('DATA_ENCRYPTION_PREVIOUS_MASTER_KEY')
  throw new Error(`Não existe chave configurada para descriptografar dados ${version}.`)
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
  if (configuredPreviousVersion) {
    assertSequentialRotation(configuredPreviousVersion, activeVersion())
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
  const existingVersion = encryptedValueVersion(value)
  if (existingVersion === version) return value
  const plaintext = existingVersion ? decryptSensitive(value, tenantId, field) : value
  if (!plaintext) return plaintext

  return encryptWithKey(plaintext, master, tenantId, field, version)
}

export function decryptSensitive(value: string | null | undefined, tenantId: string, field: string) {
  if (!value) return value ?? null
  const version = encryptedValueVersion(value)
  if (!version) return value
  const master = masterKeyFor(version)
  if (!master) throw new Error(`Chave de criptografia ${version} ausente para ler dados protegidos.`)
  return decryptWithKey(value, master, tenantId, field)
}

export function blindIndex(value: string | null | undefined, tenantId: string, field: string) {
  if (!value) return null
  const key = decodeKey('DATA_BLIND_INDEX_KEY')
  if (!key) return null
  return blindIndexWithKey(key, value, tenantId, field)
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

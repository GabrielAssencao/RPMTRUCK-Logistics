import { createCipheriv, createDecipheriv, createHmac, hkdfSync, randomBytes } from 'node:crypto'
import { PrismaClient } from '@prisma/client'

const apply = process.argv.includes('--apply')
const activeVersion = process.env.DATA_ENCRYPTION_ACTIVE_VERSION || 'v1'
if (activeVersion !== 'v1' || process.env.DATA_ENCRYPTION_PREVIOUS_VERSION) {
  throw new Error('Este script serve apenas para o backfill inicial v1. Use security:rotate-data para rotações.')
}
const masterValue = process.env.DATA_ENCRYPTION_MASTER_KEY?.trim() || ''
const blindValue = process.env.DATA_BLIND_INDEX_KEY?.trim() || ''
const master = Buffer.from(masterValue, 'base64')
const blindKey = Buffer.from(blindValue, 'base64')
if (
  master.length !== 32
  || blindKey.length !== 32
  || master.toString('base64') !== masterValue
  || blindKey.toString('base64') !== blindValue
) {
  throw new Error('Configure DATA_ENCRYPTION_MASTER_KEY e DATA_BLIND_INDEX_KEY com 32 bytes em Base64.')
}

const prisma = new PrismaClient()
const prefix = 'enc:v1'
const derive = (tenantId, field) => Buffer.from(hkdfSync('sha256', master, Buffer.from(tenantId), Buffer.from(`rpmtruck:${field}:v1`), 32))
const aad = (tenantId, field) => Buffer.from(`rpmtruck:${tenantId}:${field}:v1`)
const encrypt = (value, tenantId, field) => {
  if (!value || value.startsWith(`${prefix}:`)) return value
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', derive(tenantId, field), iv)
  cipher.setAAD(aad(tenantId, field))
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  return [prefix, iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), ciphertext.toString('base64url')].join(':')
}
const decrypt = (value, tenantId, field) => {
  if (!value || !value.startsWith(`${prefix}:`)) return value
  const parts = value.split(':')
  const decipher = createDecipheriv('aes-256-gcm', derive(tenantId, field), Buffer.from(parts[2], 'base64url'))
  decipher.setAAD(aad(tenantId, field))
  decipher.setAuthTag(Buffer.from(parts[3], 'base64url'))
  return Buffer.concat([decipher.update(Buffer.from(parts[4], 'base64url')), decipher.final()]).toString('utf8')
}
const index = (value, tenantId, field) => {
  if (!value) return null
  const normalized = value.normalize('NFKC').trim().toLowerCase().replace(/[^a-z0-9]/g, '')
  return createHmac('sha256', blindKey).update(`${tenantId}:${field}:${normalized}`).digest('hex')
}

try {
  const [empresas, motoristas] = await Promise.all([
    prisma.empresa.findMany({ select: { id: true, cnpj: true, telefone: true } }),
    prisma.motorista.findMany({ select: { id: true, empresaId: true, cpf: true, rg: true, cnh: true } }),
  ])

  process.stdout.write(`Modo: ${apply ? 'APLICAR' : 'SIMULAÇÃO'}; empresas: ${empresas.length}; motoristas: ${motoristas.length}\n`)
  if (!apply) process.stdout.write('Nenhum dado foi alterado. Execute novamente com --apply após backup e migration.\n')

  const cnpjIndexes = empresas.map((empresa) => index(decrypt(empresa.cnpj, empresa.id, 'empresa.cnpj'), 'global', 'empresa.cnpj')).filter(Boolean)
  const cpfIndexes = motoristas.map((motorista) => index(decrypt(motorista.cpf, motorista.empresaId, 'motorista.cpf'), motorista.empresaId, 'motorista.cpf')).filter(Boolean)
  const cnhIndexes = motoristas.map((motorista) => index(decrypt(motorista.cnh, motorista.empresaId, 'motorista.cnh'), motorista.empresaId, 'motorista.cnh')).filter(Boolean)
  if (new Set(cnpjIndexes).size !== cnpjIndexes.length) throw new Error('Existem CNPJs duplicados após normalização. Corrija-os antes da criptografia.')
  if (new Set(cpfIndexes).size !== cpfIndexes.length) throw new Error('Existem CPFs duplicados por empresa após normalização. Corrija-os antes da criptografia.')
  if (new Set(cnhIndexes).size !== cnhIndexes.length) throw new Error('Existem CNHs duplicadas por empresa após normalização. Corrija-as antes da criptografia.')

  if (apply) {
    for (const empresa of empresas) {
      const cnpjPlain = decrypt(empresa.cnpj, empresa.id, 'empresa.cnpj')
      await prisma.empresa.update({
        where: { id: empresa.id },
        data: {
          cnpj: encrypt(cnpjPlain, empresa.id, 'empresa.cnpj'),
          telefone: encrypt(decrypt(empresa.telefone, empresa.id, 'empresa.telefone'), empresa.id, 'empresa.telefone'),
          cnpjHash: index(cnpjPlain, 'global', 'empresa.cnpj'),
        },
      })
    }
    for (const motorista of motoristas) {
      const cpfPlain = decrypt(motorista.cpf, motorista.empresaId, 'motorista.cpf')
      const cnhPlain = decrypt(motorista.cnh, motorista.empresaId, 'motorista.cnh')
      await prisma.motorista.update({
        where: { id: motorista.id },
        data: {
          cpf: encrypt(cpfPlain, motorista.empresaId, 'motorista.cpf'),
          rg: encrypt(decrypt(motorista.rg, motorista.empresaId, 'motorista.rg'), motorista.empresaId, 'motorista.rg'),
          cnh: encrypt(cnhPlain, motorista.empresaId, 'motorista.cnh'),
          cpfHash: index(cpfPlain, motorista.empresaId, 'motorista.cpf'),
          cnhHash: index(cnhPlain, motorista.empresaId, 'motorista.cnh'),
        },
      })
    }
    process.stdout.write('Criptografia concluída sem imprimir dados pessoais.\n')
  }
} finally {
  await prisma.$disconnect()
}

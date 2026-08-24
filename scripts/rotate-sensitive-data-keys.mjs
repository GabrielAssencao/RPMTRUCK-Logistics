import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  hkdfSync,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto'
import { PrismaClient } from '@prisma/client'

const APPLY_CONFIRMATION = '--confirm=ROTATE_TO_V2'
const apply = process.argv.includes('--apply')
const confirmed = process.argv.includes(APPLY_CONFIRMATION)
const activeVersion = process.env.DATA_ENCRYPTION_ACTIVE_VERSION
const previousVersion = process.env.DATA_ENCRYPTION_PREVIOUS_VERSION

if (activeVersion !== 'v2' || previousVersion !== 'v1') {
  throw new Error('Para esta rotação, configure DATA_ENCRYPTION_ACTIVE_VERSION=v2 e DATA_ENCRYPTION_PREVIOUS_VERSION=v1.')
}
if (apply && !confirmed) {
  throw new Error(`Aplicação bloqueada. Repita com --apply ${APPLY_CONFIRMATION} após backup e simulação.`)
}

function requiredKey(name) {
  const value = process.env[name]
  const normalized = value?.trim() || ''
  const key = Buffer.from(normalized, 'base64')
  if (key.length !== 32 || key.toString('base64') !== normalized) {
    throw new Error(`${name} deve conter exatamente 32 bytes em Base64 válido.`)
  }
  return key
}

const activeMaster = requiredKey('DATA_ENCRYPTION_MASTER_KEY')
const activeBlind = requiredKey('DATA_BLIND_INDEX_KEY')
const previousMaster = requiredKey('DATA_ENCRYPTION_PREVIOUS_MASTER_KEY')
const previousBlind = requiredKey('DATA_BLIND_INDEX_PREVIOUS_KEY')

if (timingSafeEqual(activeMaster, previousMaster) || timingSafeEqual(activeBlind, previousBlind)) {
  throw new Error('As chaves v2 devem ser novas e diferentes das chaves v1.')
}

const prisma = new PrismaClient()
const supportedVersions = new Set(['v1', 'v2'])

function versionOf(value) {
  if (!value || !value.startsWith('enc:')) return null
  const version = value.split(':', 3)[1]
  if (!supportedVersions.has(version)) throw new Error('Foi encontrado um registro com versão de criptografia desconhecida.')
  return version
}

function keyFor(version) {
  if (version === activeVersion) return activeMaster
  if (version === previousVersion) return previousMaster
  throw new Error(`Não existe chave disponível para a versão ${version}.`)
}

function derivedKey(master, tenantId, field, version) {
  return Buffer.from(
    hkdfSync('sha256', master, Buffer.from(tenantId), Buffer.from(`rpmtruck:${field}:${version}`), 32),
  )
}

function aad(tenantId, field, version) {
  return Buffer.from(`rpmtruck:${tenantId}:${field}:${version}`)
}

function decrypt(value, tenantId, field) {
  if (!value) return value
  const version = versionOf(value)
  if (!version) return value
  const parts = value.split(':')
  if (parts.length !== 5) throw new Error('Foi encontrado um registro criptografado com formato inválido.')

  const decipher = createDecipheriv(
    'aes-256-gcm',
    derivedKey(keyFor(version), tenantId, field, version),
    Buffer.from(parts[2], 'base64url'),
  )
  decipher.setAAD(aad(tenantId, field, version))
  decipher.setAuthTag(Buffer.from(parts[3], 'base64url'))
  return Buffer.concat([
    decipher.update(Buffer.from(parts[4], 'base64url')),
    decipher.final(),
  ]).toString('utf8')
}

function encryptActive(value, plaintext, tenantId, field) {
  if (!value || versionOf(value) === activeVersion) return value
  const iv = randomBytes(12)
  const cipher = createCipheriv(
    'aes-256-gcm',
    derivedKey(activeMaster, tenantId, field, activeVersion),
    iv,
  )
  cipher.setAAD(aad(tenantId, field, activeVersion))
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  return [
    'enc',
    activeVersion,
    iv.toString('base64url'),
    cipher.getAuthTag().toString('base64url'),
    ciphertext.toString('base64url'),
  ].join(':')
}

function blindIndexWith(key, value, tenantId, field) {
  if (!value) return null
  const normalized = value.normalize('NFKC').trim().toLowerCase().replace(/[^a-z0-9]/g, '')
  return createHmac('sha256', key).update(`${tenantId}:${field}:${normalized}`).digest('hex')
}

function activeBlindIndex(value, tenantId, field) {
  return blindIndexWith(activeBlind, value, tenantId, field)
}

function assertExistingBlindIndex(existing, value, tenantId, field) {
  if (!existing) return
  const validIndexes = [
    blindIndexWith(previousBlind, value, tenantId, field),
    blindIndexWith(activeBlind, value, tenantId, field),
  ]
  if (!validIndexes.includes(existing)) {
    throw new Error('A verificação de integridade encontrou um índice cego incompatível. A rotação foi interrompida.')
  }
}

function countVersions(values) {
  return values.reduce(
    (result, value) => {
      if (!value) return result
      const version = versionOf(value)
      result[version || 'plaintext'] += 1
      return result
    },
    { v1: 0, v2: 0, plaintext: 0 },
  )
}

function assertUnique(values, message) {
  const present = values.filter(Boolean)
  if (new Set(present).size !== present.length) throw new Error(message)
}

function prepare(empresas, motoristas) {
  const preparedEmpresas = empresas.map((empresa) => {
    const cnpj = decrypt(empresa.cnpj, empresa.id, 'empresa.cnpj')
    const telefone = decrypt(empresa.telefone, empresa.id, 'empresa.telefone')
    assertExistingBlindIndex(empresa.cnpjHash, cnpj, 'global', 'empresa.cnpj')
    return {
      id: empresa.id,
      cnpj: encryptActive(empresa.cnpj, cnpj, empresa.id, 'empresa.cnpj'),
      telefone: encryptActive(empresa.telefone, telefone, empresa.id, 'empresa.telefone'),
      cnpjHash: activeBlindIndex(cnpj, 'global', 'empresa.cnpj'),
    }
  })

  const preparedMotoristas = motoristas.map((motorista) => {
    const cpf = decrypt(motorista.cpf, motorista.empresaId, 'motorista.cpf')
    const rg = decrypt(motorista.rg, motorista.empresaId, 'motorista.rg')
    const cnh = decrypt(motorista.cnh, motorista.empresaId, 'motorista.cnh')
    assertExistingBlindIndex(motorista.cpfHash, cpf, motorista.empresaId, 'motorista.cpf')
    assertExistingBlindIndex(motorista.cnhHash, cnh, motorista.empresaId, 'motorista.cnh')
    return {
      id: motorista.id,
      empresaId: motorista.empresaId,
      cpf: encryptActive(motorista.cpf, cpf, motorista.empresaId, 'motorista.cpf'),
      rg: encryptActive(motorista.rg, rg, motorista.empresaId, 'motorista.rg'),
      cnh: encryptActive(motorista.cnh, cnh, motorista.empresaId, 'motorista.cnh'),
      cpfHash: activeBlindIndex(cpf, motorista.empresaId, 'motorista.cpf'),
      cnhHash: activeBlindIndex(cnh, motorista.empresaId, 'motorista.cnh'),
    }
  })

  assertUnique(preparedEmpresas.map((empresa) => empresa.cnpjHash), 'Existem CNPJs duplicados após normalização.')
  for (const empresaId of new Set(preparedMotoristas.map((motorista) => motorista.empresaId))) {
    const tenant = preparedMotoristas.filter((motorista) => motorista.empresaId === empresaId)
    assertUnique(tenant.map((motorista) => motorista.cpfHash), 'Existem CPFs duplicados em uma empresa após normalização.')
    assertUnique(tenant.map((motorista) => motorista.cnhHash), 'Existem CNHs duplicadas em uma empresa após normalização.')
  }
  return { preparedEmpresas, preparedMotoristas }
}

async function readData(client) {
  return Promise.all([
    client.empresa.findMany({ select: { id: true, cnpj: true, telefone: true, cnpjHash: true } }),
    client.motorista.findMany({
      select: { id: true, empresaId: true, cpf: true, rg: true, cnh: true, cpfHash: true, cnhHash: true },
    }),
  ])
}

async function acquireRotationLock(client) {
  await client.$queryRaw`
    SELECT 1::integer AS acquired
    FROM (SELECT pg_advisory_xact_lock(hashtext('rpmtruck:data-key-rotation'))) AS rotation_lock
  `
}

function verifyRotated(empresas, motoristas) {
  for (const empresa of empresas) {
    for (const [field, value] of [['empresa.cnpj', empresa.cnpj], ['empresa.telefone', empresa.telefone]]) {
      if (value && versionOf(value) !== activeVersion) throw new Error('A verificação final encontrou dados empresariais fora da v2.')
      decrypt(value, empresa.id, field)
    }
    const cnpj = decrypt(empresa.cnpj, empresa.id, 'empresa.cnpj')
    if (empresa.cnpjHash !== activeBlindIndex(cnpj, 'global', 'empresa.cnpj')) {
      throw new Error('A verificação final encontrou um índice de CNPJ incompatível.')
    }
  }

  for (const motorista of motoristas) {
    for (const [field, value] of [
      ['motorista.cpf', motorista.cpf],
      ['motorista.rg', motorista.rg],
      ['motorista.cnh', motorista.cnh],
    ]) {
      if (value && versionOf(value) !== activeVersion) throw new Error('A verificação final encontrou dados de motorista fora da v2.')
      decrypt(value, motorista.empresaId, field)
    }
    const cpf = decrypt(motorista.cpf, motorista.empresaId, 'motorista.cpf')
    const cnh = decrypt(motorista.cnh, motorista.empresaId, 'motorista.cnh')
    if (motorista.cpfHash !== activeBlindIndex(cpf, motorista.empresaId, 'motorista.cpf')) {
      throw new Error('A verificação final encontrou um índice de CPF incompatível.')
    }
    if (motorista.cnhHash !== activeBlindIndex(cnh, motorista.empresaId, 'motorista.cnh')) {
      throw new Error('A verificação final encontrou um índice de CNH incompatível.')
    }
  }
}

try {
  const [empresas, motoristas] = await readData(prisma)
  const versions = countVersions([
    ...empresas.flatMap((empresa) => [empresa.cnpj, empresa.telefone]),
    ...motoristas.flatMap((motorista) => [motorista.cpf, motorista.rg, motorista.cnh]),
  ])
  prepare(empresas, motoristas)

  process.stdout.write(
    `Rotação ${apply ? 'APLICAR' : 'SIMULAÇÃO'}: ${empresas.length} empresas, ${motoristas.length} motoristas; `
      + `campos v1=${versions.v1}, v2=${versions.v2}, texto legado=${versions.plaintext}.\n`,
  )

  if (!apply) {
    await prisma.$transaction(async (tx) => {
      await acquireRotationLock(tx)
      const [lockedEmpresas, lockedMotoristas] = await readData(tx)
      prepare(lockedEmpresas, lockedMotoristas)
    }, { isolationLevel: 'Serializable', maxWait: 15_000, timeout: 120_000 })
    process.stdout.write(`Nenhum dado foi alterado. Após o backup, use --apply ${APPLY_CONFIRMATION}.\n`)
  } else {
    await prisma.$transaction(async (tx) => {
      await acquireRotationLock(tx)
      const [currentEmpresas, currentMotoristas] = await readData(tx)
      const current = prepare(currentEmpresas, currentMotoristas)

      for (const empresa of current.preparedEmpresas) {
        await tx.empresa.update({
          where: { id: empresa.id },
          data: { cnpj: empresa.cnpj, telefone: empresa.telefone, cnpjHash: empresa.cnpjHash },
        })
      }
      for (const motorista of current.preparedMotoristas) {
        await tx.motorista.update({
          where: { id: motorista.id },
          data: {
            cpf: motorista.cpf,
            rg: motorista.rg,
            cnh: motorista.cnh,
            cpfHash: motorista.cpfHash,
            cnhHash: motorista.cnhHash,
          },
        })
      }

      const [rotatedEmpresas, rotatedMotoristas] = await readData(tx)
      verifyRotated(rotatedEmpresas, rotatedMotoristas)
    }, { isolationLevel: 'Serializable', maxWait: 15_000, timeout: 120_000 })

    process.stdout.write('Rotação para v2 concluída e verificada. As chaves v1 ainda devem ser preservadas no backup seguro.\n')
  }
} catch (error) {
  console.error('Rotação cancelada sem exibir dados pessoais:', error instanceof Error ? error.message : 'erro desconhecido')
  process.exitCode = 1
} finally {
  await prisma.$disconnect()
}

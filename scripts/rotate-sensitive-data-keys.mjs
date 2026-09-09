import { timingSafeEqual } from 'node:crypto'
import { PrismaClient } from '@prisma/client'
import {
  assertSequentialRotation,
  blindIndexWithKey,
  decodeEncryptionKey,
  decryptWithKey,
  encryptedValueVersion,
  encryptWithKey,
  parseEncryptionVersion,
} from '../src/lib/dataEncryptionCore.mjs'

const environmentArgument = process.argv.find((argument) => argument.startsWith('--environment='))
const targetEnvironment = environmentArgument?.slice('--environment='.length)
if (!['development', 'production'].includes(targetEnvironment)) {
  throw new Error('Informe explicitamente --environment=development ou --environment=production.')
}
if (targetEnvironment === 'development' && process.env.LOCAL_ENVIRONMENT !== 'development') {
  throw new Error('Rotação local bloqueada: LOCAL_ENVIRONMENT deve ser development.')
}

const activeVersion = parseEncryptionVersion(process.env.DATA_ENCRYPTION_ACTIVE_VERSION)
const previousVersion = parseEncryptionVersion(process.env.DATA_ENCRYPTION_PREVIOUS_VERSION)
assertSequentialRotation(previousVersion, activeVersion)

const apply = process.argv.includes('--apply')
const rotationConfirmation = `--confirm=ROTATE_${previousVersion.toUpperCase()}_TO_${activeVersion.toUpperCase()}`
const productionConfirmation = '--confirm-production=BACKUP_VERIFIED'
if (apply && !process.argv.includes(rotationConfirmation)) {
  throw new Error(`Aplicação bloqueada. Após backup e simulação, informe ${rotationConfirmation}.`)
}
if (apply && targetEnvironment === 'production' && !process.argv.includes(productionConfirmation)) {
  throw new Error(`Produção bloqueada. Confirme um backup recuperável com ${productionConfirmation}.`)
}

const activeMaster = decodeEncryptionKey(process.env.DATA_ENCRYPTION_MASTER_KEY, 'DATA_ENCRYPTION_MASTER_KEY')
const activeBlind = decodeEncryptionKey(process.env.DATA_BLIND_INDEX_KEY, 'DATA_BLIND_INDEX_KEY')
const previousMaster = decodeEncryptionKey(
  process.env.DATA_ENCRYPTION_PREVIOUS_MASTER_KEY,
  'DATA_ENCRYPTION_PREVIOUS_MASTER_KEY',
)
const previousBlind = decodeEncryptionKey(
  process.env.DATA_BLIND_INDEX_PREVIOUS_KEY,
  'DATA_BLIND_INDEX_PREVIOUS_KEY',
)

if (timingSafeEqual(activeMaster, previousMaster) || timingSafeEqual(activeBlind, previousBlind)) {
  throw new Error(`As chaves ${activeVersion} devem ser novas e diferentes das chaves ${previousVersion}.`)
}

const prisma = new PrismaClient()

function keyFor(version) {
  if (version === activeVersion) return activeMaster
  if (version === previousVersion) return previousMaster
  throw new Error(`Não existe chave disponível para a versão ${version}.`)
}

function decrypt(value, tenantId, field) {
  if (!value) return value
  const version = encryptedValueVersion(value)
  if (!version) return value
  return decryptWithKey(value, keyFor(version), tenantId, field)
}

function encryptActive(value, plaintext, tenantId, field) {
  if (!value || encryptedValueVersion(value) === activeVersion) return value
  return encryptWithKey(plaintext, activeMaster, tenantId, field, activeVersion)
}

function activeBlindIndex(value, tenantId, field) {
  return blindIndexWithKey(activeBlind, value, tenantId, field)
}

function assertExistingBlindIndex(existing, value, tenantId, field) {
  if (!existing) return
  const validIndexes = [
    blindIndexWithKey(previousBlind, value, tenantId, field),
    blindIndexWithKey(activeBlind, value, tenantId, field),
  ]
  if (!validIndexes.includes(existing)) {
    throw new Error('A verificação de integridade encontrou um índice cego incompatível. A rotação foi interrompida.')
  }
}

function countVersions(values) {
  const result = { [previousVersion]: 0, [activeVersion]: 0, plaintext: 0 }
  for (const value of values) {
    if (!value) continue
    const version = encryptedValueVersion(value)
    const key = version || 'plaintext'
    result[key] = (result[key] || 0) + 1
  }
  return result
}

function versionSummary(versions) {
  return Object.entries(versions).map(([version, count]) => `${version}=${count}`).join(', ')
}

function assertUnique(values, message) {
  const present = values.filter(Boolean)
  if (new Set(present).size !== present.length) throw new Error(message)
}

function prepare(empresas, motoristas, contasPagar) {
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

  const preparedContasPagar = contasPagar.map((conta) => {
    const linhaDigitavel = decrypt(conta.linha_digitavel, conta.empresaId, 'contaPagar.linhaDigitavel')
    return {
      id: conta.id,
      linha_digitavel: encryptActive(
        conta.linha_digitavel,
        linhaDigitavel,
        conta.empresaId,
        'contaPagar.linhaDigitavel',
      ),
    }
  })

  assertUnique(preparedEmpresas.map((empresa) => empresa.cnpjHash), 'Existem CNPJs duplicados após normalização.')
  for (const empresaId of new Set(preparedMotoristas.map((motorista) => motorista.empresaId))) {
    const tenant = preparedMotoristas.filter((motorista) => motorista.empresaId === empresaId)
    assertUnique(tenant.map((motorista) => motorista.cpfHash), 'Existem CPFs duplicados em uma empresa após normalização.')
    assertUnique(tenant.map((motorista) => motorista.cnhHash), 'Existem CNHs duplicadas em uma empresa após normalização.')
  }
  return { preparedEmpresas, preparedMotoristas, preparedContasPagar }
}

async function readData(client) {
  return Promise.all([
    client.empresa.findMany({ select: { id: true, cnpj: true, telefone: true, cnpjHash: true } }),
    client.motorista.findMany({
      select: { id: true, empresaId: true, cpf: true, rg: true, cnh: true, cpfHash: true, cnhHash: true },
    }),
    client.contaPagar.findMany({ select: { id: true, empresaId: true, linha_digitavel: true } }),
  ])
}

async function acquireRotationLock(client) {
  await client.$queryRaw`
    SELECT 1::integer AS acquired
    FROM (SELECT pg_advisory_xact_lock(hashtext('rpmtruck:data-key-rotation'))) AS rotation_lock
  `
}

function assertActiveVersion(value, message) {
  if (value && encryptedValueVersion(value) !== activeVersion) throw new Error(message)
}

function verifyRotated(empresas, motoristas, contasPagar) {
  for (const empresa of empresas) {
    for (const [field, value] of [['empresa.cnpj', empresa.cnpj], ['empresa.telefone', empresa.telefone]]) {
      assertActiveVersion(value, `A verificação final encontrou dados empresariais fora da ${activeVersion}.`)
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
      assertActiveVersion(value, `A verificação final encontrou dados de motorista fora da ${activeVersion}.`)
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

  for (const conta of contasPagar) {
    assertActiveVersion(
      conta.linha_digitavel,
      `A verificação final encontrou uma linha digitável fora da ${activeVersion}.`,
    )
    decrypt(conta.linha_digitavel, conta.empresaId, 'contaPagar.linhaDigitavel')
  }
}

try {
  const [empresas, motoristas, contasPagar] = await readData(prisma)
  const versions = countVersions([
    ...empresas.flatMap((empresa) => [empresa.cnpj, empresa.telefone]),
    ...motoristas.flatMap((motorista) => [motorista.cpf, motorista.rg, motorista.cnh]),
    ...contasPagar.map((conta) => conta.linha_digitavel),
  ])
  prepare(empresas, motoristas, contasPagar)

  process.stdout.write(
    `Rotação ${previousVersion} -> ${activeVersion} ${apply ? 'APLICAR' : 'SIMULAÇÃO'} em ${targetEnvironment}: `
      + `${empresas.length} empresas, ${motoristas.length} motoristas, ${contasPagar.length} contas a pagar; `
      + `${versionSummary(versions)}.\n`,
  )

  if (!apply) {
    await prisma.$transaction(async (tx) => {
      await acquireRotationLock(tx)
      const lockedData = await readData(tx)
      prepare(...lockedData)
    }, { isolationLevel: 'Serializable', maxWait: 15_000, timeout: 120_000 })
    process.stdout.write(`Nenhum dado foi alterado. Após o backup, use --apply ${rotationConfirmation}.\n`)
  } else {
    await prisma.$transaction(async (tx) => {
      await acquireRotationLock(tx)
      const currentData = await readData(tx)
      const current = prepare(...currentData)

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
      for (const conta of current.preparedContasPagar) {
        await tx.contaPagar.update({
          where: { id: conta.id },
          data: { linha_digitavel: conta.linha_digitavel },
        })
      }

      const rotatedData = await readData(tx)
      verifyRotated(...rotatedData)
    }, { isolationLevel: 'Serializable', maxWait: 15_000, timeout: 300_000 })

    process.stdout.write(
      `Rotação para ${activeVersion} concluída e verificada. Preserve as chaves ${previousVersion} no backup seguro.\n`,
    )
  }
} catch (error) {
  console.error(
    'Rotação cancelada sem exibir dados pessoais:',
    error instanceof Error ? error.message : 'erro desconhecido',
  )
  process.exitCode = 1
} finally {
  await prisma.$disconnect()
}

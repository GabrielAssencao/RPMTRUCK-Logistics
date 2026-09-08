import { PrismaClient } from '@prisma/client'
import { encryptedValueVersion } from '../src/lib/dataEncryptionCore.mjs'

const environmentArgument = process.argv.find((argument) => argument.startsWith('--environment='))
const targetEnvironment = environmentArgument?.slice('--environment='.length)
if (!['development', 'production'].includes(targetEnvironment)) {
  throw new Error('Informe explicitamente --environment=development ou --environment=production.')
}
if (targetEnvironment === 'development' && process.env.LOCAL_ENVIRONMENT !== 'development') {
  throw new Error('Auditoria local bloqueada: LOCAL_ENVIRONMENT deve ser development.')
}

const prisma = new PrismaClient()

function addVersion(counts, value) {
  if (!value) return
  const version = encryptedValueVersion(value) || 'plaintext'
  counts[version] = (counts[version] || 0) + 1
}

try {
  const [empresas, motoristas, contasPagar] = await Promise.all([
    prisma.empresa.findMany({ select: { cnpj: true, telefone: true } }),
    prisma.motorista.findMany({ select: { cpf: true, rg: true, cnh: true } }),
    prisma.contaPagar.findMany({ select: { linha_digitavel: true } }),
  ])
  const counts = {}
  for (const empresa of empresas) {
    addVersion(counts, empresa.cnpj)
    addVersion(counts, empresa.telefone)
  }
  for (const motorista of motoristas) {
    addVersion(counts, motorista.cpf)
    addVersion(counts, motorista.rg)
    addVersion(counts, motorista.cnh)
  }
  for (const conta of contasPagar) addVersion(counts, conta.linha_digitavel)

  const summary = Object.entries(counts)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([version, count]) => `${version}=${count}`)
    .join(', ')
  process.stdout.write(
    `Auditoria somente leitura em ${targetEnvironment}: ${empresas.length} empresas, `
      + `${motoristas.length} motoristas, ${contasPagar.length} contas a pagar; ${summary || 'nenhum campo preenchido'}.\n`,
  )
} catch (error) {
  console.error(
    'Auditoria cancelada sem exibir dados pessoais:',
    error instanceof Error ? error.message : 'erro desconhecido',
  )
  process.exitCode = 1
} finally {
  await prisma.$disconnect()
}

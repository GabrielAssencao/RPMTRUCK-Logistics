import { createHash, randomBytes } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const APPLY_CONFIRMATION = '--confirm=PREPARE_LOCAL_ROTATION'
const apply = process.argv.includes('--apply')
const envArgument = process.argv.find(argument => argument.startsWith('--env-file='))
const envPath = resolve(envArgument?.slice('--env-file='.length) || '.env.local')

if (apply && !process.argv.includes(APPLY_CONFIRMATION)) {
  throw new Error(`Aplicacao bloqueada. Informe ${APPLY_CONFIRMATION}.`)
}

const original = readFileSync(envPath, 'utf8')
const eol = original.includes('\r\n') ? '\r\n' : '\n'

function escaped(name) {
  return name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function readValue(source, name) {
  const match = source.match(new RegExp(`^${escaped(name)}=(?:"([^"]*)"|'([^']*)'|([^\\r\\n]*))$`, 'm'))
  if (!match) return null
  return (match[1] ?? match[2] ?? match[3] ?? '').trim()
}

function requiredValue(source, name) {
  const value = readValue(source, name)
  if (!value) throw new Error(`${name} precisa estar configurada antes da rotacao.`)
  return value
}

function setValue(source, name, value) {
  const line = `${name}="${value}"`
  const pattern = new RegExp(`^${escaped(name)}=.*$`, 'm')
  if (pattern.test(source)) return source.replace(pattern, line)
  return `${source.replace(/[\r\n]*$/, '')}${eol}${line}${eol}`
}

function fingerprint(value) {
  return createHash('sha256').update(value).digest('hex').slice(0, 12)
}

const activeVersion = requiredValue(original, 'DATA_ENCRYPTION_ACTIVE_VERSION')
const versionMatch = /^v([1-9]\d*)$/.exec(activeVersion)
if (!versionMatch) throw new Error('DATA_ENCRYPTION_ACTIVE_VERSION deve usar o formato sequencial vN.')

const pendingNames = [
  'DATA_ENCRYPTION_PREVIOUS_VERSION',
  'DATA_ENCRYPTION_PREVIOUS_MASTER_KEY',
  'DATA_BLIND_INDEX_PREVIOUS_KEY',
]
if (pendingNames.some(name => readValue(original, name))) {
  throw new Error('Ja existe uma rotacao de dados pendente. Conclua e audite essa rotacao antes de preparar outra.')
}

const currentMaster = requiredValue(original, 'DATA_ENCRYPTION_MASTER_KEY')
const currentBlindIndex = requiredValue(original, 'DATA_BLIND_INDEX_KEY')
const nextVersion = `v${Number(versionMatch[1]) + 1}`

const generated = {
  JWT_SECRET: randomBytes(64).toString('base64url'),
  RATE_LIMIT_HASH_SECRET: randomBytes(64).toString('base64url'),
  CRON_SECRET: randomBytes(64).toString('base64url'),
  ASAAS_WEBHOOK_TOKEN: `whsec_${randomBytes(48).toString('base64url')}`,
  DATA_ENCRYPTION_PREVIOUS_VERSION: activeVersion,
  DATA_ENCRYPTION_PREVIOUS_MASTER_KEY: currentMaster,
  DATA_BLIND_INDEX_PREVIOUS_KEY: currentBlindIndex,
  DATA_ENCRYPTION_ACTIVE_VERSION: nextVersion,
  DATA_ENCRYPTION_MASTER_KEY: randomBytes(32).toString('base64'),
  DATA_BLIND_INDEX_KEY: randomBytes(32).toString('base64'),
}

if (!apply) {
  process.stdout.write(
    `Simulacao: segredos internos serao renovados e a rotacao de dados ${activeVersion} -> ${nextVersion} sera preparada. Nenhum arquivo foi alterado.${eol}`,
  )
  process.stdout.write(`Para aplicar: npm.cmd run security:prepare-secrets:local -- --apply ${APPLY_CONFIRMATION}${eol}`)
  process.exit(0)
}

let updated = original
for (const [name, value] of Object.entries(generated)) updated = setValue(updated, name, value)
writeFileSync(envPath, updated, { encoding: 'utf8', mode: 0o600 })

process.stdout.write(`Segredos internos renovados e rotacao ${activeVersion} -> ${nextVersion} preparada em ${envPath}.${eol}`)
process.stdout.write('Os valores secretos nao foram exibidos. Identificadores para conferencia local:' + eol)
for (const name of ['JWT_SECRET', 'RATE_LIMIT_HASH_SECRET', 'CRON_SECRET', 'ASAAS_WEBHOOK_TOKEN']) {
  process.stdout.write(`- ${name}: sha256:${fingerprint(generated[name])}${eol}`)
}
process.stdout.write(`Copie o novo ASAAS_WEBHOOK_TOKEN diretamente do arquivo local para o Auth Token do webhook no painel Asaas.${eol}`)
process.stdout.write(`Nao remova as chaves ${activeVersion} anteriores ate concluir e auditar a migracao para ${nextVersion}.${eol}`)

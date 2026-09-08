import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import {
  assertSequentialRotation,
  blindIndexWithKey,
  decodeEncryptionKey,
  decryptWithKey,
  encryptedValueVersion,
  encryptWithKey,
  parseEncryptionVersion,
} from '../src/lib/dataEncryptionCore.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

test('versões futuras usam formato vN e rotações não podem pular gerações', () => {
  assert.equal(parseEncryptionVersion('v3'), 'v3')
  assert.equal(parseEncryptionVersion('v250'), 'v250')
  assert.doesNotThrow(() => assertSequentialRotation('v2', 'v3'))
  assert.doesNotThrow(() => assertSequentialRotation('v249', 'v250'))
  assert.throws(() => parseEncryptionVersion('v0'))
  assert.throws(() => parseEncryptionVersion('v03'))
  assert.throws(() => assertSequentialRotation('v2', 'v4'), /sequencial/)
})

test('chaves exigem Base64 canônico de exatamente 32 bytes', () => {
  const valid = randomBytes(32).toString('base64')
  assert.deepEqual(decodeEncryptionKey(valid, 'TEST_KEY'), Buffer.from(valid, 'base64'))
  assert.throws(() => decodeEncryptionKey(randomBytes(31).toString('base64'), 'TEST_KEY'), /32 bytes/)
  assert.throws(() => decodeEncryptionKey('não-é-base64', 'TEST_KEY'), /Base64/)
})

test('dados podem ser recriptografados de v2 para v3 sem alterar o conteúdo', () => {
  const v2Key = randomBytes(32)
  const v3Key = randomBytes(32)
  const tenantId = 'empresa-teste'
  const field = 'motorista.cpf'
  const plaintext = '12345678909'

  const encryptedV2 = encryptWithKey(plaintext, v2Key, tenantId, field, 'v2')
  assert.equal(encryptedValueVersion(encryptedV2), 'v2')
  const recovered = decryptWithKey(encryptedV2, v2Key, tenantId, field)
  const encryptedV3 = encryptWithKey(recovered, v3Key, tenantId, field, 'v3')

  assert.equal(encryptedValueVersion(encryptedV3), 'v3')
  assert.equal(decryptWithKey(encryptedV3, v3Key, tenantId, field), plaintext)
  assert.throws(() => decryptWithKey(encryptedV3, v3Key, 'outra-empresa', field))
})

test('índices cegos mudam junto com a chave e permanecem determinísticos', () => {
  const previousKey = randomBytes(32)
  const activeKey = randomBytes(32)
  const input = '123.456.789-09'
  const previous = blindIndexWithKey(previousKey, input, 'tenant', 'motorista.cpf')
  const active = blindIndexWithKey(activeKey, input, 'tenant', 'motorista.cpf')

  assert.equal(previous, blindIndexWithKey(previousKey, '12345678909', 'tenant', 'motorista.cpf'))
  assert.notEqual(previous, active)
})

test('rotacionador inclui todos os domínios atualmente criptografados e confirma o ambiente', () => {
  const script = readFileSync(resolve(root, 'scripts/rotate-sensitive-data-keys.mjs'), 'utf8')

  assert.match(script, /client\.empresa\.findMany/)
  assert.match(script, /client\.motorista\.findMany/)
  assert.match(script, /client\.contaPagar\.findMany/)
  assert.match(script, /contaPagar\.linhaDigitavel/)
  assert.match(script, /assertSequentialRotation\(previousVersion, activeVersion\)/)
  assert.match(script, /--confirm-production=BACKUP_VERIFIED/)
  assert.doesNotMatch(script, /ROTATE_TO_V2/)
})

test('inventário de versões é somente leitura e cobre todos os dados protegidos', () => {
  const script = readFileSync(resolve(root, 'scripts/audit-sensitive-data-versions.mjs'), 'utf8')

  assert.match(script, /prisma\.empresa\.findMany/)
  assert.match(script, /prisma\.motorista\.findMany/)
  assert.match(script, /prisma\.contaPagar\.findMany/)
  assert.doesNotMatch(script, /\.(?:create|update|delete|upsert)\(/)
})

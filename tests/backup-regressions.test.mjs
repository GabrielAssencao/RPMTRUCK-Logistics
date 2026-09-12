import assert from 'node:assert/strict'
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomBytes } from 'node:crypto'
import test from 'node:test'
import { encryptFile, decryptFile, hashFile } from '../scripts/lib/backup-crypto.mjs'

test('backup AES-GCM recupera conteúdo, inclusive vazio, sem expor texto claro', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'rpm-backup-test-'))
  const key = randomBytes(32)
  try {
    for (const [index, contents] of [Buffer.from('dados de teste confidenciais'), Buffer.alloc(0)].entries()) {
      const input = join(directory, `input-${index}`), encrypted = join(directory, `encrypted-${index}`), restored = join(directory, `restored-${index}`)
      await writeFile(input, contents)
      const integrity = await encryptFile(input, encrypted, key)
      assert.equal(integrity.bytes, contents.length)
      if (contents.length) assert.equal((await readFile(encrypted)).includes(contents), false)
      await decryptFile(encrypted, restored, key)
      assert.deepEqual(await readFile(restored), contents)
      assert.equal(await hashFile(restored), integrity.sha256)
    }
  } finally { key.fill(0); await rm(directory, { recursive: true }) }
})

test('backup rejeita chave errada e adulteração', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'rpm-backup-test-'))
  const key = randomBytes(32)
  try {
    const input = join(directory, 'input'), encrypted = join(directory, 'encrypted')
    await writeFile(input, Buffer.from('teste de integridade'))
    await encryptFile(input, encrypted, key)
    await assert.rejects(decryptFile(encrypted, join(directory, 'wrong-key'), randomBytes(32)))
    const bytes = await readFile(encrypted)
    bytes[18] ^= 1
    await writeFile(join(directory, 'tampered'), bytes)
    await assert.rejects(decryptFile(join(directory, 'tampered'), join(directory, 'tampered-output'), key))
    await assert.rejects(encryptFile(input, encrypted, key), { code: 'EEXIST' })
  } finally { key.fill(0); await rm(directory, { recursive: true }) }
})

test('backup usa snapshot somente leitura e restaura apenas em cluster local', async () => {
  const source = await readFile(new URL('../scripts/backup-production.mjs', import.meta.url), 'utf8')
  assert.match(source, /SET TRANSACTION READ ONLY/)
  assert.match(source, /pg_export_snapshot/)
  assert.match(source, /--snapshot=/)
  assert.match(source, /PGHOST: '127.0.0.1'/)
  assert.match(source, /pg_restore.exe'[\s\S]*dump\], localEnv/)
  assert.match(source, /outsideRepo/)
  assert.match(source, /objectsAfter/)
  assert.doesNotMatch(source, /migrate deploy|\.upload\(/)
})

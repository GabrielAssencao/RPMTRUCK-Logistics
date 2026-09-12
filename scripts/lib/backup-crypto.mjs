import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'
import { createReadStream, createWriteStream } from 'node:fs'
import { writeFile, open, stat } from 'node:fs/promises'
import { pipeline } from 'node:stream/promises'

export async function encryptFile(source, destination, key) {
  const nonce = randomBytes(12)
  await writeFile(destination, Buffer.concat([Buffer.from('RPMB1'), nonce]), { flag: 'wx' })
  const hash = createHash('sha256')
  const input = createReadStream(source)
  input.on('data', chunk => hash.update(chunk))
  const cipher = createCipheriv('aes-256-gcm', key, nonce)
  await pipeline(input, cipher, createWriteStream(destination, { flags: 'a' }))
  const file = await open(destination, 'a')
  try { await file.write(cipher.getAuthTag()) } finally { await file.close() }
  return { sha256: hash.digest('hex'), bytes: (await stat(source)).size }
}

export async function decryptFile(source, destination, key) {
  const file = await open(source, 'r')
  const size = (await file.stat()).size
  const header = Buffer.alloc(17), tag = Buffer.alloc(16)
  try {
    if (size < 33) throw new Error('Backup inválido.')
    await file.read(header, 0, 17, 0)
    await file.read(tag, 0, 16, size - 16)
  } finally { await file.close() }
  if (header.subarray(0, 5).toString() !== 'RPMB1') throw new Error('Backup inválido.')
  const decipher = createDecipheriv('aes-256-gcm', key, header.subarray(5))
  decipher.setAuthTag(tag)
  if (size === 33) await writeFile(destination, decipher.final(), { flag: 'wx' })
  else await pipeline(createReadStream(source, { start: 17, end: size - 17 }), decipher, createWriteStream(destination, { flags: 'wx' }))
}

export async function hashFile(path) {
  const hash = createHash('sha256')
  for await (const chunk of createReadStream(path)) hash.update(chunk)
  return hash.digest('hex')
}

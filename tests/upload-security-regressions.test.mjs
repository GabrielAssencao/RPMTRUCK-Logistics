import assert from 'node:assert/strict'
import test from 'node:test'
import { createRequire } from 'node:module'
import { loadTs } from './helpers/load-ts.mjs'

const require = createRequire(import.meta.url)
const JSZip = require('jszip')
const { lerCorpoLimitado, lerFormularioLimitado, RequestBodyError, limiteCorpoRequisicao } = loadTs('src/lib/requestBody.ts')
const { verificarPacoteXlsx } = loadTs('src/lib/xlsxPackage.ts')

test('chunked upload without Content-Length is rejected and cancelled at the byte limit', async () => {
  let cancelled = false
  const stream = new ReadableStream({ pull(controller) { controller.enqueue(new Uint8Array(8)) }, cancel() { cancelled = true } })
  const request = new Request('http://localhost/api/contas-pagar', { method: 'POST', body: stream, duplex: 'half' })
  await assert.rejects(lerCorpoLimitado(request, 10), RequestBodyError)
  assert.equal(cancelled, true)
})

test('false Content-Length cannot bypass actual stream limits', async () => {
  const request = new Request('http://localhost', { method: 'POST', headers: { 'Content-Length': '1' }, body: new Uint8Array(30) })
  await assert.rejects(lerCorpoLimitado(request, 10), RequestBodyError)
  const tooLarge = new Request('http://localhost', { method: 'POST', headers: { 'Content-Length': '999999' }, body: 'a' })
  await assert.rejects(lerCorpoLimitado(tooLarge, 10), RequestBodyError)
})

test('bounded multipart parsing preserves legitimate fields and binary files', async () => {
  const form = new FormData()
  form.set('descricao', 'Synthetic invoice')
  form.set('boleto', new File(['%PDF-1.7\nsynthetic fixture'], 'synthetic.pdf', { type: 'application/pdf' }))
  const result = await lerFormularioLimitado(new Request('http://localhost/api/contas-pagar', { method: 'POST', body: form }))
  assert.equal(result.get('descricao'), 'Synthetic invoice')
  assert.equal(result.get('boleto').name, 'synthetic.pdf')
  assert.equal(await result.get('boleto').text(), '%PDF-1.7\nsynthetic fixture')
  assert.equal(limiteCorpoRequisicao('/api/contas-pagar'), 6 * 1024 * 1024)
  assert.equal(limiteCorpoRequisicao('/api/relatorios/arquivos'), 11 * 1024 * 1024)
  assert.equal(limiteCorpoRequisicao('/api/auth/login'), 2 * 1024 * 1024)
})

async function zip(extraName, text) {
  const archive = new JSZip()
  archive.file('[Content_Types].xml', '<Types/>')
  archive.file('xl/workbook.xml', '<workbook/>')
  if (extraName) archive.file(extraName, text)
  return archive.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
}

test('malformed multipart is reported as invalid input, without a server error', async () => {
  const request = new Request('http://localhost/api/contas-pagar', { method: 'POST', headers: { 'Content-Type': 'multipart/form-data' }, body: 'invalid multipart without a boundary' })
  await assert.rejects(lerFormularioLimitado(request), error => error instanceof RequestBodyError && error.status === 400)
})

test('XLSX rejects macros, external relationships, XML entities and embedded files', async () => {
  for (const [name, text] of [
    ['xl/vbaProject.bin', 'macro'], ['xl/embeddings/object.bin', 'embedded'],
    ['xl/_rels/workbook.xml.rels', '<Relationship TargetMode="External" Target="https://example.invalid/"/>'],
    ['xl/workbook-other.xml', '<!DOCTYPE x [<!ENTITY attack SYSTEM "file:///private">]><x/>'],
  ]) {
    const buffer = await zip(name, text)
    assert.throws(() => verificarPacoteXlsx(buffer))
  }
})

test('compressed bombs remain bounded even when decompressed size metadata lies', async () => {
  const archive = await zip('xl/sharedStrings.xml', 'a'.repeat(100000))
  assert.ok(archive.length < 8192)
  assert.throws(() => verificarPacoteXlsx(archive, 8192))
  const forged = Buffer.from(archive)
  for (let offset = 0; offset < forged.length - 46; offset++) {
    if (forged.readUInt32LE(offset) === 0x02014b50 && forged.readUInt32LE(offset + 24) > 8192) forged.writeUInt32LE(1, offset + 24)
  }
  assert.throws(() => verificarPacoteXlsx(forged, 8192))
})

test('a script disguised as a JPEG is rejected before any Storage operation', async () => {
  const { processarFotoMotorista, FotoMotoristaError } = loadTs('src/lib/motoristaFotos.ts', {
    '@/lib/supabaseAdmin': { getSupabaseAdmin: () => { throw new Error('Storage must not be accessed') } },
  })
  const file = new File(['<svg onload="alert(1)"><script>attack</script></svg>'], 'avatar.jpg', { type: 'image/jpeg' })
  await assert.rejects(processarFotoMotorista(file), error => error instanceof FotoMotoristaError && error.status === 415)
})

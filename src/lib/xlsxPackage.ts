import { inflateRawSync } from 'node:zlib'

// Preflight before ExcelJS allocates the workbook: bound actual decompressed
// bytes, not only ZIP metadata supplied by the uploader. ZIP64 is unnecessary
// for the small onboarding template and intentionally unsupported.
export function verificarPacoteXlsx(buffer: Buffer, maxBytes = 20 * 1024 * 1024) {
  let end = -1
  for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 65557); i--) {
    if (buffer.readUInt32LE(i) === 0x06054b50) { end = i; break }
  }
  if (end < 0 || buffer.readUInt16LE(end + 4) || buffer.readUInt16LE(end + 6)) throw new Error('Arquivo XLSX inválido.')
  const count = buffer.readUInt16LE(end + 10)
  let position = buffer.readUInt32LE(end + 16)
  if (count < 1 || count > 200 || position >= end) throw new Error('Planilha excede o limite de estrutura.')
  const files = new Map<string, Buffer>()
  let total = 0
  for (let i = 0; i < count; i++) {
    if (position + 46 > end || buffer.readUInt32LE(position) !== 0x02014b50) throw new Error('Arquivo XLSX inválido.')
    const flags = buffer.readUInt16LE(position + 8), method = buffer.readUInt16LE(position + 10)
    const size = buffer.readUInt32LE(position + 20), declared = buffer.readUInt32LE(position + 24)
    const nameLength = buffer.readUInt16LE(position + 28), extra = buffer.readUInt16LE(position + 30), comment = buffer.readUInt16LE(position + 32)
    const offset = buffer.readUInt32LE(position + 42)
    const name = buffer.subarray(position + 46, position + 46 + nameLength).toString('utf8')
    position += 46 + nameLength + extra + comment
    if (position > end || offset + 30 > buffer.length || buffer.readUInt32LE(offset) !== 0x04034b50 || flags & 1 || ![0, 8].includes(method) || declared > maxBytes || files.has(name) || /(^\/|\.\.|\\|vbaProject|externalLinks|embeddings)/i.test(name)) throw new Error('Planilha contém estrutura não permitida.')
    const start = offset + 30 + buffer.readUInt16LE(offset + 26) + buffer.readUInt16LE(offset + 28)
    if (start + size > buffer.length || total >= maxBytes) throw new Error('Arquivo XLSX inválido ou muito grande.')
    const compressed = buffer.subarray(start, start + size)
    const data = method === 8 ? inflateRawSync(compressed, { maxOutputLength: maxBytes - total }) : compressed
    total += data.length
    if (data.length !== declared || total > maxBytes) throw new Error('Planilha excede o limite de tamanho descompactado.')
    if (/\.xml$|\.rels$/.test(name) && /<!DOCTYPE|<!ENTITY|TargetMode\s*=\s*["']External/i.test(data.toString('utf8'))) throw new Error('Links externos e estruturas XML externas não são permitidos.')
    files.set(name, data)
  }
  if (!files.has('[Content_Types].xml') || !files.has('xl/workbook.xml')) throw new Error('Envie uma planilha XLSX válida.')
  return files
}

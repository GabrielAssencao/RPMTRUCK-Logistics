import 'server-only'

export const RELATORIOS_BUCKET = 'relatorios-privados'
export const RELATORIO_MAX_FILE_BYTES = 10 * 1024 * 1024
// Mantém margem para fotos, outros buckets e variações de contabilização no plano Free.
export const RELATORIOS_FREE_SOFT_LIMIT_BYTES = 700 * 1024 * 1024

export const RELATORIO_MIME_TYPES = {
  'application/pdf': 'pdf',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'text/csv': 'csv',
} as const

export type RelatorioMimeType = keyof typeof RELATORIO_MIME_TYPES

export function isRelatorioMimeType(value: string): value is RelatorioMimeType {
  return value in RELATORIO_MIME_TYPES
}

export function getRelatoriosSoftLimitBytes(): number {
  const configured = Number(process.env.RELATORIOS_STORAGE_SOFT_LIMIT_BYTES)
  return Number.isSafeInteger(configured) && configured > 0
    ? configured
    : RELATORIOS_FREE_SOFT_LIMIT_BYTES
}

export function sanitizarNomeArquivo(value: string): string {
  const nome = value
    .replace(/[\\/\u0000-\u001f\u007f]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()

  return (nome || 'relatorio').slice(0, 180)
}

export function validarConteudoRelatorio(buffer: Buffer, mimeType: RelatorioMimeType): boolean {
  if (buffer.length === 0) return false

  if (mimeType === 'application/pdf') {
    return buffer.subarray(0, 5).toString('ascii') === '%PDF-'
  }

  if (mimeType === 'application/vnd.ms-excel') {
    return buffer.subarray(0, 8).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]))
  }

  if (mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
    return buffer[0] === 0x50 && buffer[1] === 0x4b
  }

  return !buffer.includes(0) && !buffer.subarray(0, 1024).toString('utf8').includes('\uFFFD')
}

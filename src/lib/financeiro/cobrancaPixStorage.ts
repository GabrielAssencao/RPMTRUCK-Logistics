import 'server-only'
import { AntimalwareError, verificarPdf, verificarPdfArmazenado } from '@/lib/antimalware'

import { randomUUID } from 'node:crypto'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'

export const COBRANCAS_PIX_BUCKET = 'cobrancas-pix-privadas'
const PDF = 'application/pdf'
const IMAGENS = new Set(['image/png', 'image/jpeg', 'image/webp'])

export class ArquivoCobrancaPixError extends Error {
  constructor(message: string, public readonly status: number) { super(message) }
}

function assinaturaValida(conteudo: Buffer, mime: string) {
  if (mime === PDF) return conteudo.subarray(0, 5).toString('ascii') === '%PDF-'
  if (mime === 'image/png') return conteudo.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  if (mime === 'image/jpeg') return conteudo[0] === 0xff && conteudo[1] === 0xd8 && conteudo.at(-2) === 0xff && conteudo.at(-1) === 0xd9
  return mime === 'image/webp' && conteudo.subarray(0, 4).toString('ascii') === 'RIFF' && conteudo.subarray(8, 12).toString('ascii') === 'WEBP'
}

function extensao(mime: string) { return mime === PDF ? 'pdf' : mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg' }

export async function salvarArquivoCobrancaPix(arquivo: File, prefixo: string, finalidade: 'qr' | 'comprovante') {
  const permitido = finalidade === 'qr' ? IMAGENS.has(arquivo.type) : arquivo.type === PDF
  const maximo = finalidade === 'qr' ? 1024 * 1024 : 5 * 1024 * 1024
  if (!permitido) throw new ArquivoCobrancaPixError(finalidade === 'qr' ? 'Envie uma imagem PNG, JPG ou WebP.' : 'Envie o comprovante em PDF.', 415)
  if (arquivo.size <= 0 || arquivo.size > maximo) throw new ArquivoCobrancaPixError(`O arquivo deve ter no máximo ${maximo / 1024 / 1024} MB.`, 413)
  const conteudo = Buffer.from(await arquivo.arrayBuffer())
  if (!assinaturaValida(conteudo, arquivo.type)) throw new ArquivoCobrancaPixError('O conteúdo do arquivo não corresponde ao formato informado.', 415)
  let antimalwareVerificado = true
  if (arquivo.type === PDF) {
    try { antimalwareVerificado = await verificarPdf(conteudo) } catch (error) {
      if (error instanceof AntimalwareError) throw new ArquivoCobrancaPixError(error.message, error.status)
      throw error
    }
  }
  const caminho = `${prefixo}/${finalidade}-${randomUUID()}.${extensao(arquivo.type)}`
  const resultado = await getSupabaseAdmin().storage.from(COBRANCAS_PIX_BUCKET).upload(caminho, conteudo, { contentType: arquivo.type, cacheControl: '3600', upsert: false })
  if (resultado.error) throw new ArquivoCobrancaPixError('Não foi possível armazenar o arquivo privado.', 502)
  return { caminho, nome: arquivo.name.slice(0, 180), mime: arquivo.type, tamanho: arquivo.size, antimalwareVerificado }
}

export async function criarUrlAssinadaCobrancaPix(caminho: string, download?: string) {
  try { await verificarPdfArmazenado(COBRANCAS_PIX_BUCKET, caminho) } catch (error) {
    if (error instanceof AntimalwareError) throw new ArquivoCobrancaPixError(error.message, error.status)
    throw error
  }
  const resultado = await getSupabaseAdmin().storage.from(COBRANCAS_PIX_BUCKET).createSignedUrl(caminho, 60, download ? { download } : undefined)
  if (resultado.error || !resultado.data?.signedUrl) throw new ArquivoCobrancaPixError('Não foi possível liberar o arquivo privado.', 502)
  return resultado.data.signedUrl
}

export async function removerArquivoCobrancaPix(caminho: string | null | undefined) {
  if (!caminho) return
  const resultado = await getSupabaseAdmin().storage.from(COBRANCAS_PIX_BUCKET).remove([caminho])
  if (resultado.error) console.error('Falha ao remover arquivo Pix substituído:', resultado.error.message)
}

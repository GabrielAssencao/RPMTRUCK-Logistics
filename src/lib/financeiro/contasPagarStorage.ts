import 'server-only'

import { randomUUID } from 'node:crypto'
import { CONTA_PAGAR_MAX_FILE_BYTES, CONTAS_PAGAR_BUCKET } from '@/lib/financeiro/contasPagar'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'

const MIME_PERMITIDOS = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])

export class ArquivoContaPagarError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message)
    this.name = 'ArquivoContaPagarError'
  }
}

function extensaoPorMime(mime: string) {
  return mime === 'application/pdf' ? 'pdf' : mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg'
}

function assinaturaValida(conteudo: Buffer, mime: string) {
  if (mime === 'application/pdf') return conteudo.subarray(0, 5).toString('ascii') === '%PDF-'
  if (mime === 'image/png') return conteudo.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  if (mime === 'image/jpeg') return conteudo[0] === 0xff && conteudo[1] === 0xd8 && conteudo.at(-2) === 0xff && conteudo.at(-1) === 0xd9
  if (mime === 'image/webp') return conteudo.subarray(0, 4).toString('ascii') === 'RIFF' && conteudo.subarray(8, 12).toString('ascii') === 'WEBP'
  return false
}

export async function validarArquivoContaPagar(arquivo: File) {
  if (!MIME_PERMITIDOS.has(arquivo.type)) throw new ArquivoContaPagarError('Envie um PDF, JPG, PNG ou WebP.', 415)
  if (arquivo.size <= 0 || arquivo.size > CONTA_PAGAR_MAX_FILE_BYTES) throw new ArquivoContaPagarError('O arquivo deve ter no máximo 5 MB.', 413)
  const conteudo = Buffer.from(await arquivo.arrayBuffer())
  if (!assinaturaValida(conteudo, arquivo.type)) throw new ArquivoContaPagarError('O conteúdo do arquivo não corresponde ao formato informado.', 415)
  return conteudo
}

export async function salvarArquivoContaPagar(empresaId: string, contaId: string, tipo: 'boleto' | 'comprovante', arquivo: File) {
  const conteudo = await validarArquivoContaPagar(arquivo)
  const caminho = `${empresaId}/${contaId}/${tipo}-${randomUUID()}.${extensaoPorMime(arquivo.type)}`
  const resultado = await getSupabaseAdmin().storage.from(CONTAS_PAGAR_BUCKET).upload(caminho, conteudo, {
    contentType: arquivo.type,
    cacheControl: '3600',
    upsert: false,
  })
  if (resultado.error) {
    console.error('Erro ao armazenar documento financeiro:', resultado.error.message)
    throw new ArquivoContaPagarError('Não foi possível armazenar o documento no bucket privado.', 502)
  }
  return { caminho, nome: arquivo.name.slice(0, 180), mime: arquivo.type, tamanho: arquivo.size }
}

export async function removerArquivosContaPagar(caminhos: Array<string | null | undefined>) {
  const validos = caminhos.filter((item): item is string => Boolean(item))
  if (validos.length === 0) return
  const resultado = await getSupabaseAdmin().storage.from(CONTAS_PAGAR_BUCKET).remove(validos)
  if (resultado.error) console.error('Falha ao remover documento financeiro órfão:', resultado.error.message)
}

export async function criarUrlAssinadaContaPagar(caminho: string) {
  const resultado = await getSupabaseAdmin().storage.from(CONTAS_PAGAR_BUCKET).createSignedUrl(caminho, 60)
  if (resultado.error || !resultado.data?.signedUrl) throw new ArquivoContaPagarError('Não foi possível liberar o documento.', 502)
  return resultado.data.signedUrl
}

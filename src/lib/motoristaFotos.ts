import 'server-only'

import sharp from 'sharp'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'

export const MOTORISTAS_FOTOS_BUCKET = 'motoristas-fotos'
export const FOTO_MOTORISTA_MAX_INPUT_BYTES = 5 * 1024 * 1024
export const FOTO_MOTORISTA_MAX_OUTPUT_BYTES = 200 * 1024
export const FOTO_MOTORISTA_WIDTH = 480
export const FOTO_MOTORISTA_HEIGHT = 640
export const FOTO_MOTORISTA_MIN_WIDTH = 300
export const FOTO_MOTORISTA_MIN_HEIGHT = 400
export const FOTO_MOTORISTA_MAX_PIXELS = 20_000_000

const MIME_TYPES_PERMITIDOS = new Set(['image/jpeg', 'image/png', 'image/webp'])
const FORMATOS_PERMITIDOS = new Set(['jpeg', 'png', 'webp'])

export class FotoMotoristaError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message)
    this.name = 'FotoMotoristaError'
  }
}

export interface FotoMotoristaProcessada {
  conteudo: Buffer
  largura: number
  altura: number
  tamanho: number
}

export function caminhoFotoMotorista(empresaId: string, motoristaId: string) {
  return `${empresaId}/${motoristaId}/avatar.webp`
}

export async function processarFotoMotorista(arquivo: File): Promise<FotoMotoristaProcessada> {
  if (!MIME_TYPES_PERMITIDOS.has(arquivo.type)) {
    throw new FotoMotoristaError('Formato permitido: JPG, PNG ou WebP.', 415)
  }
  if (arquivo.size <= 0 || arquivo.size > FOTO_MOTORISTA_MAX_INPUT_BYTES) {
    throw new FotoMotoristaError('A foto deve ter no máximo 5 MB.', 413)
  }

  const original = Buffer.from(await arquivo.arrayBuffer())

  try {
    const imagem = sharp(original, {
      failOn: 'warning',
      limitInputPixels: FOTO_MOTORISTA_MAX_PIXELS,
    })
    const metadata = await imagem.metadata()

    if (!metadata.format || !FORMATOS_PERMITIDOS.has(metadata.format)) {
      throw new FotoMotoristaError('O conteúdo não corresponde a uma imagem JPG, PNG ou WebP válida.', 415)
    }

    const orientacaoRotacionada = metadata.orientation && metadata.orientation >= 5
    const larguraOriginal = orientacaoRotacionada ? metadata.height : metadata.width
    const alturaOriginal = orientacaoRotacionada ? metadata.width : metadata.height

    if (
      !larguraOriginal ||
      !alturaOriginal ||
      larguraOriginal < FOTO_MOTORISTA_MIN_WIDTH ||
      alturaOriginal < FOTO_MOTORISTA_MIN_HEIGHT
    ) {
      throw new FotoMotoristaError('Use uma foto vertical com pelo menos 300 × 400 pixels.', 422)
    }

    let conteudo = await imagem
      .rotate()
      .resize(FOTO_MOTORISTA_WIDTH, FOTO_MOTORISTA_HEIGHT, {
        fit: 'cover',
        position: sharp.strategy.attention,
      })
      .webp({ quality: 80, effort: 5 })
      .toBuffer()

    if (conteudo.length > FOTO_MOTORISTA_MAX_OUTPUT_BYTES) {
      conteudo = await sharp(conteudo)
        .webp({ quality: 68, effort: 6 })
        .toBuffer()
    }

    if (conteudo.length > FOTO_MOTORISTA_MAX_OUTPUT_BYTES) {
      throw new FotoMotoristaError('Não foi possível comprimir a foto para o tamanho seguro.', 422)
    }

    return {
      conteudo,
      largura: FOTO_MOTORISTA_WIDTH,
      altura: FOTO_MOTORISTA_HEIGHT,
      tamanho: conteudo.length,
    }
  } catch (error) {
    if (error instanceof FotoMotoristaError) throw error
    throw new FotoMotoristaError('A foto está corrompida ou utiliza um formato incompatível.', 415)
  }
}

export async function salvarFotoMotorista(
  empresaId: string,
  motoristaId: string,
  arquivo: File,
) {
  const foto = await processarFotoMotorista(arquivo)
  const caminho = caminhoFotoMotorista(empresaId, motoristaId)
  const supabase = getSupabaseAdmin()
  const upload = await supabase.storage.from(MOTORISTAS_FOTOS_BUCKET).upload(caminho, foto.conteudo, {
    contentType: 'image/webp',
    cacheControl: '3600',
    upsert: true,
  })

  if (upload.error) {
    console.error('Erro ao armazenar foto de motorista:', upload.error.message)
    throw new FotoMotoristaError('Não foi possível armazenar a foto. Confirme a configuração do bucket privado.', 502)
  }

  return { caminho, ...foto }
}

export async function removerFotoMotorista(caminho: string | null | undefined) {
  if (!caminho || caminho.startsWith('http://') || caminho.startsWith('https://')) return
  const resultado = await getSupabaseAdmin().storage.from(MOTORISTAS_FOTOS_BUCKET).remove([caminho])
  if (resultado.error) throw new Error(resultado.error.message)
}

export async function criarUrlsAssinadasFotos(caminhos: Array<string | null>) {
  const unicos = Array.from(new Set(
    caminhos.filter((caminho): caminho is string => Boolean(caminho && !caminho.startsWith('http'))),
  ))
  const urls = new Map<string, string>()
  if (unicos.length === 0) return urls

  try {
    const resultado = await getSupabaseAdmin().storage
      .from(MOTORISTAS_FOTOS_BUCKET)
      .createSignedUrls(unicos, 60 * 60)

    for (const item of resultado.data ?? []) {
      if (item.path && item.signedUrl) urls.set(item.path, item.signedUrl)
    }
    if (resultado.error) console.error('Erro ao assinar fotos de motoristas:', resultado.error.message)
  } catch (error) {
    console.error('Erro ao criar URLs temporárias das fotos:', error)
  }

  return urls
}

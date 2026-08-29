import { linhaDigitavelValida, somenteDigitosBoleto } from '@/lib/financeiro/contasPagar'

export interface DadosExtraidosBoleto {
  textoEncontrado: boolean
  codigoBarrasLido: boolean
  leitorVisualDisponivel: boolean
  linhaDigitavel: string
  valor: string
  vencimento: string
  fornecedor: string
  origemLeitura: 'PDF_TEXTO' | 'CODIGO_BARRAS'
}

interface ResultadoCodigoBarras {
  rawValue: string
}

interface FragmentoTextoPdf {
  texto: string
  pagina: number
  x: number
  y: number
}

interface LeitorCodigoBarras {
  detect(fonte: CanvasImageSource): Promise<ResultadoCodigoBarras[]>
}

interface ConstrutorLeitorCodigoBarras {
  new (opcoes?: { formats?: string[] }): LeitorCodigoBarras
}

function obterLeitorCodigoBarras() {
  const construtor = (globalThis as typeof globalThis & { BarcodeDetector?: ConstrutorLeitorCodigoBarras }).BarcodeDetector
  if (!construtor) return null
  try {
    return new construtor({ formats: ['itf', 'code_128'] })
  } catch {
    try {
      return new construtor()
    } catch {
      return null
    }
  }
}

function codigoBarrasDaLinhaDigitavel(linha: string) {
  if (linha.length !== 47) return linha.length === 44 ? linha : ''
  return `${linha.slice(0, 4)}${linha[32]}${linha.slice(33)}${linha.slice(4, 9)}${linha.slice(10, 20)}${linha.slice(21, 31)}`
}

function dataFatorVencimento(codigo: string) {
  if (codigo.length !== 44 || codigo.startsWith('8')) return ''
  const fator = Number(codigo.slice(5, 9))
  if (!Number.isInteger(fator) || fator < 1000) return ''

  // A FEBRABAN reiniciou o fator em 1000 em 22/02/2025. Boletos do ciclo
  // anterior ficam ambíguos e, por segurança, não são inferidos aqui.
  const baseNovoCiclo = Date.UTC(2022, 4, 29)
  const data = new Date(baseNovoCiclo + fator * 86_400_000)
  return data.toISOString().slice(0, 10)
}

function valorDoCodigoBarras(codigo: string) {
  if (codigo.length !== 44 || codigo.startsWith('8')) return ''
  const centavos = Number(codigo.slice(9, 19))
  return Number.isSafeInteger(centavos) && centavos > 0 ? (centavos / 100).toFixed(2) : ''
}

function dadosDoCodigoBarras(linhaOuCodigo: string) {
  const codigo = codigoBarrasDaLinhaDigitavel(linhaOuCodigo)
  return {
    valor: valorDoCodigoBarras(codigo),
    vencimento: dataFatorVencimento(codigo),
  }
}

function encontrarLinhaDigitavel(texto: string) {
  const sequencias = texto.match(/(?:\d[\s.\-]?){44,48}/g) ?? []
  return sequencias
    .map(somenteDigitosBoleto)
    .find((item) => [44, 47, 48].includes(item.length) && linhaDigitavelValida(item)) ?? ''
}

function encontrarLinhaDigitavelEmSegmentos(segmentos: string[]) {
  for (const segmento of segmentos) {
    const linha = encontrarLinhaDigitavel(segmento)
    if (linha) return linha
  }
  return ''
}

function fornecedorPorPosicao(fragmentos: FragmentoTextoPdf[]) {
  const candidatos: string[] = []
  const cabecalhos = fragmentos.filter((fragmento) => /^(?:benefici[áa]rio|favorecido|cedente)\s*:?$/i.test(fragmento.texto))

  for (const cabecalho of cabecalhos) {
    const proximoCabecalho = fragmentos
      .filter((fragmento) => fragmento.pagina === cabecalho.pagina && Math.abs(fragmento.y - cabecalho.y) < 2.5 && fragmento.x > cabecalho.x + 2)
      .sort((itemA, itemB) => itemA.x - itemB.x)[0]
    const limiteX = proximoCabecalho?.x ?? Number.POSITIVE_INFINITY
    const abaixo = fragmentos
      .filter((fragmento) => fragmento.pagina === cabecalho.pagina
        && fragmento.y < cabecalho.y
        && cabecalho.y - fragmento.y <= 20
        && fragmento.x >= cabecalho.x - 2
        && fragmento.x < limiteX - 2)
      .sort((itemA, itemB) => itemB.y - itemA.y || itemA.x - itemB.x)
    const primeiraLinhaY = abaixo[0]?.y
    if (primeiraLinhaY === undefined) continue
    const valor = abaixo
      .filter((fragmento) => Math.abs(fragmento.y - primeiraLinhaY) < 2.5)
      .map((fragmento) => fragmento.texto)
      .find((texto) => /[A-Za-zÀ-ÿ]{3}/.test(texto))
      ?.replace(/\s+/g, ' ')
      .trim()
    if (valor) candidatos.push(valor.slice(0, 160))
  }

  return candidatos.sort((valorA, valorB) => {
    const pontuar = (valor: string) => {
      let pontos = valor.replace(/[^A-Za-zÀ-ÿ]/g, '').length
      if (/\b(?:ltda|s\/?a|eireli|associa|univers|faculdade|escola)\b/i.test(valor)) pontos += 30
      if (/^(?:r\.?|rua|av\.?|avenida|rodovia|estrada|travessa|alameda)\s/i.test(valor) || /\d{5}[ -]?\d{3}/.test(valor)) pontos -= 60
      return pontos
    }
    return pontuar(valorB) - pontuar(valorA)
  })[0] ?? ''
}

function extrairCampos(
  texto: string,
  codigoVisual = '',
  leitorVisualDisponivel = false,
  segmentos: string[] = [],
  fragmentos: FragmentoTextoPdf[] = [],
): DadosExtraidosBoleto {
  // PDF.js pode entregar o código do banco e a linha digitável em itens vizinhos.
  // Avaliar cada item primeiro evita concatenar 237-2 com os 47 dígitos do boleto.
  const linhaTexto = encontrarLinhaDigitavelEmSegmentos(segmentos) || encontrarLinhaDigitavel(texto)
  const linha = codigoVisual || linhaTexto
  const dataComRotulo = texto.match(/(?:vencimento|data\s+de\s+vencimento)\D{0,24}(0[1-9]|[12]\d|3[01])[\/.\-](0[1-9]|1[0-2])[\/.\-](20\d{2})/i)
  const datas = [...texto.matchAll(/\b(0[1-9]|[12]\d|3[01])[\/.\-](0[1-9]|1[0-2])[\/.\-](20\d{2})\b/g)]
  const data = dataComRotulo ?? datas.at(-1)
  const valorComRotulo = texto.match(/(?:valor\s+(?:do\s+)?documento|valor\s+cobrado|valor)\D{0,30}(\d{1,3}(?:\.\d{3})*,\d{2})/i)
  const fornecedorComRotulo = texto.match(/(?:benefici[áa]rio|favorecido|cedente)\s*:?\s*(.{3,160}?)(?=\s+(?:cpf|cnpj|pagador|sacado|vencimento|valor|ag[eê]ncia|c[oó]digo)\b|$)/i)
  const dadosCodigo = dadosDoCodigoBarras(linha)
  const fornecedorPosicional = fornecedorPorPosicao(fragmentos)

  return {
    textoEncontrado: texto.trim().length > 0,
    codigoBarrasLido: Boolean(codigoVisual),
    leitorVisualDisponivel,
    linhaDigitavel: linha,
    valor: dadosCodigo.valor || valorComRotulo?.[1]?.replace(/\./g, '').replace(',', '.') || '',
    vencimento: dadosCodigo.vencimento || (data ? `${data[3]}-${data[2]}-${data[1]}` : ''),
    fornecedor: fornecedorPosicional || fornecedorComRotulo?.[1]?.replace(/\s+/g, ' ').trim() || '',
    origemLeitura: codigoVisual ? 'CODIGO_BARRAS' : 'PDF_TEXTO',
  }
}

async function detectarCodigoEmCanvas(canvas: HTMLCanvasElement, leitor: LeitorCodigoBarras | null) {
  if (leitor) {
    try {
      const resultados = await leitor.detect(canvas)
      const codigoNativo = resultados
        .map((resultado) => somenteDigitosBoleto(resultado.rawValue))
        .find((valor) => [44, 47, 48].includes(valor.length) && linhaDigitavelValida(valor))
      if (codigoNativo) return codigoNativo
    } catch {
      // O fallback abaixo cobre navegadores e plataformas sem implementação completa.
    }
  }

  try {
    const { BrowserMultiFormatOneDReader } = await import('@zxing/browser')
    const resultado = new BrowserMultiFormatOneDReader().decodeFromCanvas(canvas)
    const codigo = somenteDigitosBoleto(resultado.getText())
    return [44, 47, 48].includes(codigo.length) && linhaDigitavelValida(codigo) ? codigo : ''
  } catch {
    return ''
  }
}

export async function lerBoletoPdfLocalmente(arquivo: File): Promise<DadosExtraidosBoleto> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/legacy/build/pdf.worker.min.mjs', import.meta.url).toString()
  const tarefa = pdfjs.getDocument({ data: new Uint8Array(await arquivo.arrayBuffer()) })
  const pdf = await tarefa.promise
  const paginas: string[] = []
  const segmentos: string[] = []
  const fragmentos: FragmentoTextoPdf[] = []
  const leitor = obterLeitorCodigoBarras()
  let codigoVisual = ''

  try {
    const limite = Math.min(pdf.numPages, 5)
    for (let numero = 1; numero <= limite; numero += 1) {
      const pagina = await pdf.getPage(numero)
      const conteudo = await pagina.getTextContent()
      const itensPagina = conteudo.items.flatMap((item) => {
        if (!('str' in item) || !item.str.trim()) return []
        return [{ texto: item.str.trim(), pagina: numero, x: item.transform[4], y: item.transform[5] }]
      })
      segmentos.push(...itensPagina.map((item) => item.texto))
      fragmentos.push(...itensPagina)
      paginas.push(itensPagina.map((item) => item.texto).join(' '))

      const linhaJaEncontradaNoTexto = encontrarLinhaDigitavelEmSegmentos(segmentos)
      if (!codigoVisual && !linhaJaEncontradaNoTexto && numero <= 3) {
        const viewport = pagina.getViewport({ scale: 2 })
        const canvas = document.createElement('canvas')
        canvas.width = Math.ceil(viewport.width)
        canvas.height = Math.ceil(viewport.height)
        const contexto = canvas.getContext('2d', { willReadFrequently: true })
        if (contexto) {
          await pagina.render({ canvas, canvasContext: contexto, viewport }).promise
          codigoVisual = await detectarCodigoEmCanvas(canvas, leitor)
        }
        canvas.width = 1
        canvas.height = 1
      }
    }
    return extrairCampos(paginas.join('\n'), codigoVisual, true, segmentos, fragmentos)
  } finally {
    await tarefa.destroy()
  }
}

export async function lerCodigoBarrasImagemLocalmente(arquivo: File): Promise<DadosExtraidosBoleto> {
  const leitor = obterLeitorCodigoBarras()
  const bitmap = await createImageBitmap(arquivo)
  try {
    const canvas = document.createElement('canvas')
    canvas.width = bitmap.width
    canvas.height = bitmap.height
    const contexto = canvas.getContext('2d', { willReadFrequently: true })
    if (!contexto) return extrairCampos('', '', true)
    contexto.drawImage(bitmap, 0, 0)
    const codigo = await detectarCodigoEmCanvas(canvas, leitor)
    return extrairCampos('', codigo, true)
  } finally {
    bitmap.close()
  }
}

export const __testarExtracaoBoleto = extrairCampos
export const __testarDadosCodigoBarras = dadosDoCodigoBarras

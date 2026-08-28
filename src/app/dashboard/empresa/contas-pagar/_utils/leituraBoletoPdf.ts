import { linhaDigitavelValida, somenteDigitosBoleto } from '@/lib/financeiro/contasPagar'

export interface DadosExtraidosBoleto {
  textoEncontrado: boolean
  linhaDigitavel: string
  valor: string
  vencimento: string
  fornecedor: string
}

function extrairCampos(texto: string): DadosExtraidosBoleto {
  const sequencias = texto.match(/(?:\d[\s.\-]?){44,48}/g) ?? []
  const linha = sequencias
    .map(somenteDigitosBoleto)
    .find((item) => [44, 47, 48].includes(item.length) && linhaDigitavelValida(item)) ?? ''
  const datas = [...texto.matchAll(/\b(0[1-9]|[12]\d|3[01])[\/.\-](0[1-9]|1[0-2])[\/.\-](20\d{2})\b/g)]
  const data = datas.at(-1)
  const vencimento = data ? `${data[3]}-${data[2]}-${data[1]}` : ''
  const valorComRotulo = texto.match(/(?:valor\s+(?:do\s+)?documento|valor\s+cobrado|valor)\D{0,30}(\d{1,3}(?:\.\d{3})*,\d{2})/i)
  const fornecedorComRotulo = texto.match(/(?:benefici[áa]rio|favorecido|cedente)\s*:?\s*(.{3,160}?)(?=\s+(?:cpf|cnpj|pagador|sacado|vencimento|valor|ag[eê]ncia|c[oó]digo)\b|$)/i)
  const fornecedor = fornecedorComRotulo?.[1]?.trim() ?? ''

  return {
    textoEncontrado: texto.trim().length > 0,
    linhaDigitavel: linha,
    valor: valorComRotulo?.[1]?.replace(/\./g, '').replace(',', '.') ?? '',
    vencimento,
    fornecedor,
  }
}

export async function lerBoletoPdfLocalmente(arquivo: File): Promise<DadosExtraidosBoleto> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/legacy/build/pdf.worker.min.mjs', import.meta.url).toString()
  const tarefa = pdfjs.getDocument({ data: new Uint8Array(await arquivo.arrayBuffer()) })
  const pdf = await tarefa.promise
  const paginas: string[] = []
  const limite = Math.min(pdf.numPages, 5)
  for (let numero = 1; numero <= limite; numero += 1) {
    const pagina = await pdf.getPage(numero)
    const conteudo = await pagina.getTextContent()
    paginas.push(conteudo.items.map((item) => ('str' in item ? item.str : '')).join(' '))
  }
  await tarefa.destroy()
  return extrairCampos(paginas.join('\n'))
}

export const __testarExtracaoBoleto = extrairCampos

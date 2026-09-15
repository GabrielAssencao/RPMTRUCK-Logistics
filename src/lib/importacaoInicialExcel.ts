import 'server-only'
import ExcelJS from 'exceljs'
import { z } from 'zod'
import { nomeOperacional, nomePessoa, textoOperacional, placaSchema, dataIsoSchema, quilometragemSchema, valorMonetarioSchema, codigoContainerSchema, percentualSchema } from '@/lib/domainValidation'
import { cpfValido, normalizarDocumentoIdentidade } from '@/utils/documentos'
import { EXCEL_DATE, EXCEL_MONEY, formatarTabelaExcel } from '@/lib/excelFormatting'
import { verificarPacoteXlsx } from '@/lib/xlsxPackage'
import { normalizarRenavam, renavamValido } from '@/utils/renavam'

export const IMPORTACAO_MAX_BYTES = 2 * 1024 * 1024
export const IMPORTACAO_MAX_LINHAS = 1000
const opcional = <T extends z.ZodTypeAny>(schema: T) => z.preprocess(v => v === '' || v === undefined ? null : v, schema.nullable())
const placaOpcional = opcional(placaSchema)
const renavamOpcional = opcional(
  z.string({ invalid_type_error: 'Preencha o RENAVAM como texto, preservando os zeros iniciais.' })
    .trim()
    .transform(normalizarRenavam)
    .pipe(z.string().length(11, 'Preencha o RENAVAM com 11 dígitos.').refine(renavamValido, 'RENAVAM inválido.')),
)
const documento = z.string({ invalid_type_error: 'Preencha o CPF como texto, preservando os zeros iniciais.' }).trim().transform(v => v.replace(/[.\s-]/g, '')).pipe(z.string().regex(/^\d{11}$/, 'Preencha o CPF como texto, com 11 dígitos.').refine(cpfValido, 'CPF inválido.'))
const cnh = z.string({ invalid_type_error: 'Preencha a CNH como texto, preservando os zeros iniciais.' }).trim().regex(/^[\d.\s-]+$/).transform(v => v.replace(/\D/g, '')).pipe(z.string().regex(/^\d{9,11}$/, 'Preencha a CNH como texto, com 9 a 11 dígitos.'))
const data = z.preprocess(v => {
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  if (typeof v === 'string' && /^\d{2}\/\d{2}\/\d{4}$/.test(v)) return v.split('/').reverse().join('-')
  return v
}, dataIsoSchema)
const categorias = ['COMBUSTIVEL', 'MANUTENCAO', 'PEDAGIO', 'ALIMENTACAO', 'DIARIA_MOTORISTA', 'SEGURO', 'SALARIO', 'COMISSAO_TRANSPORTE', 'OUTROS'] as const

export const schemasImportacao = {
  Localizacoes: z.object({ nome: nomeOperacional(2, 160), cidadeUF: nomeOperacional(2, 100), capacidade: z.coerce.number().int().min(0).max(100000) }).strict(),
  Veiculos: z.object({ modelo: nomeOperacional(2, 100), placa: placaSchema, renavam: renavamOpcional, tipo: z.enum(['Cavalo Mecânico', 'Bitrem', 'Sider', 'Baú', 'Refrigerado']), ano: opcional(z.coerce.number().int().min(1950).max(new Date().getFullYear() + 1)), quilometragem: quilometragemSchema, status: z.enum(['OPERACIONAL', 'OFICINA', 'INATIVO']), localizacao: opcional(nomeOperacional(2, 160)) }).strict(),
  Motoristas: z.object({ nome: nomePessoa(3, 120), cpf: documento, rg: opcional(z.string().transform(normalizarDocumentoIdentidade).pipe(z.string().regex(/^[A-Z0-9]{7,14}$/))), cnh, categoria: z.enum(['A', 'B', 'C', 'D', 'E', 'AB', 'AC', 'AD', 'AE']), validade: data, status: z.enum(['DISPONIVEL', 'EM_ROTA', 'ALERTA', 'FERIAS']), placa: placaOpcional }).strict(),
  Custos: z.object({ data, categoria: z.enum(categorias), descricao: textoOperacional(3, 500), valor: valorMonetarioSchema.positive(), formaPagamento: nomeOperacional(2, 80), status: z.enum(['PAGO', 'PENDENTE']), placa: placaSchema, cpfMotorista: opcional(documento) }).strict(),
  Manutencoes: z.object({ data: data, conclusao: opcional(data), tipo: z.enum(['PREVENTIVA', 'CORRETIVA', 'PNEUS', 'OLEO']), descricao: textoOperacional(3, 500), pecas: opcional(textoOperacional(1, 2000)), custo: valorMonetarioSchema, quilometragem: quilometragemSchema, status: z.enum(['PENDENTE', 'CONCLUIDA', 'CANCELADA', 'NAO_REALIZADA']), placa: placaSchema }).strict().refine(v => v.status !== 'CONCLUIDA' || Boolean(v.conclusao), { path: ['conclusao'], message: 'Informe a data de conclusão.' }).refine(v => !v.conclusao || v.conclusao >= v.data, { path: ['conclusao'], message: 'A conclusão deve ocorrer a partir da data agendada.' }),
  Containers: z.object({ data, codigo: codigoContainerSchema, tipo: z.enum(['20 PÉS', '40 PÉS', '40 HC', 'REEFER', 'TANQUE', 'OUTRO']), origem: nomeOperacional(2, 160), destino: nomeOperacional(2, 160), frete: valorMonetarioSchema, comissaoAtiva: z.preprocess(v => typeof v === 'boolean' ? v ? 'SIM' : 'NAO' : v, z.enum(['SIM', 'NAO'])).transform(v => v === 'SIM'), percentualComissao: percentualSchema, status: z.enum(['AGENDADO', 'EM_TRANSITO', 'ENTREGUE', 'CANCELADO']), observacoes: opcional(textoOperacional(1, 2000)), placa: placaSchema, cpfMotorista: opcional(documento) }).strict().refine(v => v.origem.toLowerCase() !== v.destino.toLowerCase(), { path: ['destino'], message: 'Origem e destino devem ser diferentes.' }),
}
export type AbaImportacao = keyof typeof schemasImportacao
export const ABAS_IMPORTACAO = Object.keys(schemasImportacao) as AbaImportacao[]
export const loteImportacaoSchema = z.object({
  Localizacoes: z.array(schemasImportacao.Localizacoes), Veiculos: z.array(schemasImportacao.Veiculos),
  Motoristas: z.array(schemasImportacao.Motoristas), Custos: z.array(schemasImportacao.Custos),
  Manutencoes: z.array(schemasImportacao.Manutencoes), Containers: z.array(schemasImportacao.Containers),
}).strict()
export type LoteImportacao = z.infer<typeof loteImportacaoSchema>
export interface ErroImportacao { aba: string; linha: number; campo: string; mensagem: string }
export class PlanilhaImportacaoError extends Error {
  constructor(message: string, public readonly erros: ErroImportacao[] = []) { super(message) }
}

const COLUNAS: Record<AbaImportacao, string[]> = {
  Localizacoes: ['nome', 'cidadeUF', 'capacidade'],
  Veiculos: ['modelo', 'placa', 'renavam', 'tipo', 'ano', 'quilometragem', 'status', 'localizacao'],
  Motoristas: ['nome', 'cpf', 'rg', 'cnh', 'categoria', 'validade', 'status', 'placa'],
  Custos: ['data', 'categoria', 'descricao', 'valor', 'formaPagamento', 'status', 'placa', 'cpfMotorista'],
  Manutencoes: ['data', 'conclusao', 'tipo', 'descricao', 'pecas', 'custo', 'quilometragem', 'status', 'placa'],
  Containers: ['data', 'codigo', 'tipo', 'origem', 'destino', 'frete', 'comissaoAtiva', 'percentualComissao', 'status', 'observacoes', 'placa', 'cpfMotorista'],
}
const OPCOES: Record<string, string[]> = {
  'Veiculos.tipo': ['Cavalo Mecânico', 'Bitrem', 'Sider', 'Baú', 'Refrigerado'], 'Veiculos.status': ['OPERACIONAL', 'OFICINA', 'INATIVO'],
  'Motoristas.categoria': ['A', 'B', 'C', 'D', 'E', 'AB', 'AC', 'AD', 'AE'], 'Motoristas.status': ['DISPONIVEL', 'EM_ROTA', 'ALERTA', 'FERIAS'],
  'Custos.categoria': [...categorias], 'Custos.status': ['PAGO', 'PENDENTE'],
  'Manutencoes.tipo': ['PREVENTIVA', 'CORRETIVA', 'PNEUS', 'OLEO'], 'Manutencoes.status': ['PENDENTE', 'CONCLUIDA', 'CANCELADA', 'NAO_REALIZADA'],
  'Containers.tipo': ['20 PÉS', '40 PÉS', '40 HC', 'REEFER', 'TANQUE', 'OUTRO'], 'Containers.status': ['AGENDADO', 'EM_TRANSITO', 'ENTREGUE', 'CANCELADO'], 'Containers.comissaoAtiva': ['SIM', 'NAO'],
}

export async function gerarModeloImportacao(nomeEmpresa: string) {
  const book = new ExcelJS.Workbook()
  book.creator = 'RPMTruck'
  const instructions = book.addWorksheet('Instrucoes')
  instructions.columns = [{ header: 'ETAPA', width: 28 }, { header: 'COMO PREENCHER', width: 100 }]
  ;[
    ['Empresa', nomeEmpresa], ['1. Preencha', 'Use as seis abas de dados. Deixe vazias as abas que não deseja importar. Não renomeie abas ou cabeçalhos.'],
    ['2. Referências', 'Relacione dados pela placa do veículo, CPF do motorista e nome da localização. Use cadastros da planilha ou já existentes nesta empresa.'],
    ['3. Documentos', 'CPF e CNH devem ser texto: preserve todos os dígitos, inclusive zeros iniciais. Não use fórmulas, links, macros ou imagens.'],
    ['4. Datas e valores', 'Datas: DD/MM/AAAA ou AAAA-MM-DD. Valores: números, sem escrever R$. Não informe estimativas como se fossem dados reais.'],
    ['5. Limites', 'Até 1.000 registros no total e arquivo de até 2 MB. A frota deve respeitar as vagas contratadas. Custos e operações devem caber no histórico do plano.'],
    ['6. Manutenção', 'Informe a conclusão somente para serviços efetivamente realizados. Evite lançar o mesmo gasto nas abas Custos e Manutencoes.'],
    ['7. Comissões', 'Containers com comissão ativa geram a despesa correspondente automaticamente. Não repita essa comissão na aba Custos.'],
    ['8. Revisão', 'Envie pelo sistema e aguarde o superadmin. Nenhum cadastro será alterado até a aprovação. Registros existentes não serão sobrescritos.'],
    ['9. Uso único', 'Uma importação inicial aprovada por empresa. Se houver reprovação, corrija o arquivo e reenvie; isso não consome o benefício.'],
    ['Formato', 'RPMTruck Importação Inicial 1.0'],
  ].forEach(row => instructions.addRow(row))
  formatarTabelaExcel(instructions)
  const guide = book.addWorksheet('Guia de campos')
  guide.columns = [{ header: 'ABA', width: 22 }, { header: 'CAMPO', width: 24 }, { header: 'PREENCHIMENTO', width: 80 }]
  const optionalFields = ['Veiculos.renavam', 'Veiculos.ano', 'Veiculos.localizacao', 'Motoristas.rg', 'Motoristas.placa', 'Custos.cpfMotorista', 'Manutencoes.conclusao', 'Manutencoes.pecas', 'Containers.observacoes', 'Containers.cpfMotorista']
  const examples: Record<string, string> = { nome: 'Garagem Central (localização) / Thiago Lima (motorista)', cidadeUF: 'Santos / SP', capacidade: '20', modelo: 'Volvo FH 540', placa: 'ABC1D23', renavam: '11 dígitos válidos; preserve zeros iniciais.', ano: '2022', quilometragem: '125000', localizacao: 'Garagem Central', cpf: 'Somente 11 dígitos, com CPF válido; preserve zeros iniciais.', cpfMotorista: 'CPF do motorista cadastrado ou preenchido na aba Motoristas.', rg: '123456789', cnh: '01234567890', validade: '31/12/2027', data: '14/09/2026', conclusao: '15/09/2026 (obrigatório para manutenção concluída)', descricao: 'Abastecimento / Troca de óleo', valor: '350,50 (digite como número)', custo: '350,50 (digite como número)', frete: '2500,00 (digite como número)', formaPagamento: 'PIX', pecas: 'Filtro e óleo', codigo: 'ABCD 123456-7', origem: 'Terminal Santos', destino: 'Garagem Central', percentualComissao: '10 (equivale a 10%)', observacoes: 'Observações sobre a operação' }
  for (const name of ABAS_IMPORTACAO) for (const field of COLUNAS[name]) guide.addRow([name, field, `${optionalFields.includes(`${name}.${field}`) ? 'Opcional' : 'Obrigatório'}. ${OPCOES[`${name}.${field}`]?.join(' / ') ?? examples[field] ?? 'Use texto conforme o cadastro.'}`])
  formatarTabelaExcel(guide)
  for (const name of ABAS_IMPORTACAO) {
    const sheet = book.addWorksheet(name)
    sheet.columns = COLUNAS[name].map(key => ({ header: key, key, width: /descricao|observacoes|pecas/.test(key) ? 50 : 24 }))
    for (let row = 2; row <= 31; row++) sheet.addRow(COLUNAS[name].map(() => null))
    formatarTabelaExcel(sheet)
    for (const key of COLUNAS[name]) {
      const column = sheet.getColumn(key)
      column.numFmt = /data|validade|conclusao/.test(key) ? EXCEL_DATE : /^(valor|custo|frete)$/.test(key) ? EXCEL_MONEY : /^(capacidade|ano|quilometragem|percentualComissao)$/.test(key) ? '0.00' : '@'
      const options = OPCOES[`${name}.${key}`]
      sheet.getCell(1, column.number).note = options ? `Valores permitidos: ${options.join(', ')}` : `Campo ${key}. Consulte a aba Instrucoes.`
      if (options) for (let row = 2; row <= 1001; row++) sheet.getCell(row, column.number).dataValidation = { type: 'list', allowBlank: true, formulae: [`"${options.join(',')}"`], showErrorMessage: true, errorTitle: 'Valor inválido', error: 'Escolha uma opção da lista.' }
    }
  }
  return Buffer.from(await book.xlsx.writeBuffer())
}

export async function lerPlanilhaImportacao(buffer: Buffer): Promise<LoteImportacao> {
  if (!buffer.length || buffer.length > IMPORTACAO_MAX_BYTES) throw new PlanilhaImportacaoError('Envie um arquivo XLSX de até 2 MB.')
  try {
    const files = verificarPacoteXlsx(buffer)
    for (const [name, contents] of files) {
      if (!/^xl\/worksheets\/sheet\d+\.xml$/.test(name)) continue
      const xml = contents.toString('utf8')
      if ((xml.match(/<row\b/g)?.length ?? 0) > 1100 || (xml.match(/<c\b/g)?.length ?? 0) > 15000) throw new Error('Too many cells')
      for (const match of xml.matchAll(/\br=["']([A-Za-z]*)(\d+)["']/g)) {
        const column = [...match[1].toUpperCase()].reduce((sum, char) => sum * 26 + char.charCodeAt(0) - 64, 0)
        if (Number(match[2]) > 1100 || column > 12) throw new Error('Worksheet dimensions exceeded')
      }
    }
  } catch { throw new PlanilhaImportacaoError('Arquivo inválido, muito grande ou com conteúdo não permitido. Use o modelo do sistema.') }
  const book = new ExcelJS.Workbook()
  try { await book.xlsx.load(new Uint8Array(buffer).buffer) } catch { throw new PlanilhaImportacaoError('Não foi possível abrir a planilha. Baixe e preencha um novo modelo.') }
  if (book.worksheets.some(s => ![...ABAS_IMPORTACAO, 'Instrucoes', 'Guia de campos'].includes(s.name))) throw new PlanilhaImportacaoError('Use somente as abas do modelo original.')
  const output: Record<string, unknown[]> = {}, errors: ErroImportacao[] = []
  let total = 0
  for (const name of ABAS_IMPORTACAO) {
    const sheet = book.getWorksheet(name)
    if (!sheet || COLUNAS[name].some((key, index) => sheet.getCell(1, index + 1).value !== key) || sheet.columnCount > COLUNAS[name].length || sheet.rowCount > 1001) throw new PlanilhaImportacaoError(`Aba ${name}: mantenha os cabeçalhos originais e até 1.000 linhas de dados.`)
    output[name] = []
    sheet.eachRow((row, number) => {
      if (number === 1 || row.actualCellCount === 0) return
      const values: Record<string, unknown> = {}
      let hasData = false, structural = false
      COLUNAS[name].forEach((key, index) => {
        const value = row.getCell(index + 1).value
        if (value !== null && value !== '' && value !== undefined) hasData = true
        if (value && typeof value === 'object' && !(value instanceof Date)) { structural = true; errors.push({ aba: name, linha: number, campo: key, mensagem: 'Fórmulas, links e conteúdo composto não são permitidos.' }) }
        values[key] = value ?? ''
      })
      if (!hasData) return
      total++
      if (structural || errors.length > 100) return
      const parsed = schemasImportacao[name].safeParse(values)
      if (!parsed.success) parsed.error.issues.forEach(issue => errors.push({ aba: name, linha: number, campo: String(issue.path[0] ?? ''), mensagem: issue.message }))
      else output[name].push(parsed.data)
    })
  }
  if (total < 1 || total > IMPORTACAO_MAX_LINHAS) throw new PlanilhaImportacaoError('Preencha de 1 a 1.000 registros no total.')
  if (errors.length) throw new PlanilhaImportacaoError('Corrija os campos indicados e envie novamente.', errors.slice(0, 100))
  return loteImportacaoSchema.parse(output)
}

import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import test from 'node:test'
import ExcelJS from 'exceljs'
import { loadTs } from './helpers/load-ts.mjs'

const { gerarBackupEmpresaExcel } = loadTs('src/lib/empresaBackupExcel.ts')
const { gerarRelatorioOperacionalExcel } = loadTs('src/lib/relatoriosExcel.ts')
const { gerarModeloImportacao, lerPlanilhaImportacao, PlanilhaImportacaoError } = loadTs('src/lib/importacaoInicialExcel.ts')
const { verificarPacoteXlsx } = loadTs('src/lib/xlsxPackage.ts')
async function reopen(bytes) { const book = new ExcelJS.Workbook(); await book.xlsx.load(new Uint8Array(bytes).buffer); return book }
async function fixture(name, bytes) { if (process.env.RPM_EXCEL_FIXTURES === '1') { await mkdir('test-results/excel', { recursive: true }); await writeFile(`test-results/excel/${name}.xlsx`, bytes) } }

test('backup XLSX conserva documentos, datas, números e alturas ao reabrir', async () => {
  const bytes = await gerarBackupEmpresaExcel([{ nome: 'Dados', linhas: [{ cpf: '01234567890', linha_digitavel: '00190000000000000000000000000000000000000000000', valor: 1234.56, data: new Date('2026-09-14T12:00:00Z'), descricao: 'Primeira linha\n' + 'Descrição extensa para testar quebra de linha e altura. '.repeat(30), anotacao: '=HYPERLINK("https://example.invalid")' }] }, { nome: 'dados', linhas: [{ nome: 'Teste' }] }])
  const book = await reopen(bytes), sheet = book.worksheets[0]
  assert.equal(book.worksheets[1].name.toLowerCase(), 'dados 2')
  assert.equal(sheet.getCell('A2').value, '01234567890')
  assert.equal(sheet.getCell('A2').numFmt, '@')
  assert.equal(sheet.getCell('C2').value, 1234.56)
  assert.match(sheet.getCell('C2').numFmt, /R\$/)
  assert.equal(sheet.getCell('D2').value.toISOString(), '2026-09-14T12:00:00.000Z')
  assert.equal(sheet.getCell('D2').numFmt, 'dd/mm/yyyy')
  assert.ok(sheet.getRow(2).height > 60 && sheet.getRow(2).height <= 409)
  assert.equal(sheet.getCell('F2').type, ExcelJS.ValueType.String)
  assert.equal(sheet.views[0].ySplit, 1)
  assert.ok(sheet.autoFilter)
  assert.ok(verificarPacoteXlsx(bytes).has('xl/styles.xml'))
  await fixture('backup-formatado', bytes)
})

test('relatório XLSX preserva texto extenso, células mescladas e valores ao reabrir', async () => {
  const date = new Date('2026-09-14T12:00:00Z')
  const report = await gerarRelatorioOperacionalExcel({ arquivoId: 'demonstracao', empresa: { nome: 'Transportadora de Demonstração com Nome Extenso', cnpj: '00000000000000', plano: 'ENTERPRISE' }, periodoInicio: date, periodoFim: date, geradoEm: date, geradoPor: 'Usuário de Demonstração', movimentacoesPermanentes: [], containers: [], manutencoes: [], custos: [{ data: date, categoria: 'COMBUSTIVEL', descricao: 'Descrição longa com informações sobre o abastecimento. '.repeat(20), valor: 1234.56, formaPagamento: 'PIX', status: 'PAGO', veiculo: { placa: 'ABC1D23', modelo: 'Volvo FH' }, motorista: null }] })
  const book = await reopen(report.conteudo)
  assert.ok(book.getWorksheet('Resumo mensal').model.merges.includes('A1:F2'))
  assert.ok(book.getWorksheet('Custos').getRow(2).height > 60)
  assert.equal(book.getWorksheet('Custos').getCell('F2').value, 1234.56)
  const details = book.getWorksheet('Textos completos')
  assert.ok(details)
  assert.equal(details.getRows(2, details.rowCount - 1).filter(row => row.getCell(1).value === 'Custos' && row.getCell(2).value === 'E2').map(row => row.getCell(4).value).join(''), 'Descrição longa com informações sobre o abastecimento. '.repeat(20))
  verificarPacoteXlsx(report.conteudo)
  await fixture('relatorio-formatado', report.conteudo)
})

async function filledTemplate() {
  const book = await reopen(await gerarModeloImportacao('Empresa de Demonstração'))
  book.getWorksheet('Localizacoes').getRow(2).values = ['Garagem Central', 'Santos / SP', 20]
  book.getWorksheet('Veiculos').getRow(2).values = ['Volvo FH', 'ABC1D23', 'Cavalo Mecânico', 2022, 125000, 'OPERACIONAL', 'Garagem Central']
  book.getWorksheet('Motoristas').getRow(2).values = ['Thiago Lima', '52998224725', '', '01234567890', 'E', '31/12/2027', 'DISPONIVEL', 'ABC1D23']
  return book
}
test('modelo de importação reabre e preserva CNH com zero, datas brasileiras e referências', async () => {
  const bytes = await gerarModeloImportacao('Empresa de Demonstração')
  const model = await reopen(bytes)
  assert.equal(model.getWorksheet('Motoristas').getCell('D2').numFmt, '@')
  assert.equal(model.getWorksheet('Veiculos').getCell('C2').dataValidation.type, 'list')
  const book = await filledTemplate()
  const lote = await lerPlanilhaImportacao(Buffer.from(await book.xlsx.writeBuffer()))
  assert.equal(lote.Veiculos[0].placa, 'ABC1D23')
  assert.equal(lote.Motoristas[0].cnh, '01234567890')
  assert.equal(lote.Motoristas[0].validade, '2027-12-31')
  assert.deepEqual(lote.Custos, [])
  await fixture('modelo-importacao', bytes)
})
test('importação rejeita fórmulas, CPF inválido, cabeçalhos alterados e arquivos estranhos', async () => {
  const book = await filledTemplate()
  book.getWorksheet('Veiculos').getCell('A2').value = { formula: '1+1', result: 2 }
  await assert.rejects(lerPlanilhaImportacao(Buffer.from(await book.xlsx.writeBuffer())), error => error instanceof PlanilhaImportacaoError && error.erros.some(x => x.campo === 'modelo'))
  const other = await filledTemplate()
  other.getWorksheet('Motoristas').getCell('B2').value = '11111111111'
  await assert.rejects(lerPlanilhaImportacao(Buffer.from(await other.xlsx.writeBuffer())), error => error.erros.some(x => x.campo === 'cpf'))
  other.getWorksheet('Veiculos').getCell('A1').value = 'empresaId'
  await assert.rejects(lerPlanilhaImportacao(Buffer.from(await other.xlsx.writeBuffer())))
  await assert.rejects(lerPlanilhaImportacao(Buffer.from('<html>Not XLSX</html>')))
  await assert.rejects(lerPlanilhaImportacao(Buffer.alloc(2 * 1024 * 1024 + 1)))
})

test('backup fraciona campos acima dos limites do Excel sem perder conteúdo', async () => {
  const text = ('Linha de dados\n').repeat(600) + 'x'.repeat(40000)
  const bytes = await gerarBackupEmpresaExcel([{ nome: 'Texto extenso', linhas: [{ texto: text }] }])
  const book = await reopen(bytes), row = book.worksheets[0].getRow(2)
  let restored = ''
  row.eachCell(cell => { assert.ok(cell.value.length <= 30000); assert.ok(cell.value.split('\n').length <= 251); restored += cell.value })
  assert.equal(restored, text)
})

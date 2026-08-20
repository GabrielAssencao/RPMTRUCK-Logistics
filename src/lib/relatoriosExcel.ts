import 'server-only'

import { createHash } from 'node:crypto'
import ExcelJS from 'exceljs'

interface EmpresaRelatorio {
  nome: string
  cnpj: string | null
  plano: string
}

interface ContainerRelatorio {
  data: Date
  codigo: string
  tipo: string
  terminal_inicio: string
  terminal_fim: string
  frete: number
  comissao: number
  status: string
  observacoes: string | null
  veiculo: { placa: string; modelo: string }
  motorista: { nome: string } | null
}

interface CustoRelatorio {
  data: Date
  categoria: string
  descricao: string
  valor: number
  formaPagamento: string
  status: string
  veiculo: { placa: string; modelo: string }
  motorista: { nome: string } | null
}

interface ManutencaoRelatorio {
  data_agendada: Date
  data_conclusao: Date | null
  tipo: string
  descricao: string | null
  pecas_substituidas: string | null
  custo: number
  km_atual: number
  status: string
  veiculo: { placa: string; modelo: string }
}

export interface DadosRelatorioOperacional {
  arquivoId: string
  empresa: EmpresaRelatorio
  periodoInicio: Date
  periodoFim: Date
  geradoEm: Date
  geradoPor: string
  containers: ContainerRelatorio[]
  custos: CustoRelatorio[]
  manutencoes: ManutencaoRelatorio[]
}

const CORES = {
  azul: 'FF00C2D7',
  amarelo: 'FFF2C94C',
  cinza: 'FFE5E7EB',
  escuro: 'FF111827',
  branco: 'FFFFFFFF',
  verde: 'FFD1FAE5',
}

const moeda = 'R$ #,##0.00'
const dataFormato = 'dd/mm/yyyy'

function aplicarCabecalho(linha: ExcelJS.Row, cor: string) {
  linha.font = { bold: true, color: { argb: CORES.escuro } }
  linha.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: cor } }
  linha.alignment = { vertical: 'middle', horizontal: 'center' }
  linha.height = 22
  linha.eachCell((celula) => {
    celula.border = {
      top: { style: 'thin', color: { argb: CORES.escuro } },
      left: { style: 'thin', color: { argb: CORES.escuro } },
      bottom: { style: 'thin', color: { argb: CORES.escuro } },
      right: { style: 'thin', color: { argb: CORES.escuro } },
    }
  })
}

function prepararTabela(planilha: ExcelJS.Worksheet, colunas: Partial<ExcelJS.Column>[], cor = CORES.azul) {
  planilha.columns = colunas
  aplicarCabecalho(planilha.getRow(1), cor)
  planilha.views = [{ state: 'frozen', ySplit: 1 }]
  planilha.autoFilter = { from: 'A1', to: `${planilha.getColumn(colunas.length).letter}1` }
  planilha.properties.defaultRowHeight = 18
}

function estilizarLinhas(planilha: ExcelJS.Worksheet) {
  planilha.eachRow((linha, numero) => {
    if (numero === 1) return
    linha.alignment = { vertical: 'middle' }
    linha.eachCell((celula) => {
      celula.border = {
        top: { style: 'hair', color: { argb: 'FF9CA3AF' } },
        left: { style: 'hair', color: { argb: 'FF9CA3AF' } },
        bottom: { style: 'hair', color: { argb: 'FF9CA3AF' } },
        right: { style: 'hair', color: { argb: 'FF9CA3AF' } },
      }
    })
  })
}

function dataIso(data: Date) {
  return data.toISOString().slice(0, 10)
}

export async function gerarRelatorioOperacionalExcel(dados: DadosRelatorioOperacional) {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'RPMTruck'
  workbook.company = dados.empresa.nome
  workbook.created = dados.geradoEm
  workbook.modified = dados.geradoEm
  workbook.calcProperties.fullCalcOnLoad = true

  const abastecimentos = dados.custos.filter((custo) => custo.categoria === 'COMBUSTIVEL')
  const totalFrete = dados.containers.reduce((total, container) => total + container.frete, 0)
  const totalComissao = dados.containers.reduce((total, container) => total + container.comissao, 0)
  const totalCustos = dados.custos.reduce((total, custo) => total + custo.valor, 0)
  const totalManutencoes = dados.manutencoes.reduce((total, manutencao) => total + manutencao.custo, 0)

  const checksumDados = createHash('sha256').update(JSON.stringify({
    arquivoId: dados.arquivoId,
    empresa: dados.empresa,
    periodoInicio: dataIso(dados.periodoInicio),
    periodoFim: dataIso(dados.periodoFim),
    containers: dados.containers,
    custos: dados.custos,
    manutencoes: dados.manutencoes,
  })).digest('hex')

  const resumo = workbook.addWorksheet('Resumo mensal', { views: [{ showGridLines: false }] })
  resumo.columns = [{ width: 28 }, { width: 24 }, { width: 28 }, { width: 24 }]
  resumo.mergeCells('A1:D1')
  resumo.getCell('A1').value = 'RELATÓRIO OPERACIONAL RPMTRUCK'
  resumo.getCell('A1').font = { bold: true, size: 16, color: { argb: CORES.branco } }
  resumo.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CORES.escuro } }
  resumo.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' }
  resumo.getRow(1).height = 30
  const resumoLinhas: Array<[string, string | number | Date, string, string | number | Date]> = [
    ['Empresa', dados.empresa.nome, 'CNPJ', dados.empresa.cnpj || 'Não informado'],
    ['Período inicial', dados.periodoInicio, 'Período final', dados.periodoFim],
    ['Plano', dados.empresa.plano, 'Gerado por', dados.geradoPor],
    ['Containers', dados.containers.length, 'Abastecimentos', abastecimentos.length],
    ['Manutenções', dados.manutencoes.length, 'Custos', dados.custos.length],
    ['Total de fretes', totalFrete, 'Total de comissões', totalComissao],
    ['Total de custos', totalCustos, 'Total de manutenções', totalManutencoes],
  ]
  resumoLinhas.forEach((valores, indice) => {
    const linha = resumo.addRow(valores)
    linha.getCell(1).font = { bold: true }
    linha.getCell(3).font = { bold: true }
    if (indice === 1) {
      linha.getCell(2).numFmt = dataFormato
      linha.getCell(4).numFmt = dataFormato
    }
    if (indice >= 5) {
      linha.getCell(2).numFmt = moeda
      linha.getCell(4).numFmt = moeda
    }
  })
  resumo.getCell('A10').value = 'Observação'
  resumo.getCell('A10').font = { bold: true }
  resumo.mergeCells('B10:D11')
  resumo.getCell('B10').value = 'O arquivo é um extrato operacional. Documentos fiscais oficiais devem ser preservados conforme a legislação aplicável.'
  resumo.getCell('B10').alignment = { wrapText: true, vertical: 'top' }

  const containers = workbook.addWorksheet('Containers')
  prepararTabela(containers, [
    { header: 'Nº', key: 'numero', width: 8 },
    { header: 'DATA', key: 'data', width: 14 },
    { header: 'CONTAINER', key: 'codigo', width: 20 },
    { header: 'TIPO', key: 'tipo', width: 12 },
    { header: 'TERMINAL INÍCIO', key: 'origem', width: 24 },
    { header: 'TERMINAL FIM', key: 'destino', width: 24 },
    { header: 'VEÍCULO', key: 'veiculo', width: 22 },
    { header: 'MOTORISTA', key: 'motorista', width: 24 },
    { header: 'FRETE', key: 'frete', width: 16 },
    { header: 'COMISSÃO', key: 'comissao', width: 16 },
    { header: 'STATUS', key: 'status', width: 16 },
    { header: 'OBSERVAÇÕES', key: 'observacoes', width: 36 },
  ])
  dados.containers.forEach((container, indice) => containers.addRow({
    numero: indice + 1,
    data: container.data,
    codigo: container.codigo,
    tipo: container.tipo,
    origem: container.terminal_inicio,
    destino: container.terminal_fim,
    veiculo: `${container.veiculo.modelo} (${container.veiculo.placa})`,
    motorista: container.motorista?.nome || 'Não vinculado',
    frete: container.frete,
    comissao: container.comissao,
    status: container.status,
    observacoes: container.observacoes || '',
  }))
  containers.getColumn('data').numFmt = dataFormato
  containers.getColumn('codigo').numFmt = '@'
  containers.getColumn('frete').numFmt = moeda
  containers.getColumn('comissao').numFmt = moeda
  estilizarLinhas(containers)

  const combustivel = workbook.addWorksheet('Abastecimentos')
  prepararTabela(combustivel, [
    { header: 'DATA', key: 'data', width: 14 },
    { header: 'VEÍCULO', key: 'veiculo', width: 22 },
    { header: 'MOTORISTA', key: 'motorista', width: 24 },
    { header: 'DESCRIÇÃO', key: 'descricao', width: 42 },
    { header: 'VALOR', key: 'valor', width: 16 },
    { header: 'PAGAMENTO', key: 'pagamento', width: 24 },
    { header: 'STATUS', key: 'status', width: 14 },
  ], CORES.amarelo)
  abastecimentos.forEach((custo) => combustivel.addRow({
    data: custo.data,
    veiculo: `${custo.veiculo.modelo} (${custo.veiculo.placa})`,
    motorista: custo.motorista?.nome || 'Não vinculado',
    descricao: custo.descricao,
    valor: custo.valor,
    pagamento: custo.formaPagamento,
    status: custo.status,
  }))
  combustivel.getColumn('data').numFmt = dataFormato
  combustivel.getColumn('valor').numFmt = moeda
  estilizarLinhas(combustivel)

  const manutencoes = workbook.addWorksheet('Manutenções')
  prepararTabela(manutencoes, [
    { header: 'DATA AGENDADA', key: 'agendada', width: 18 },
    { header: 'CONCLUSÃO', key: 'conclusao', width: 16 },
    { header: 'VEÍCULO', key: 'veiculo', width: 22 },
    { header: 'TIPO', key: 'tipo', width: 18 },
    { header: 'ITEM / SERVIÇO', key: 'servico', width: 42 },
    { header: 'KM', key: 'km', width: 14 },
    { header: 'VALOR', key: 'valor', width: 16 },
    { header: 'STATUS', key: 'status', width: 18 },
  ])
  dados.manutencoes.forEach((manutencao) => manutencoes.addRow({
    agendada: manutencao.data_agendada,
    conclusao: manutencao.data_conclusao || '',
    veiculo: `${manutencao.veiculo.modelo} (${manutencao.veiculo.placa})`,
    tipo: manutencao.tipo,
    servico: manutencao.pecas_substituidas || manutencao.descricao || '',
    km: manutencao.km_atual,
    valor: manutencao.custo,
    status: manutencao.status,
  }))
  manutencoes.getColumn('agendada').numFmt = dataFormato
  manutencoes.getColumn('conclusao').numFmt = dataFormato
  manutencoes.getColumn('km').numFmt = '#,##0'
  manutencoes.getColumn('valor').numFmt = moeda
  estilizarLinhas(manutencoes)

  const custos = workbook.addWorksheet('Custos')
  prepararTabela(custos, [
    { header: 'DATA', key: 'data', width: 14 },
    { header: 'CATEGORIA', key: 'categoria', width: 22 },
    { header: 'VEÍCULO', key: 'veiculo', width: 22 },
    { header: 'MOTORISTA', key: 'motorista', width: 24 },
    { header: 'DESCRIÇÃO', key: 'descricao', width: 42 },
    { header: 'VALOR', key: 'valor', width: 16 },
    { header: 'PAGAMENTO', key: 'pagamento', width: 24 },
    { header: 'STATUS', key: 'status', width: 14 },
  ])
  dados.custos.forEach((custo) => custos.addRow({
    data: custo.data,
    categoria: custo.categoria,
    veiculo: `${custo.veiculo.modelo} (${custo.veiculo.placa})`,
    motorista: custo.motorista?.nome || 'Não vinculado',
    descricao: custo.descricao,
    valor: custo.valor,
    pagamento: custo.formaPagamento,
    status: custo.status,
  }))
  custos.getColumn('data').numFmt = dataFormato
  custos.getColumn('valor').numFmt = moeda
  estilizarLinhas(custos)

  const auditoria = workbook.addWorksheet('Auditoria', { views: [{ showGridLines: false }] })
  auditoria.columns = [{ width: 30 }, { width: 80 }]
  aplicarCabecalho(auditoria.addRow(['CAMPO', 'VALOR']), CORES.cinza)
  ;[
    ['Identificador do arquivo', dados.arquivoId],
    ['Empresa', dados.empresa.nome],
    ['CNPJ', dados.empresa.cnpj || 'Não informado'],
    ['Período', `${dataIso(dados.periodoInicio)} a ${dataIso(dados.periodoFim)}`],
    ['Gerado em', dados.geradoEm.toISOString()],
    ['Gerado por', dados.geradoPor],
    ['Plano', dados.empresa.plano],
    ['Checksum dos dados (SHA-256)', checksumDados],
    ['Containers', dados.containers.length],
    ['Abastecimentos', abastecimentos.length],
    ['Manutenções', dados.manutencoes.length],
    ['Custos', dados.custos.length],
    ['Versão do formato', 'RPMTruck Operacional 1.0'],
  ].forEach((linha) => auditoria.addRow(linha))
  auditoria.getColumn(2).alignment = { wrapText: true, vertical: 'top' }

  const dicionario = workbook.addWorksheet('Dicionário')
  prepararTabela(dicionario, [
    { header: 'ABA', key: 'aba', width: 22 },
    { header: 'CAMPO', key: 'campo', width: 28 },
    { header: 'DESCRIÇÃO', key: 'descricao', width: 70 },
  ], CORES.cinza)
  ;[
    ['Containers', 'CONTAINER', 'Código do container preservado como texto.'],
    ['Containers', 'TERMINAL INÍCIO', 'Local de origem da operação.'],
    ['Containers', 'TERMINAL FIM', 'Local de destino da operação.'],
    ['Abastecimentos', 'DESCRIÇÃO', 'Dados informados no lançamento de custo de combustível. Litros e ARLA só aparecem quando estruturados no cadastro.'],
    ['Manutenções', 'ITEM / SERVIÇO', 'Descrição ou peças substituídas na manutenção.'],
    ['Auditoria', 'Checksum dos dados', 'Hash do conjunto de dados usado para gerar a planilha. O checksum do arquivo XLSX é registrado no sistema após a geração.'],
  ].forEach(([aba, campo, descricao]) => dicionario.addRow({ aba, campo, descricao }))
  estilizarLinhas(dicionario)

  const buffer = await workbook.xlsx.writeBuffer()
  return {
    conteudo: Buffer.from(buffer),
    checksumDados,
    resumo: {
      containers: dados.containers.length,
      abastecimentos: abastecimentos.length,
      manutencoes: dados.manutencoes.length,
      custos: dados.custos.length,
      totalFrete,
      totalComissao,
      totalCustos,
      totalManutencoes,
    },
  }
}


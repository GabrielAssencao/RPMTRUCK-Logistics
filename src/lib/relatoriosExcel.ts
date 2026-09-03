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
  comissao_ativa: boolean
  status: string
  observacoes: string | null
  veiculo: { placa: string; modelo: string }
  motorista: { nome: string } | null
}

interface MovimentacaoPermanenteRelatorio {
  id: string
  codigo_container: string
  terminal_origem: string
  terminal_destino: string
  data_operacao: Date
}

interface CustoRelatorio {
  data: Date
  categoria: string
  descricao: string
  valor: number
  formaPagamento: string
  status: string
  veiculo: { placa: string; modelo: string } | null
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
  movimentacoesPermanentes: MovimentacaoPermanenteRelatorio[]
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
  azulClaro: 'FFE0F7FA',
  cinzaClaro: 'FFF8FAFC',
}

const moeda = 'R$ #,##0.00'
const dataFormato = 'dd/mm/yyyy'

function aplicarCabecalho(linha: ExcelJS.Row, cor: string) {
  linha.font = { bold: true, color: { argb: CORES.escuro } }
  linha.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: cor } }
  linha.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
  linha.height = 30
  linha.eachCell((celula) => {
    celula.border = {
      top: { style: 'thin', color: { argb: CORES.escuro } },
      left: { style: 'thin', color: { argb: CORES.escuro } },
      bottom: { style: 'thin', color: { argb: CORES.escuro } },
      right: { style: 'thin', color: { argb: CORES.escuro } },
    }
  })
}

function configurarImpressao(planilha: ExcelJS.Worksheet, orientacao: 'portrait' | 'landscape' = 'landscape') {
  planilha.pageSetup = {
    orientation: orientacao,
    paperSize: 9,
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    horizontalCentered: true,
    margins: {
      left: 0.25,
      right: 0.25,
      top: 0.5,
      bottom: 0.5,
      header: 0.2,
      footer: 0.2,
    },
  }
  planilha.headerFooter.oddFooter = '&L RPMTruck&C Página &P de &N&R &D'
}

function prepararTabela(planilha: ExcelJS.Worksheet, colunas: Partial<ExcelJS.Column>[], cor = CORES.azul) {
  planilha.columns = colunas
  aplicarCabecalho(planilha.getRow(1), cor)
  planilha.views = [{ state: 'frozen', ySplit: 1, showGridLines: false }]
  planilha.autoFilter = { from: 'A1', to: `${planilha.getColumn(colunas.length).letter}1` }
  planilha.properties.defaultRowHeight = 20
  planilha.pageSetup.printTitlesRow = '1:1'
  configurarImpressao(planilha)
}

function estilizarLinhas(planilha: ExcelJS.Worksheet) {
  planilha.eachRow((linha, numero) => {
    if (numero === 1) return
    let linhasNecessarias = 1
    linha.eachCell((celula) => {
      const larguraColuna = Number(planilha.getColumn(celula.col).width ?? 12)
      const tamanhoTexto = celula.text?.length ?? 0
      linhasNecessarias = Math.max(linhasNecessarias, Math.ceil(tamanhoTexto / Math.max(larguraColuna - 2, 8)))
      celula.alignment = {
        vertical: 'middle',
        wrapText: true,
        horizontal: typeof celula.value === 'number' ? 'right' : 'left',
      }
      celula.border = {
        top: { style: 'hair', color: { argb: 'FF9CA3AF' } },
        left: { style: 'hair', color: { argb: 'FF9CA3AF' } },
        bottom: { style: 'hair', color: { argb: 'FF9CA3AF' } },
        right: { style: 'hair', color: { argb: 'FF9CA3AF' } },
      }
      if (numero % 2 === 0) {
        celula.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CORES.cinzaClaro } }
      }
    })
    linha.height = Math.min(60, Math.max(20, linhasNecessarias * 15))
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
  const totalComissao = dados.containers
    .filter((container) => container.comissao_ativa && container.status !== 'CANCELADO')
    .reduce((total, container) => total + container.comissao, 0)
  const totalCustos = dados.custos.reduce((total, custo) => total + custo.valor, 0)
  const totalManutencoes = dados.manutencoes.reduce((total, manutencao) => total + manutencao.custo, 0)

  const checksumDados = createHash('sha256').update(JSON.stringify({
    arquivoId: dados.arquivoId,
    empresa: dados.empresa,
    periodoInicio: dataIso(dados.periodoInicio),
    periodoFim: dataIso(dados.periodoFim),
    movimentacoesPermanentes: dados.movimentacoesPermanentes,
    containers: dados.containers,
    custos: dados.custos,
    manutencoes: dados.manutencoes,
  })).digest('hex')

  const resumo = workbook.addWorksheet('Resumo mensal', { views: [{ showGridLines: false }] })
  resumo.columns = [
    { width: 20 },
    { width: 22 },
    { width: 18 },
    { width: 20 },
    { width: 22 },
    { width: 18 },
  ]
  configurarImpressao(resumo, 'portrait')
  resumo.mergeCells('A1:F2')
  resumo.getCell('A1').value = 'RELATÓRIO OPERACIONAL RPMTRUCK'
  resumo.getCell('A1').font = { bold: true, size: 18, color: { argb: CORES.branco } }
  resumo.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CORES.escuro } }
  resumo.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' }
  resumo.getRow(1).height = 24
  resumo.getRow(2).height = 24

  const adicionarLinhaIdentificacao = (linha: number, rotuloA: string, valorA: string | Date, rotuloB: string, valorB: string | Date) => {
    resumo.mergeCells(linha, 2, linha, 3)
    resumo.mergeCells(linha, 5, linha, 6)
    resumo.getCell(linha, 1).value = rotuloA
    resumo.getCell(linha, 2).value = valorA
    resumo.getCell(linha, 4).value = rotuloB
    resumo.getCell(linha, 5).value = valorB
    ;[1, 4].forEach((coluna) => {
      const celula = resumo.getCell(linha, coluna)
      celula.font = { bold: true, color: { argb: CORES.escuro } }
      celula.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CORES.azulClaro } }
    })
    ;[2, 5].forEach((coluna) => {
      resumo.getCell(linha, coluna).alignment = { vertical: 'middle', wrapText: true }
    })
    resumo.getRow(linha).height = 28
  }

  adicionarLinhaIdentificacao(4, 'Empresa', dados.empresa.nome, 'CNPJ', dados.empresa.cnpj || 'Não informado')
  adicionarLinhaIdentificacao(5, 'Período inicial', dados.periodoInicio, 'Período final', dados.periodoFim)
  adicionarLinhaIdentificacao(6, 'Plano', dados.empresa.plano, 'Gerado por', dados.geradoPor)
  resumo.getCell('B5').numFmt = dataFormato
  resumo.getCell('E5').numFmt = dataFormato

  resumo.mergeCells('A8:F8')
  resumo.getCell('A8').value = 'RESUMO OPERACIONAL'
  aplicarCabecalho(resumo.getRow(8), CORES.azul)

  const metricas: Array<[string, number, string, number, string, number]> = [
    ['Movimentações', dados.movimentacoesPermanentes.length, 'Containers detalhados', dados.containers.length, 'Abastecimentos', abastecimentos.length],
    ['Manutenções', dados.manutencoes.length, 'Custos', dados.custos.length, 'Total de fretes', totalFrete],
    ['Comissões ativas', totalComissao, 'Total de custos (inclui comissões)', totalCustos, 'Total de manutenções', totalManutencoes],
  ]
  metricas.forEach((metrica, indice) => {
    const linha = 9 + indice
    metrica.forEach((valor, coluna) => {
      const celula = resumo.getCell(linha, coluna + 1)
      celula.value = valor
      celula.alignment = { vertical: 'middle', wrapText: true, horizontal: coluna % 2 === 0 ? 'left' : 'right' }
      if (coluna % 2 === 0) {
        celula.font = { bold: true }
        celula.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CORES.cinzaClaro } }
      }
    })
    resumo.getRow(linha).height = 30
  })
  ;['F10', 'B11', 'D11', 'F11'].forEach((endereco) => { resumo.getCell(endereco).numFmt = moeda })

  resumo.mergeCells('A13:F13')
  resumo.getCell('A13').value = 'PRESERVAÇÃO DOS DADOS'
  aplicarCabecalho(resumo.getRow(13), CORES.verde)
  resumo.mergeCells('A14:F16')
  resumo.getCell('A14').value = 'O código do container, a origem, o destino e a data da operação são preservados no histórico permanente e estão detalhados na aba “Movimentações permanentes”. Este arquivo é um extrato operacional; documentos fiscais oficiais devem ser preservados conforme a legislação aplicável.'
  resumo.getCell('A14').alignment = { wrapText: true, vertical: 'middle', horizontal: 'left' }
  resumo.getCell('A14').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CORES.cinzaClaro } }
  resumo.getRow(14).height = 24
  resumo.getRow(15).height = 24
  resumo.getRow(16).height = 24
  resumo.pageSetup.printArea = 'A1:F16'

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

  const movimentacoes = workbook.addWorksheet('Movimentações permanentes')
  prepararTabela(movimentacoes, [
    { header: 'Nº', key: 'numero', width: 8 },
    { header: 'DATA DA OPERAÇÃO', key: 'data', width: 20 },
    { header: 'CÓDIGO DO CONTAINER', key: 'codigo', width: 24 },
    { header: 'ORIGEM', key: 'origem', width: 34 },
    { header: 'DESTINO', key: 'destino', width: 34 },
    { header: 'ID DO REGISTRO PERMANENTE', key: 'id', width: 40 },
  ], CORES.verde)
  dados.movimentacoesPermanentes.forEach((movimentacao, indice) => movimentacoes.addRow({
    numero: indice + 1,
    data: movimentacao.data_operacao,
    codigo: movimentacao.codigo_container,
    origem: movimentacao.terminal_origem,
    destino: movimentacao.terminal_destino,
    id: movimentacao.id,
  }))
  movimentacoes.getColumn('data').numFmt = dataFormato
  movimentacoes.getColumn('codigo').numFmt = '@'
  movimentacoes.getColumn('id').numFmt = '@'
  estilizarLinhas(movimentacoes)

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
    veiculo: custo.veiculo ? `${custo.veiculo.modelo} (${custo.veiculo.placa})` : 'Despesa geral da empresa',
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
    veiculo: custo.veiculo ? `${custo.veiculo.modelo} (${custo.veiculo.placa})` : 'Despesa geral da empresa',
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
    ['Movimentações permanentes', dados.movimentacoesPermanentes.length],
    ['Containers', dados.containers.length],
    ['Abastecimentos', abastecimentos.length],
    ['Manutenções', dados.manutencoes.length],
    ['Custos', dados.custos.length],
    ['Versão do formato', 'RPMTruck Operacional 2.0'],
  ].forEach((linha) => auditoria.addRow(linha))
  auditoria.getColumn(2).alignment = { wrapText: true, vertical: 'top' }

  const dicionario = workbook.addWorksheet('Dicionário')
  prepararTabela(dicionario, [
    { header: 'ABA', key: 'aba', width: 22 },
    { header: 'CAMPO', key: 'campo', width: 28 },
    { header: 'DESCRIÇÃO', key: 'descricao', width: 70 },
  ], CORES.cinza)
  ;[
    ['Movimentações permanentes', 'CÓDIGO DO CONTAINER', 'Identificação do container preservada permanentemente.'],
    ['Movimentações permanentes', 'ORIGEM', 'Local ou terminal de onde o container saiu.'],
    ['Movimentações permanentes', 'DESTINO', 'Local ou terminal para onde o container foi enviado.'],
    ['Movimentações permanentes', 'DATA DA OPERAÇÃO', 'Data da postagem ou movimentação registrada.'],
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
      movimentacoesPermanentes: dados.movimentacoesPermanentes.length,
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

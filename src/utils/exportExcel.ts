export interface ColunaExcel {
  titulo: string
  chave: string
  tipo?: 'String' | 'Number'
}

export interface PlanilhaExcel {
  nome: string
  colunas: ColunaExcel[]
  linhas: Array<Record<string, string | number>>
}

const escaparXml = (valor: string | number) => String(valor)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&apos;')

const nomeSeguro = (nome: string) => nome.replace(/[\\/:*?\[\]]/g, ' ').slice(0, 31) || 'Dados'

export function exportarExcel(nomeArquivo: string, planilhas: PlanilhaExcel[]) {
  const worksheets = planilhas.map(planilha => {
    const cabecalho = planilha.colunas
      .map(coluna => `<Cell ss:StyleID="Header"><Data ss:Type="String">${escaparXml(coluna.titulo)}</Data></Cell>`)
      .join('')

    const linhas = planilha.linhas.map(linha => {
      const celulas = planilha.colunas.map(coluna => {
        const valor = linha[coluna.chave] ?? ''
        const tipo = coluna.tipo ?? (typeof valor === 'number' ? 'Number' : 'String')
        return `<Cell><Data ss:Type="${tipo}">${escaparXml(valor)}</Data></Cell>`
      }).join('')
      return `<Row>${celulas}</Row>`
    }).join('')

    return `<Worksheet ss:Name="${escaparXml(nomeSeguro(planilha.nome))}"><Table><Row>${cabecalho}</Row>${linhas}</Table><WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel"><FreezePanes/><FrozenNoSplit/><SplitHorizontal>1</SplitHorizontal><TopRowBottomPane>1</TopRowBottomPane></WorksheetOptions></Worksheet>`
  }).join('')

  const conteudo = `<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Styles><Style ss:ID="Header"><Font ss:Bold="1"/><Interior ss:Color="#D9EAD3" ss:Pattern="Solid"/></Style></Styles>${worksheets}</Workbook>`
  const blob = new Blob([conteudo], { type: 'application/vnd.ms-excel;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${nomeArquivo.replace(/\.xls$/i, '')}.xls`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

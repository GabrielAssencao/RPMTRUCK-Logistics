export interface SecaoRelatorioPdf {
  titulo: string
  colunas: string[]
  linhas: Array<Array<string | number>>
}

const escaparHtml = (valor: string | number) => String(valor)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;')

export function exportarPdf({
  titulo,
  subtitulo,
  metricas,
  secoes,
}: {
  titulo: string
  subtitulo: string
  metricas: Array<{ rotulo: string; valor: string }>
  secoes: SecaoRelatorioPdf[]
}) {
  const janela = window.open('', '_blank')
  if (!janela) throw new Error('O navegador bloqueou a janela de impressão.')
  janela.opener = null
  janela.addEventListener('load', () => janela.print(), { once: true })

  const cards = metricas.map(metrica => `<div class="metric"><span>${escaparHtml(metrica.rotulo)}</span><strong>${escaparHtml(metrica.valor)}</strong></div>`).join('')
  const tabelas = secoes.map(secao => `<section><h2>${escaparHtml(secao.titulo)}</h2><table><thead><tr>${secao.colunas.map(coluna => `<th>${escaparHtml(coluna)}</th>`).join('')}</tr></thead><tbody>${secao.linhas.map(linha => `<tr>${linha.map(valor => `<td>${escaparHtml(valor)}</td>`).join('')}</tr>`).join('')}</tbody></table></section>`).join('')

  janela.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${escaparHtml(titulo)}</title><style>@page{size:A4;margin:14mm}*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#172019;margin:0}header{border-bottom:3px solid #22c55e;padding-bottom:14px;margin-bottom:18px}h1{font-size:22px;margin:0 0 5px;text-transform:uppercase}header p{font-size:11px;color:#5c655e;margin:0}.metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:20px}.metric{border:1px solid #ccd3cd;padding:10px}.metric span{display:block;font-size:8px;text-transform:uppercase;color:#69716a;margin-bottom:5px}.metric strong{font-size:15px}section{break-inside:avoid;margin:0 0 22px}h2{font-size:12px;text-transform:uppercase;margin:0 0 8px}table{width:100%;border-collapse:collapse;font-size:9px}th,td{border:1px solid #d8ddd9;padding:6px;text-align:left}th{background:#edf7ef;text-transform:uppercase}footer{font-size:8px;color:#727972;border-top:1px solid #ddd;padding-top:8px;margin-top:24px}@media print{button{display:none}}</style></head><body><header><h1>${escaparHtml(titulo)}</h1><p>${escaparHtml(subtitulo)}</p></header><div class="metrics">${cards}</div>${tabelas}<footer>RPMTruck Logistics · Relatório gerado em ${new Date().toLocaleString('pt-BR')}</footer></body></html>`)
  janela.document.close()
}

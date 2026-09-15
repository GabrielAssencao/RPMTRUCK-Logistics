import { mkdir } from 'node:fs/promises'
import { chromium } from 'playwright'
import { SignJWT } from 'jose'

// Public product images use isolated fixtures; no customer data is requested.
if (process.env.LOCAL_ENVIRONMENT !== 'development' || process.env.NEXT_PUBLIC_SITE_URL !== 'http://127.0.0.1:5500') throw new Error('Use the isolated local environment on port 5500.')
const base = 'http://127.0.0.1:5500'
const modulos = ['FROTA', 'GESTAO', 'CONTAS_PAGAR', 'NOTIFICACOES', 'TAREFAS', 'RELATORIOS']
const usuario = { id: 'demo-user', nome: 'Equipe demonstração', email: 'demo@example.invalid', role: 'GESTOR_EMPRESA', corTema: '#22c55e', temaClaro: false, modulosAcesso: modulos, estiloFundo: 'DESLIGADO', herdadoDoGestor: false }
const empresa = { id: 'demo-company', nome: 'Operação demonstração', plano: 'AVANCADO', status: 'ATIVO', modulos, permissoes: { telaTarefas: true, delegacaoTarefas: true } }
const data = new Date(); data.setDate(18); data.setHours(10, 0, 0, 0)
const duplas = [{ id: 'demo-dupla', veiculoId: 'demo-truck', veiculoPlaca: 'DEM1A23', veiculoModelo: 'Volvo FH', motoristaId: 'demo-driver', motoristaNome: 'Motorista demonstração' }]
const containers = ['EM_TRANSITO', 'AGENDADO', 'ENTREGUE', 'EM_TRANSITO'].map((status, i) => ({ id: 'demo-container-' + i, data: data.toISOString().slice(0, 10), codigo: 'DEMO' + (1234560 + i), tipo: i % 2 ? '40 HC' : 'REEFER', terminalInicio: ['Santos', 'Paranaguá'][i % 2], terminalFim: ['São Paulo', 'Curitiba'][i % 2], duplaId: duplas[0].id, veiculoId: duplas[0].veiculoId, motoristaId: duplas[0].motoristaId, frete: 3200 + i * 450, comissao: 320 + i * 45, comissaoAtiva: true, percentualComissao: 10, status, observacoes: 'Operação de demonstração.', itensConteudo: [{ nome: 'Carga demonstrativa', porcentagem: 75 }] }))
const custos = ['COMBUSTIVEL', 'MANUTENCAO', 'PEDAGIO', 'ALIMENTACAO'].map((categoria, i) => ({ id: 'demo-cost-' + i, duplaId: duplas[0].id, motoristaNome: duplas[0].motoristaNome, data: data.toISOString().slice(0, 10), ano: data.getFullYear(), mesIndex: data.getMonth(), semanaIndex: 3, categoria, descricao: ['Abastecimento da rota', 'Revisão preventiva', 'Pedágios do trajeto', 'Alimentação em viagem'][i], valor: [2450, 1180, 320, 180][i], formaPagamento: 'CARTÃO CORPORATIVO', status: i === 1 ? 'PENDENTE' : 'PAGO', arquivado: false, origemContaPagar: false, origemComissaoContainer: false }))
const tarefas = ['Revisar programação das entregas', 'Conferir documentos da frota', 'Acompanhar manutenção preventiva', 'Validar custos da operação', 'Atualizar roteiro de transporte', 'Finalizar conferência mensal'].map((titulo, i) => ({ id: 'task-' + i, titulo, descricao: 'Atividade demonstrativa para acompanhar a operação da equipe.', inicio: new Date(data.getTime() + i * 86400000).toISOString(), prazo: new Date(data.getTime() + (i + 1) * 86400000).toISOString(), exibirCalendario: true, prioridade: i % 2 ? 'MEDIA' : 'ALTA', status: ['PENDENTE', 'EM_ANDAMENTO', 'CONCLUIDA'][i % 3], ordem: (i + 1) * 1000, responsavel: { id: 'demo-operator', nome: 'Equipe operacional', email: 'equipe@example.invalid', role: 'OPERADOR' }, criador: usuario, criado_em: data.toISOString() }))
const lembretes = ['Conferir agenda da semana', 'Reunião de acompanhamento', 'Revisar vencimentos'].map((titulo, i) => ({ id: 'reminder-' + i, titulo, descricao: 'Anotação pessoal para manter tudo organizado.', dataHora: new Date(data.getTime() + i * 86400000).toISOString(), urgencia: ['MEDIA', 'ALTA', 'LEVE'][i], modoNotificacao: 'AUTOMATICA', notificarEm: data.toISOString(), concluido: false, ordem: i * 1000, criado_em: data.toISOString() }))
const serie = Array.from({ length: 30 }, (_, i) => ({ dia: String(i + 1).padStart(2, '0'), combustivel: 950 + (i % 5) * 340, manutencao: 280 + (i % 3) * 190, pedagio: 130 + (i % 4) * 90, outros: 90 }))
const dashboard = { usuario: { ...usuario, podeDelegar: true }, empresa: { ...empresa, delegacaoTarefas: true }, metricas: { totalVeiculos: 24, totalAtivos: 22, totalOperacionais: 20, custoMes: 42860, custoKm: 2.85, tarefasPendentes: 4 }, graficos: { '7_DIAS': serie.slice(0, 7), '15_DIAS': serie.slice(0, 15), '30_DIAS': serie, distribuicao: [{ name: 'Combustível', value: 59 }, { name: 'Manutenção', value: 21 }, { name: 'Pedágio', value: 10 }, { name: 'Outros', value: 10 }] }, alertas: [{ id: 'alert-1', categoria: 'VEICULO', subtipo: 'NAO_REALIZADA', foco: 'Manutenção preventiva', descricao: 'Acompanhe as próximas revisões programadas da sua frota.' }], operadores: [{ id: 'demo-operator', nome: 'Equipe operacional', cargo: 'OPERADOR' }], contasPagar: { visivel: true, total: 0, urgentes: 0, proximas: 0, contas: [] } }
const token = await new SignJWT({ userId: usuario.id, email: usuario.email, role: usuario.role, empresaId: empresa.id, sessionVersion: 0 }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('5m').sign(new TextEncoder().encode(process.env.JWT_SECRET))
await mkdir('public/previews', { recursive: true })
const browser = await chromium.launch({ headless: true })
try {
 const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1, reducedMotion: 'reduce' })
 await context.addCookies([{ name: 'rpmtruck_session', value: token, url: base, httpOnly: true, sameSite: 'Lax' }])
 await context.addInitScript(() => { localStorage.setItem('rpm-primary', '#22c55e'); localStorage.setItem('rpm-light', 'false') })
 await context.route('**/api/**', async (route) => {
  const path = new URL(route.request().url()).pathname
  let body = {}
  if (path === '/api/empresa/perfil') body = { usuario, empresa }
  else if (path === '/api/dashboard/empresa') body = dashboard
  else if (path === '/api/tarefas') body = tarefas
  else if (path === '/api/lembretes-pessoais') body = lembretes
  else if (path === '/api/empresa/usuarios') body = [usuario, tarefas[0].responsavel]
  else if (path === '/api/containers') body = { containers, duplas }
  else if (path === '/api/containers/historico') body = { registros: [], paginacao: { totalPaginas: 1 } }
  else if (path === '/api/custos') body = custos
  else if (path === '/api/notificacoes') body = { notificacoes: [], naoLidas: 0, pendenciasPorModulo: {}, total: 0 }
  else if (path === '/api/alertas') body = { alertas: [] }
  else if (path === '/api/chat') body = { tickets: [], resumo: { mensagensNaoLidas: 0 } }
  await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'X-Lembretes-Retencao-Dias': 'manter' }, body: JSON.stringify(body) })
 })
 const page = await context.newPage()
 const errors = []; page.on('pageerror', error => errors.push(error.stack))
 if (!process.argv.includes('--containers-only') && !process.argv.includes('--costs-only')) {
 await page.goto(base + '/dashboard/empresa', { waitUntil: 'networkidle' })
 await page.getByRole('heading', { name: /visão geral da frota/i }).waitFor()
 // Capture fully rendered charts instead of their progressive animation.
 await page.locator('.recharts-pie-sector').first().waitFor()
 await page.waitForFunction(() => { const area = document.querySelector('.recharts-area-area'); return area && area.getBBox().width > 500 })
 await page.waitForTimeout(1600)
 await page.screenshot({ path: 'public/previews/dashboard.png' })
 await page.goto(base + '/dashboard/empresa/cronograma', { waitUntil: 'networkidle' })
 await page.getByText(tarefas[0].titulo, { exact: true }).first().waitFor()
 await page.screenshot({ path: 'public/previews/tasks.png' })
 await page.getByRole('button', { name: 'Calendário', exact: true }).click()
 await page.getByText('Calendário mensal', { exact: true }).waitFor()
 await page.screenshot({ path: 'public/previews/calendar.png' })
 }
 if (!process.argv.includes('--costs-only')) {
 await page.goto(base + '/dashboard/empresa/containers', { waitUntil: 'networkidle' })
 await page.getByRole('heading', { name: /Controle de Containers/i }).waitFor()
 await page.getByText(containers[0].codigo, { exact: true }).first().waitFor()
 await page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' })
 await page.screenshot({ path: 'public/previews/containers.png' })
 }
 if (!process.argv.includes('--containers-only')) {
 await page.goto(base + '/dashboard/empresa/custos', { waitUntil: 'networkidle' })
 await page.getByRole('button', { name: 'Mês inteiro', exact: true }).click()
 await page.getByText(custos[0].descricao, { exact: true }).first().waitFor()
 await page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' })
 await page.screenshot({ path: 'public/previews/costs.png' })
 }
 if(errors.length) throw new Error(errors.join('; '))
 console.log('Product screenshots captured using demonstration fixtures.')
} finally { await browser.close() }

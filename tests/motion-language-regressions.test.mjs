import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const read = (path) => readFileSync(resolve(root, path), 'utf8')

test('feedback operacional oferece estados reais e anúncios acessíveis', () => {
  const component = read('src/components/motion/OperationalFeedback.tsx')

  assert.match(component, /export type PrinterStage = 'preparing' \| 'generating' \| 'saving' \| 'complete' \| 'error'/)
  assert.match(component, /role=\{stage === 'error' \? 'alert' : 'status'\}/)
  assert.match(component, /aria-valuenow=\{copy\.progress\}/)
  assert.match(component, /aria-label="Fechar status da exportação"/)
  assert.match(component, /aria-label="Carregando perfil da empresa"/)
  assert.doesNotMatch(component, /setTimeout|setInterval/)
})

test('animações operacionais respeitam a preferência por movimento reduzido', () => {
  const styles = read('src/components/motion/OperationalFeedback.module.css')

  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/)
  assert.match(styles, /animation: none !important/)
  assert.match(styles, /transition: none !important/)
})

test('geração de Excel progride pela requisição sem atraso artificial', () => {
  for (const path of [
    'src/app/dashboard/empresa/arquivos/page.tsx',
    'src/app/dashboard/empresa/relatorios/page.tsx',
  ]) {
    const page = read(path)
    const handler = page.match(/const (?:gerar|handleGerarExcelServidor) = async \(\) => \{[\s\S]*?\n  \}/)?.[0] ?? ''

    assert.match(handler, /setPrinterStage\('preparing'\)/)
    assert.match(handler, /setPrinterStage\('generating'\)/)
    assert.match(handler, /setPrinterStage\('saving'\)/)
    assert.match(handler, /setPrinterStage\('complete'\)/)
    assert.match(handler, /setPrinterStage\('error'\)/)
    assert.doesNotMatch(handler, /setTimeout|setInterval/)
    assert.match(page, /<PrinterProgress/)
  }
})

test('listas e perfil usam feedback visual reutilizável durante carregamento', () => {
  const arquivos = read('src/app/dashboard/empresa/arquivos/page.tsx')
  const configuracoes = read('src/app/dashboard/empresa/configuracoes/page.tsx')
  const dashboardLoading = read('src/app/dashboard/empresa/loading.tsx')

  assert.match(arquivos, /<DominoLoader label="Carregando arquivos operacionais"/)
  assert.match(dashboardLoading, /<DominoLoader label="Carregando módulo da empresa"/)
  assert.match(configuracoes, /type SettingsTab = 'PERFIL' \| 'APARENCIA' \| 'NAVEGACAO' \| 'NOTIFICACOES' \| 'SEGURANCA' \| 'ASSINATURA' \| 'RISCO'/)
  assert.match(configuracoes, /carregandoPerfil \? <ProfileSkeleton \/>/)
  assert.match(configuracoes, /aria-label="Cartão de identidade da empresa"/)
  assert.match(configuracoes, /<UserRound size=\{38\}/)
  assert.match(configuracoes, /role === 'GESTOR_EMPRESA' \|\| role === 'GESTOR'/)
  assert.match(configuracoes, /\.finally\(\(\) => setCarregandoPerfil\(false\)\)/)
})

test('fase 2 separa preferências visuais sem ampliar permissões do plano', () => {
  const configuracoes = read('src/app/dashboard/empresa/configuracoes/page.tsx')
  const panels = read('src/app/dashboard/empresa/configuracoes/_componentes/PreferencePanels.tsx')
  const preferences = read('src/lib/empresaPreferences.ts')
  const layout = read('src/app/dashboard/empresa/layout.tsx')
  const globals = read('src/app/globals.css')

  assert.match(configuracoes, /label="NAVEGAÇÃO"/)
  assert.match(configuracoes, /label="NOTIFICAÇÕES"/)
  assert.match(configuracoes, /label="ÁREA DE RISCO"/)
  assert.match(panels, /Esta configuração é somente visual/)
  assert.match(panels, /!item\.modulo \|\| allowedModules\.includes\(item\.modulo\)/)
  assert.match(preferences, /EMPRESA_SIDEBAR_PREFERENCES_EVENT/)
  assert.match(preferences, /lerEstiloFundoEmpresa/)
  for (const style of ['DESLIGADO', 'DIGITAL', 'TOPOGRAFICO', 'VIDRO_FLUIDO', 'VIDRO_CAMADAS', 'ORGANICO']) {
    assert.ok(preferences.includes(`'${style}'`), `preferências devem aceitar o fundo ${style}`)
  }
  assert.match(layout, /<DashboardEnvironmentBackground estilo=\{estiloFundo\} \/>/)
  assert.match(layout, /overflow-x-hidden overflow-y-auto/)
  assert.match(globals, /\.dashboard-environment-active[\s\S]*backdrop-filter: blur\(9px\)/)
  assert.match(globals, /\.dashboard-topographic-canvas/)
  assert.match(globals, /\.dashboard-environment-layer \{[\s\S]*position: sticky;[\s\S]*height: calc\(100dvh - 4rem\)/)
  assert.match(globals, /@keyframes dashboard-topographic-luminance[\s\S]*50% \{ opacity: 0\.52; \}/)
  const environment = read('src/components/dashboard/DashboardEnvironmentBackground.tsx')
  assert.match(environment, /function desenharTopografia/)
  assert.match(environment, /NIVEIS/)
  assert.match(environment, /requestAnimationFrame/)
  assert.match(environment, /const duracaoCiclo = 24_000/)
  assert.match(environment, /dispositivoCompacto\.matches \? 60 : 40/)
  assert.match(environment, /connection\?: ConexaoComEconomiaDeDados/)
  assert.match(environment, /document\.addEventListener\('visibilitychange'/)
  assert.match(environment, /window\.setTimeout\(\(\) => \{[\s\S]*medirCanvas\(canvas\)[\s\S]*\}, 160\)/)
  assert.match(environment, /<TopographicCanvas preview=\{preview\} \/>/)
  assert.match(panels, /<DashboardEnvironmentBackground estilo=\{backgroundStyle\} preview \/>/)
  assert.match(globals, /data-environment-preview='true'[\s\S]*animation-play-state: paused !important/)
  assert.match(globals, /backdrop-filter: none/)
  assert.match(environment, /function GlassAuroraBackground/)
  assert.match(environment, /function GlassLayersBackground/)
  assert.match(environment, /function OrganicDrawingBackground/)
  assert.match(globals, /@keyframes dashboard-glass-aurora-wave/)
  assert.match(globals, /@keyframes dashboard-glass-panel-breathe/)
  assert.match(globals, /@keyframes dashboard-organic-primary/)
  assert.match(globals, /@media \(prefers-reduced-motion: reduce\)/)
  assert.doesNotMatch(environment, /IMPACTOS_CHUVA|dashboard-rain-ripple|feTurbulence/)
  assert.doesNotMatch(environment, /onMouseMove|onPointerMove|mousemove|pointermove/)
  assert.doesNotMatch(layout, /onPointerMove|--dashboard-pointer-x/)
})

test('módulos operacionais usam o loader padronizado durante consultas iniciais', () => {
  const paginas = new Map([
    ['src/app/dashboard/empresa/frota/page.tsx', 'Carregando frota e veículos'],
    ['src/app/dashboard/empresa/motoristas/page.tsx', 'Carregando motoristas e vínculos'],
    ['src/app/dashboard/empresa/containers/page.tsx', 'Carregando containers e operações'],
    ['src/app/dashboard/empresa/custos/page.tsx', 'Carregando custos e despesas'],
    ['src/app/dashboard/empresa/contas-pagar/page.tsx', 'Carregando contas a pagar'],
  ])

  for (const [path, label] of paginas) {
    const page = read(path)
    assert.match(page, /import \{ DominoLoader \} from '@\/components\/motion\/OperationalFeedback'/)
    assert.ok(page.includes(`<DominoLoader label="${label}"`), `${path} deve anunciar seu carregamento`)
  }
})

test('sidebars permanecem ancoradas e o chat não move a página em atualizações silenciosas', () => {
  const empresa = read('src/app/dashboard/empresa/layout.tsx')
  const admin = read('src/app/dashboard/admin/_estrutura/AdminLayout.tsx')
  const chat = read('src/components/dashboard/ChatWorkspace.tsx')
  const chatBot = read('src/components/dashboard/ChatBotOrb.tsx')
  const globals = read('src/app/globals.css')

  for (const layout of [empresa, admin]) {
    assert.match(layout, /transition-\[width\] duration-300 ease-in-out motion-reduce:transition-none/)
    assert.match(layout, /width: sidebarExpandida \? LARGURA_EXPANDIDA : LARGURA_RECOLHIDA/)
    assert.match(layout, /willChange: 'width'/)
    assert.doesNotMatch(layout, /absolute inset-y-0 left-0 overflow-hidden border-r/)
    assert.match(layout, /scrollbarGutter: 'stable'/)
    assert.match(layout, /-mx-4 -mt-4 mb-6 flex h-16 items-center justify-start/)
    assert.match(layout, /<SidebarBrandMark primary=\{primary\} \/>/)
    assert.match(layout, /<SidebarBrandIdentity/)
    assert.match(layout, /overflow-x-hidden overflow-y-auto/)
  }
  const brandMark = read('src/components/dashboard/SidebarBrandMark.tsx')
  assert.match(brandMark, /aria-label="RPMTRUCK"/)
  assert.match(brandMark, /RP<span style=\{\{ color: primary \}\}>M<\/span>/)
  assert.match(brandMark, /export function SidebarBrandIdentity/)
  assert.match(brandMark, /h-full min-w-0 items-center gap-2/)
  assert.match(brandMark, /<SidebarBrandMark primary=\{primary\} \/>/)
  assert.doesNotMatch(brandMark, /next\/image|<Image/)
  assert.doesNotMatch(chat, /scrollIntoView/)
  assert.match(chat, /estavaProximoDoFim/)
  assert.match(chat, /recebeuMensagem && estavaProximoDoFim/)
  assert.match(chat, /caixa\.scrollTo/)
  assert.match(chat, /overflowAnchor: 'none'/)
  assert.match(chat, /overscrollBehaviorY: 'contain'/)
  assert.match(chat, /onWheelCapture=\{interromperRolagemAutomatica\}/)
  assert.match(chat, /novasMensagens[\s\S]*Mensagens recentes/)
  assert.match(chat, /onScroll=\{atualizarPosicaoRolagem\}/)
  assert.doesNotMatch(chat, /behavior: loading \? 'auto' : 'smooth'/)
  assert.match(chat, /mensagem\.autor\?\.id === usuarioAtualId/)
  assert.match(chat, /ChatBotOrb active=\{loading \|\| sending\}/)
  assert.match(chat, /Enter envia · Shift \+ Enter quebra a linha/)
  assert.match(chatBot, /data-active=\{active \? 'true' : 'false'\}/)
  assert.match(chatBot, /document\.hidden \|\| connection\(\)\?\.saveData === true/)
  assert.match(globals, /@keyframes chat-bot-fire-rotate/)
  assert.match(globals, /@keyframes chat-bot-fire-morph/)
  assert.match(globals, /\.chat-bot-orb\[data-paused='true'\]/)
})

test('notificações usam confirmação e feedback integrados nos ambientes da empresa e do admin', () => {
  const painel = read('src/components/dashboard/NotificacoesPanel.tsx')
  const centralEmpresa = read('src/app/dashboard/empresa/notificacoes/page.tsx')
  const centralAdmin = read('src/app/dashboard/admin/_modulos/notificacoes/NotificationsModule.tsx')
  const confirmacao = read('src/components/dashboard/ActionConfirmDialog.tsx')
  const graficoAdmin = read('src/app/dashboard/admin/_modulos/visao-geral/DashboardModule.jsx')

  assert.doesNotMatch(painel, /window\.confirm/)
  assert.doesNotMatch(centralEmpresa, /window\.confirm/)
  assert.match(painel, /<ActionFeedback/)
  assert.match(painel, /<ActionConfirmDialog/)
  assert.match(centralEmpresa, /<ActionConfirmDialog/)
  assert.match(painel, /apresentarNotificacao\(notif\)/)
  assert.match(centralEmpresa, /apresentarNotificacao\(notificacao\)/)
  assert.match(centralAdmin, /apresentarNotificacao\(notificacao\)/)
  assert.match(confirmacao, /role="alertdialog"/)
  assert.match(confirmacao, /reducedMotion="user"/)
  assert.match(graficoAdmin, /itemStyle=\{\{ color: 'var\(--foreground\)' \}\}/)
  assert.match(graficoAdmin, /labelStyle=\{\{ color: 'var\(--foreground\)' \}\}/)
})

test('ações operacionais auditadas não recorrem a diálogos nativos do navegador', () => {
  for (const path of [
    'src/app/dashboard/empresa/configuracoes/_componentes/SecuritySessions.tsx',
    'src/app/dashboard/admin/_modulos/chat/ChatModule.tsx',
    'src/app/dashboard/admin/_modulos/alertas/AlertasModule.tsx',
    'src/app/dashboard/admin/_modulos/solicitacoes/AdminRequests.jsx',
    'src/app/dashboard/admin/_modulos/redefinicoes-senha/AdminPasswordResets.jsx',
    'src/app/dashboard/admin/_modulos/empresas/CompanyFinancialControl.jsx',
    'src/app/dashboard/admin/_modulos/empresas/CompanyUsersManager.jsx',
    'src/app/dashboard/admin/_modulos/empresas/CompanyVehiclesManager.jsx',
    'src/app/dashboard/empresa/arquivos/page.tsx',
    'src/app/dashboard/empresa/configuracoes/exclusao-conta/page.tsx',
    'src/app/dashboard/empresa/relatorios/page.tsx',
    'src/app/dashboard/empresa/usuarios/page.tsx',
  ]) {
    const source = read(path)
    assert.doesNotMatch(source, /window\.(?:alert|confirm|prompt)|\b(?:alert|confirm|prompt)\s*\(/, path)
  }
})

test('ações sensíveis de operadores usam confirmação animada e feedback integrado', () => {
  const usuarios = read('src/app/dashboard/empresa/usuarios/page.tsx')

  assert.doesNotMatch(usuarios, /window\.confirm\(`Deseja \$\{acao\}/)
  assert.doesNotMatch(usuarios, /window\.confirm\(`Gerar uma nova senha/)
  assert.match(usuarios, /abrirConfirmacao\('STATUS', u\)/)
  assert.match(usuarios, /abrirConfirmacao\('SENHA_TEMPORARIA', u\)/)
  assert.match(usuarios, /role="alertdialog"/)
  assert.match(usuarios, /initial=\{\{ opacity: 0, y: 14, scale: 0\.97 \}\}/)
  assert.match(usuarios, /processandoConfirmacao/)
  assert.match(usuarios, /<ActionFeedback message=\{erroConfirmacao\} tone="error"/)
  assert.match(usuarios, /senhaCopiada \? 'Copiada' : 'Copiar'/)
})

test('fundo aurora usa vidro contínuo sobre a luz e o switch mantém indicador contido', () => {
  const background = read('src/components/dashboard/DashboardEnvironmentBackground.tsx')
  const styles = read('src/app/globals.css')
  const personalization = read('src/app/dashboard/empresa/usuarios/[id]/personalizacao/page.tsx')

  assert.match(background, /dashboard-glass-aurora__wave[\s\S]*dashboard-glass-aurora__pane/)
  assert.doesNotMatch(background, /dashboard-glass-aurora__tiles/)
  assert.match(styles, /dashboard-glass-aurora__pane[\s\S]*position: absolute;[\s\S]*inset: 0/)
  assert.match(background, /Array\.from\(\{ length: 3 \}/)
  assert.match(styles, /dashboard-glass-aurora__wave[\s\S]*filter: blur\(48px\)/)
  assert.doesNotMatch(styles, /clip-path: polygon\(43% 0, 57% 0, 82% 100%, 18% 100%\)/)
  assert.match(styles, /dashboard-glass-aurora__pane[\s\S]*background-size: 5% 100%/)
  assert.doesNotMatch(styles, /dashboard-glass-aurora__pane[\s\S]*repeating-linear-gradient/)
  assert.match(styles, /backdrop-filter: blur\(3px\) saturate\(125%\) contrast\(108%\)/)
  assert.match(personalization, /role="switch"/)
  assert.match(personalization, /h-6 w-11 shrink-0 items-center overflow-hidden rounded-full/)
  assert.match(personalization, /animate=\{\{ x: usuario\.podePersonalizarTema \? 18 : 0 \}\}/)
})

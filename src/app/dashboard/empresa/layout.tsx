'use client'

import { useCallback, useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { useTheme } from '@/contexts/ThemeContext'
import { obterLogoPorTema } from '@/data/temasELogos'
import { ContainersProvider } from '@/contexts/ContainersContext'
import { 
  LayoutDashboard, 
  Truck, 
  Users, 
  DollarSign, 
  FilePieChart, 
  UserSquare2, 
  Settings,
  LogOut,
  Menu,
  X,
  ClipboardList,
  Bell,
  Archive,
  Container as ContainerIcon,
  type LucideIcon,
  ReceiptText,
  Eye,
  EyeOff,
  MessageSquare,
} from 'lucide-react'
import ThemeToggle from '@/components/landing/ThemeToggle'
import NotificacoesPanel from '@/components/dashboard/NotificacoesPanel'
import { normalizarModulos, type ModuloCodigo } from '@/utils/planos'
import { useSessionActivity } from '@/hooks/useSessionActivity'
import { DashboardMotion } from '@/components/motion/DashboardMotion'
import AlertasSistema from '@/components/dashboard/AlertasSistema'

// ─── Marcadores Operacionais do Cliente (Empresa) ─────────────────────────────
interface NavEmpresaItem {
  path: string
  icon: LucideIcon
  label: string
  modulo: ModuloCodigo | null
  notificacaoModulo: string
  somenteGestor?: boolean
  visaoGeral?: boolean
}

interface PerfilEmpresaUsuario {
  role: 'GESTOR_EMPRESA' | 'OPERADOR' | 'VISUALIZADOR'
  acessoDashboardGeral: boolean
}

const NAV_EMPRESA: NavEmpresaItem[] = [
  { path: '/dashboard/empresa', icon: LayoutDashboard, label: 'PAINEL OPERACIONAL', modulo: null, notificacaoModulo: 'GERAL', visaoGeral: true },
  { path: '/dashboard/empresa/frota', icon: Truck, label: 'FROTA / VEÍCULOS', modulo: 'FROTA', notificacaoModulo: 'FROTA' },
  { path: '/dashboard/empresa/motoristas', icon: Users, label: 'MOTORISTAS', modulo: 'FROTA', notificacaoModulo: 'MOTORISTAS', somenteGestor: true },
  { path: '/dashboard/empresa/containers', icon: ContainerIcon, label: 'CONTAINERS', modulo: 'FROTA', notificacaoModulo: 'CONTAINERS' },
  { path: '/dashboard/empresa/custos', icon: DollarSign, label: 'CUSTOS / DESPESAS', modulo: 'GESTAO', notificacaoModulo: 'CUSTOS' },
  { path: '/dashboard/empresa/contas-pagar', icon: ReceiptText, label: 'CONTAS A PAGAR', modulo: 'CONTAS_PAGAR', notificacaoModulo: 'CONTAS_PAGAR', somenteGestor: true },
  { path: '/dashboard/empresa/tarefas', icon: ClipboardList, label: 'TAREFAS', modulo: 'TAREFAS', notificacaoModulo: 'TAREFAS' },
  { path: '/dashboard/empresa/arquivos', icon: Archive, label: 'ARQUIVO OPERACIONAL', modulo: null, notificacaoModulo: 'RELATORIOS', somenteGestor: true },
  { path: '/dashboard/empresa/relatorios', icon: FilePieChart, label: 'RELATÓRIOS', modulo: 'RELATORIOS', notificacaoModulo: 'RELATORIOS', somenteGestor: true },
  { path: '/dashboard/empresa/usuarios', icon: UserSquare2, label: 'OPERADORES', modulo: null, notificacaoModulo: 'USUARIOS', somenteGestor: true },
]

const CONFIG_ITEM = { path: '/dashboard/empresa/configuracoes', icon: Settings, label: 'CONFIGURAÇÕES' }
const NOTIFICACOES_ITEM: NavEmpresaItem = { path: '/dashboard/empresa/notificacoes', icon: Bell, label: 'NOTIFICAÇÕES', modulo: null, notificacaoModulo: 'TODAS' }
const SUPORTE_ITEM: NavEmpresaItem = { path: '/dashboard/empresa/chat', icon: MessageSquare, label: 'SUPORTE E TICKETS', modulo: null, notificacaoModulo: 'CHAT', somenteGestor: true }

// Larguras da sidebar recolhida (só ícones) e expandida (ícones + texto)
const LARGURA_RECOLHIDA = '72px'
const LARGURA_EXPANDIDA = '16rem'
const SIDEBAR_HIDDEN_MODULES_KEY = '@rpmtruck:sidebar-hidden-modules'

function obterChavePreferenciaSidebar() {
  try {
    const usuario = JSON.parse(localStorage.getItem('@rpmtruck:user') || '{}')
    const identidade = usuario.id || usuario.email || 'local'
    return `${SIDEBAR_HIDDEN_MODULES_KEY}:${encodeURIComponent(String(identidade))}`
  } catch {
    return `${SIDEBAR_HIDDEN_MODULES_KEY}:local`
  }
}

export default function EmpresaLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const usaDadosContainers = [
    '/dashboard/empresa/containers',
    '/dashboard/empresa/custos',
    '/dashboard/empresa/motoristas',
  ].some(rota => pathname === rota || pathname.startsWith(`${rota}/`))

  const conteudo = <EmpresaLayoutInterno>{children}</EmpresaLayoutInterno>
  return usaDadosContainers ? <ContainersProvider>{conteudo}</ContainersProvider> : conteudo
}

function EmpresaLayoutInterno({ children }: { children: React.ReactNode }) {
  useSessionActivity()
  const { primary, isLight, themeReady, semanticColors } = useTheme()
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [sidebarExpandida, setSidebarExpandida] = useState(false)
  const [nomeEmpresa, setNomeEmpresa] = useState('Minha Empresa')
  const [modulosAtivos, setModulosAtivos] = useState<ModuloCodigo[]>([])
  const [perfilUsuario, setPerfilUsuario] = useState<PerfilEmpresaUsuario | null>(null)
  const [pendenciasPorModulo, setPendenciasPorModulo] = useState<Record<string, number>>({})
  const [ticketsNaoLidos, setTicketsNaoLidos] = useState(0)
  const [acessoCarregado, setAcessoCarregado] = useState(false)
  const [modulosOcultos, setModulosOcultos] = useState<string[]>([])

  // Resgata os dados da sessão guardada no login
  useEffect(() => {
    const userData = localStorage.getItem('@rpmtruck:user')
    if (userData) {
      const parsed = JSON.parse(userData)
      const empresaLocal = parsed.empresaInfo ?? parsed.empresa
      queueMicrotask(() => {
        if (empresaLocal?.nome) setNomeEmpresa(empresaLocal.nome)
        setModulosAtivos(normalizarModulos(empresaLocal?.modulos))
      })
    }

    fetch('/api/empresa/perfil', { cache: 'no-store' })
      .then(async (response) => {
        const data = await response.json()
        if (!response.ok) throw new Error(data.erro || 'Acesso suspenso.')
        setNomeEmpresa(data.empresa.nome)
        setModulosAtivos(normalizarModulos(data.empresa.modulos))
        setPerfilUsuario(data.usuario)

        const usuarioLocal = userData ? JSON.parse(userData) : {}
        localStorage.setItem('@rpmtruck:user', JSON.stringify({
          ...usuarioLocal,
          empresa: data.empresa,
          empresaInfo: data.empresa,
        }))
      })
      .catch(() => {
        localStorage.removeItem('@rpmtruck:user')
        window.location.replace('/auth/login')
      })
      .finally(() => setAcessoCarregado(true))
  }, [])

  useEffect(() => {
    try {
      const salvos: unknown = JSON.parse(localStorage.getItem(obterChavePreferenciaSidebar()) || '[]')
      if (!Array.isArray(salvos)) return
      const rotasValidas = new Set(NAV_EMPRESA.map((item) => item.path))
      queueMicrotask(() => setModulosOcultos(
        salvos.filter((path): path is string => typeof path === 'string' && rotasValidas.has(path)),
      ))
    } catch {
      localStorage.removeItem(obterChavePreferenciaSidebar())
    }
  }, [])

  const atualizarModuloOculto = (path: string, ocultar: boolean) => {
    setModulosOcultos((atuais) => {
      const proximos = ocultar
        ? Array.from(new Set([...atuais, path]))
        : atuais.filter((item) => item !== path)
      try {
        localStorage.setItem(obterChavePreferenciaSidebar(), JSON.stringify(proximos))
      } catch {
        // A preferência permanece na sessão se o navegador bloquear o storage.
      }
      return proximos
    })
  }

  const eGestor = perfilUsuario?.role === 'GESTOR_EMPRESA'
  const itemPermitido = useCallback((item: NavEmpresaItem) => {
    if (item.modulo && !modulosAtivos.includes(item.modulo)) return false
    if (eGestor) return true
    if (item.somenteGestor) return false
    if (item.visaoGeral) return Boolean(perfilUsuario?.acessoDashboardGeral)
    return true
  }, [eGestor, modulosAtivos, perfilUsuario?.acessoDashboardGeral])

  const atualizarResumoSuporte = useCallback(async () => {
    if (!eGestor) return
    try {
      const response = await fetch('/api/chat', { cache: 'no-store' })
      if (!response.ok) return
      const body = await response.json()
      const tickets = Array.isArray(body.tickets) ? body.tickets : []
      setTicketsNaoLidos(tickets.reduce((total: number, ticket: { naoLidas?: number }) => total + (ticket.naoLidas ?? 0), 0))
    } catch {
      // O atalho permanece disponível mesmo se o contador não puder ser atualizado.
    }
  }, [eGestor])

  useEffect(() => {
    if (!eGestor) return
    const initial = window.setTimeout(() => void atualizarResumoSuporte(), 0)
    const interval = window.setInterval(() => { if (!document.hidden) void atualizarResumoSuporte() }, 30_000)
    return () => { window.clearTimeout(initial); window.clearInterval(interval) }
  }, [atualizarResumoSuporte, eGestor])

  useEffect(() => {
    if (!acessoCarregado || !perfilUsuario) return
    const pagina = [...NAV_EMPRESA, NOTIFICACOES_ITEM, SUPORTE_ITEM]
      .sort((a, b) => b.path.length - a.path.length)
      .find((item) => pathname === item.path || pathname.startsWith(`${item.path}/`))
    const configuracaoBloqueada = pathname.startsWith(CONFIG_ITEM.path) && !eGestor
    if (configuracaoBloqueada || (pagina && !itemPermitido(pagina))) {
      const destino = NAV_EMPRESA.find(itemPermitido)?.path || '/auth/login'
      window.location.replace(destino)
    }
  }, [acessoCarregado, eGestor, itemPermitido, pathname, perfilUsuario])

  const paginaAtual = [...NAV_EMPRESA, NOTIFICACOES_ITEM, SUPORTE_ITEM]
    .sort((a, b) => b.path.length - a.path.length)
    .find((item) => pathname === item.path || pathname.startsWith(`${item.path}/`))
  const rotaAtualPermitida = Boolean(
    acessoCarregado
    && perfilUsuario
    && !(!eGestor && pathname.startsWith(CONFIG_ITEM.path))
    && (!paginaAtual || itemPermitido(paginaAtual)),
  )

  const handleLogout = () => {
    localStorage.removeItem('@rpmtruck:user')
    window.location.href = '/auth/login'
  }

  // ─── Conteúdo Interno da Sidebar ───────────────────────────────────────────
  const renderSidebarContent = (expandida: boolean) => {
    const totalNotificacoes = Object.values(pendenciasPorModulo).reduce((total, quantidade) => total + quantidade, 0)
    const notificacoesAtivas = pathname === NOTIFICACOES_ITEM.path
    const itensPermitidos = NAV_EMPRESA.filter(itemPermitido)
    const itensVisiveis = itensPermitidos.filter((item) => !modulosOcultos.includes(item.path))
    const itensOcultos = itensPermitidos.filter((item) => modulosOcultos.includes(item.path))
    return (
      <div className="flex flex-col h-full justify-between p-4 font-mono">
        <div className="min-h-0 flex-1 overflow-y-auto pr-1 custom-scrollbar">
          {/* Header da Sidebar com Logo Ajustada */}
          <div className="mb-6 py-3 border-b border-white/10 flex items-center justify-center min-h-[64px]">
            {expandida ? (
              <div className="w-full px-2 flex flex-col justify-center">
                <div className="flex items-center gap-2">
                  <img
                    src={`/logos/${obterLogoPorTema(primary)}`}
                    alt="RPMTRUCK"
                    className={`h-7 w-auto object-contain transition-opacity duration-200 ${themeReady ? 'opacity-100' : 'opacity-0'}`}
                  />
                  <span className="font-black text-xl tracking-tight whitespace-nowrap" style={{ color: 'var(--foreground)' }}>
                    RPM<span style={{ color: primary }}>TRUCK</span>
                  </span>
                </div>
                <div className="text-[9px] uppercase tracking-[0.2em] text-foreground-muted mt-1 truncate pl-0.5">
                  {nomeEmpresa}
                </div>
              </div>
            ) : (
              /* Logo em destaque quando a Sidebar está recolhida */
              <div className="w-10 h-10 flex items-center justify-center shrink-0 p-1 rounded bg-white/5 hover:bg-white/10 transition-all">
                <img
                  src={`/logos/${obterLogoPorTema(primary)}`}
                  alt="RPMTRUCK"
                  className={`h-full w-full object-contain transition-opacity duration-200 ${themeReady ? 'opacity-100' : 'opacity-0'}`}
                />
              </div>
            )}
          </div>

          {/* Links de Navegação */}
          <nav className="space-y-1" aria-label="Módulos da empresa">
            <AnimatePresence initial={false}>
            {itensVisiveis.map((item) => {
              const active = pathname === item.path || pathname.startsWith(`${item.path}/`)
              const Icon = item.icon
              const totalPendencias = pendenciasPorModulo[item.notificacaoModulo] ?? 0
              const mostrarIndicador = totalPendencias > 0

              return (
                <motion.div
                  layout
                  key={item.path}
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ duration: 0.16, ease: [0.2, 0, 0, 1] }}
                >
                <Link 
                  href={item.path}
                  onClick={() => setMobileOpen(false)}
                  title={!expandida ? item.label : undefined}
                  className={`relative flex items-center gap-3 px-3 py-2.5 text-xs font-bold uppercase tracking-wider transition-all rounded-sm ${
                    active 
                      ? 'text-black font-black' 
                      : 'text-foreground-muted hover:text-foreground hover:bg-white/5'
                  }`}
                  style={{ 
                    backgroundColor: active ? primary : 'transparent',
                    clipPath: active ? 'polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 6px 100%, 0 calc(100% - 6px))' : 'none'
                  }}
                >
                  <span className="relative shrink-0 flex items-center justify-center w-5">
                    <Icon size={18} className={active ? 'text-black' : 'text-foreground-muted'} />
                    {!expandida && mostrarIndicador && (
                      <span
                        className="absolute -top-1 -right-1.5 w-2.5 h-2.5 rounded-full border border-black animate-pulse"
                        style={{ backgroundColor: semanticColors.warning }}
                      />
                    )}
                  </span>
                  {expandida && <span className="flex-1 truncate">{item.label}</span>}
                  {expandida && mostrarIndicador && (
                    <span
                      className="text-[9px] font-black px-1.5 py-0.5 rounded-full shrink-0"
                      style={{ backgroundColor: active ? '#000' : primary, color: active ? primary : '#000' }}
                      title={`${totalPendencias} pendência(s)`}
                    >
                      {totalPendencias}
                    </span>
                  )}
                </Link>
                </motion.div>
              )
            })}
            </AnimatePresence>

            {expandida && itensOcultos.length > 0 && (
              <motion.div layout className="mt-4 border-t pt-3" style={{ borderColor: 'var(--border)' }}>
                <div className="mb-2 flex items-center justify-between gap-2 px-1">
                  <span className="text-[8px] font-bold uppercase tracking-[0.16em] text-foreground-muted">Atalhos compactos</span>
                  <button
                    type="button"
                    onClick={() => {
                      setModulosOcultos([])
                      try { localStorage.setItem(obterChavePreferenciaSidebar(), '[]') } catch {}
                    }}
                    className="inline-flex items-center gap-1 text-[8px] font-bold uppercase tracking-wider hover:underline"
                    style={{ color: primary }}
                  >
                    <Eye size={10} /> Exibir todos
                  </button>
                </div>
                <div className="grid grid-cols-4 gap-1">
                  {itensOcultos.map((item) => {
                    const Icon = item.icon
                    const active = pathname === item.path || pathname.startsWith(`${item.path}/`)
                    return (
                      <Link
                        key={item.path}
                        href={item.path}
                        onClick={() => setMobileOpen(false)}
                        title={item.label}
                        aria-label={item.label}
                        className="relative flex h-9 items-center justify-center border"
                        style={{ color: active ? primary : 'var(--foreground-muted)', borderColor: active ? primary : 'var(--border)' }}
                      >
                        <Icon size={15} />
                        {(pendenciasPorModulo[item.notificacaoModulo] ?? 0) > 0 && (
                          <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full" style={{ backgroundColor: 'var(--status-warning)' }} />
                        )}
                      </Link>
                    )
                  })}
                </div>
              </motion.div>
            )}

            {expandida && (
              <details className="group mt-3 border-t pt-2" style={{ borderColor: 'var(--border)' }}>
                <summary className="flex cursor-pointer list-none items-center gap-2 px-1 py-2 text-[9px] font-bold uppercase tracking-wider text-foreground-muted hover:text-foreground">
                  <EyeOff size={12} /> Personalizar módulos
                </summary>
                <div className="space-y-1 border p-2" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background)' }}>
                  {itensPermitidos.map((item) => {
                    const oculto = modulosOcultos.includes(item.path)
                    return (
                      <label key={item.path} className="flex cursor-pointer items-center gap-2 py-1 text-[9px] uppercase text-foreground-muted">
                        <input
                          type="checkbox"
                          checked={!oculto}
                          onChange={(event) => atualizarModuloOculto(item.path, !event.target.checked)}
                          style={{ accentColor: primary }}
                        />
                        <span className="truncate">{item.label}</span>
                      </label>
                    )
                  })}
                  <p className="pt-1 text-[8px] leading-relaxed text-foreground-muted">Apenas visual: permissões e acesso permanecem iguais.</p>
                </div>
              </details>
            )}
          </nav>
        </div>

        {/* ─── RODAPÉ: CONFIGURAÇÕES + SAIR ─── */}
        <div className="space-y-1 pt-4 border-t border-white/10">
          <Link
            href={NOTIFICACOES_ITEM.path}
            onClick={() => setMobileOpen(false)}
            title={!expandida ? NOTIFICACOES_ITEM.label : undefined}
            className={`flex items-center gap-3 px-3 py-2.5 text-xs font-bold uppercase tracking-wider transition-all rounded-sm ${
              notificacoesAtivas
                ? 'text-black font-black'
                : 'text-foreground-muted hover:text-foreground hover:bg-white/5'
            }`}
            style={{
              backgroundColor: notificacoesAtivas ? primary : 'transparent',
              clipPath: notificacoesAtivas ? 'polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 6px 100%, 0 calc(100% - 6px))' : 'none'
            }}
          >
            <span className="relative flex w-5 shrink-0 items-center justify-center">
              <Bell size={18} className={notificacoesAtivas ? 'text-black' : 'text-foreground-muted'} />
              {!expandida && totalNotificacoes > 0 && <span className="absolute -right-1.5 -top-1 h-2.5 w-2.5 rounded-full border border-black" style={{ backgroundColor: semanticColors.warning }} />}
            </span>
            {expandida && <span className="flex-1 truncate">{NOTIFICACOES_ITEM.label}</span>}
            {expandida && totalNotificacoes > 0 && <span className="shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-black" style={{ backgroundColor: notificacoesAtivas ? '#000' : primary, color: notificacoesAtivas ? primary : '#000' }}>{totalNotificacoes > 99 ? '99+' : totalNotificacoes}</span>}
          </Link>
          {eGestor && (
            <Link
              href={CONFIG_ITEM.path}
              onClick={() => setMobileOpen(false)}
              title={!expandida ? CONFIG_ITEM.label : undefined}
              className={`flex items-center gap-3 px-3 py-2.5 text-xs font-bold uppercase tracking-wider transition-all rounded-sm ${
                pathname === CONFIG_ITEM.path
                  ? 'text-black font-black'
                  : 'text-foreground-muted hover:text-foreground hover:bg-white/5'
              }`}
              style={{
                backgroundColor: pathname === CONFIG_ITEM.path ? primary : 'transparent',
                clipPath: pathname === CONFIG_ITEM.path ? 'polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 6px 100%, 0 calc(100% - 6px))' : 'none'
              }}
            >
              <Settings size={18} className={`shrink-0 ${pathname === CONFIG_ITEM.path ? 'text-black' : 'text-foreground-muted'}`} />
              {expandida && <span className="flex-1 truncate">{CONFIG_ITEM.label}</span>}
            </Link>
          )}

          <button 
            onClick={handleLogout}
            title={!expandida ? 'SAIR DO TERMINAL' : undefined}
            className="w-full flex items-center gap-3 px-3 py-2.5 text-xs font-bold uppercase tracking-wider text-red-500 hover:bg-red-500/10 transition-all rounded-sm font-mono"
          >
            <LogOut size={18} className="shrink-0" />
            {expandida && <span>SAIR DO TERMINAL</span>}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex transition-colors duration-300" style={{ backgroundColor: 'var(--background)' }}>
      
      {/* SIDEBAR DESKTOP — RECOLHE QUANDO O MOUSE SAI, EXPANDE NO HOVER */}
      <aside 
        onMouseEnter={() => setSidebarExpandida(true)}
        onMouseLeave={() => setSidebarExpandida(false)}
        className="hidden md:block border-r shrink-0 z-20 overflow-hidden transition-[width] duration-300 ease-in-out relative"
        style={{ 
          backgroundColor: isLight ? '#f9f9f9' : '#090909', 
          borderColor: 'var(--border)',
          width: sidebarExpandida ? LARGURA_EXPANDIDA : LARGURA_RECOLHIDA
        }}
      >
        <div style={{ width: LARGURA_EXPANDIDA }} className="h-full">
          {renderSidebarContent(sidebarExpandida)}
        </div>
      </aside>

      {/* PAINEL DE CONTEÚDO PRINCIPAL */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* HEADER TOP OPERACIONAL */}
        <header 
          className="h-16 border-b flex items-center justify-between px-6 z-10"
          style={{ backgroundColor: 'var(--background)', borderColor: 'var(--border)' }}
        >
          {/* Menu Mobile Button */}
          <button type="button" onClick={() => setMobileOpen(true)} aria-label="Abrir menu da empresa" aria-expanded={mobileOpen} className="md:hidden min-h-11 min-w-11 text-foreground-muted hover:text-foreground">
            <Menu size={20} />
          </button>

          {/* Nome do Terminal / Página */}
          <div className="hidden md:flex items-center gap-2 text-xs font-bold font-mono text-foreground-muted">
            <span>TERMINAL</span>
            <span style={{ color: primary }}>/</span>
            <span className="uppercase text-foreground">{pathname.split('/').pop() || 'PAINEL'}</span>
          </div>

          {/* Área de Ferramentas (Sininho, Theme e Infos) */}
          <div className="flex items-center gap-4">
            {eGestor && <Link href={SUPORTE_ITEM.path} aria-label="Abrir suporte e tickets" title="Suporte e tickets" className="relative flex min-h-11 min-w-11 items-center justify-center border transition-colors hover:text-foreground" style={{ borderColor: pathname === SUPORTE_ITEM.path ? primary : 'var(--border)', color: pathname === SUPORTE_ITEM.path ? primary : 'var(--foreground-muted)' }}><MessageSquare size={18} />{ticketsNaoLidos > 0 && <span className="absolute -right-1.5 -top-1.5 min-w-5 rounded-full px-1 py-0.5 text-center text-[9px] font-black text-black" style={{ backgroundColor: primary }}>{ticketsNaoLidos > 99 ? '99+' : ticketsNaoLidos}</span>}</Link>}
            <NotificacoesPanel onPendenciasChange={setPendenciasPorModulo} />
            <ThemeToggle />
            <div className="w-px h-6 bg-border hidden sm:block" style={{ backgroundColor: 'var(--border)' }} />
            <div className="hidden sm:flex flex-col text-right font-mono">
              <span className="text-[11px] font-bold text-foreground truncate max-w-[150px]">{nomeEmpresa}</span>
              <span className="text-[9px] text-foreground-muted uppercase tracking-widest">{eGestor ? 'Painel Gestor' : perfilUsuario?.role === 'OPERADOR' ? 'Painel Operador' : 'Painel Visualizador'}</span>
            </div>
          </div>
        </header>

        {/* ÁREA DE RENDERIZAÇÃO DA PÁGINA INTERNA */}
        <main className="flex-1 overflow-y-auto p-3 sm:p-5 md:p-8">
          {rotaAtualPermitida && <AlertasSistema />}
          <DashboardMotion>
            {rotaAtualPermitida ? children : <div className="py-16 text-center text-xs font-mono text-foreground-muted">Validando permissões...</div>}
          </DashboardMotion>
        </main>
      </div>

      {/* SIDEBAR RESPONSIVA MOBILE (sempre expandida, é um overlay) */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-xs z-30 md:hidden"
            />
            <motion.div 
              initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }}
              transition={{ type: 'tween', duration: 0.25 }}
              role="dialog"
              aria-modal="true"
              aria-label="Menu da empresa"
              className="fixed inset-y-0 left-0 w-64 z-40 md:hidden border-r"
              style={{ backgroundColor: isLight ? '#ffffff' : '#0a0a0a', borderColor: 'var(--border)' }}
            >
              <button 
                type="button"
                onClick={() => setMobileOpen(false)}
                aria-label="Fechar menu da empresa"
                className="absolute top-4 right-4 min-h-10 min-w-10 text-foreground-muted hover:text-foreground"
              >
                <X size={18} />
              </button>
              {renderSidebarContent(true)}
            </motion.div>
          </>
        )}
      </AnimatePresence>

    </div>
  )
}

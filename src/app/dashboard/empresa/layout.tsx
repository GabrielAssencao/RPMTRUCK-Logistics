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
} from 'lucide-react'
import ThemeToggle from '@/components/landing/ThemeToggle'
import NotificacoesPanel from '@/components/dashboard/NotificacoesPanel'
import { normalizarModulos, type ModuloCodigo } from '@/utils/planos'

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
  { path: '/dashboard/empresa/contas-pagar', icon: ReceiptText, label: 'CONTAS A PAGAR', modulo: 'GESTAO', notificacaoModulo: 'CONTAS_PAGAR', somenteGestor: true },
  { path: '/dashboard/empresa/tarefas', icon: ClipboardList, label: 'TAREFAS', modulo: 'TAREFAS', notificacaoModulo: 'TAREFAS' },
  { path: '/dashboard/empresa/arquivos', icon: Archive, label: 'ARQUIVO OPERACIONAL', modulo: null, notificacaoModulo: 'RELATORIOS', somenteGestor: true },
  { path: '/dashboard/empresa/relatorios', icon: FilePieChart, label: 'RELATÓRIOS', modulo: 'RELATORIOS', notificacaoModulo: 'RELATORIOS', somenteGestor: true },
  { path: '/dashboard/empresa/usuarios', icon: UserSquare2, label: 'OPERADORES', modulo: null, notificacaoModulo: 'USUARIOS', somenteGestor: true },
]

const CONFIG_ITEM = { path: '/dashboard/empresa/configuracoes', icon: Settings, label: 'CONFIGURAÇÕES' }
const NOTIFICACOES_ITEM: NavEmpresaItem = { path: '/dashboard/empresa/notificacoes', icon: Bell, label: 'NOTIFICAÇÕES', modulo: null, notificacaoModulo: 'TODAS' }

// Larguras da sidebar recolhida (só ícones) e expandida (ícones + texto)
const LARGURA_RECOLHIDA = '72px'
const LARGURA_EXPANDIDA = '16rem'

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
  const { primary, isLight, themeReady } = useTheme()
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [sidebarExpandida, setSidebarExpandida] = useState(false)
  const [nomeEmpresa, setNomeEmpresa] = useState('Minha Empresa')
  const [modulosAtivos, setModulosAtivos] = useState<ModuloCodigo[]>([])
  const [perfilUsuario, setPerfilUsuario] = useState<PerfilEmpresaUsuario | null>(null)
  const [pendenciasPorModulo, setPendenciasPorModulo] = useState<Record<string, number>>({})
  const [acessoCarregado, setAcessoCarregado] = useState(false)

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

  const eGestor = perfilUsuario?.role === 'GESTOR_EMPRESA'
  const itemPermitido = useCallback((item: NavEmpresaItem) => {
    if (item.modulo && !modulosAtivos.includes(item.modulo)) return false
    if (eGestor) return true
    if (item.somenteGestor) return false
    if (item.visaoGeral) return Boolean(perfilUsuario?.acessoDashboardGeral)
    return true
  }, [eGestor, modulosAtivos, perfilUsuario?.acessoDashboardGeral])

  useEffect(() => {
    if (!acessoCarregado || !perfilUsuario) return
    const pagina = [...NAV_EMPRESA, NOTIFICACOES_ITEM]
      .sort((a, b) => b.path.length - a.path.length)
      .find((item) => pathname === item.path || pathname.startsWith(`${item.path}/`))
    const configuracaoBloqueada = pathname.startsWith(CONFIG_ITEM.path) && !eGestor
    if (configuracaoBloqueada || (pagina && !itemPermitido(pagina))) {
      const destino = NAV_EMPRESA.find(itemPermitido)?.path || '/auth/login'
      window.location.replace(destino)
    }
  }, [acessoCarregado, eGestor, itemPermitido, pathname, perfilUsuario])

  const paginaAtual = [...NAV_EMPRESA, NOTIFICACOES_ITEM]
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
    return (
      <div className="flex flex-col h-full justify-between p-4 font-mono">
        <div>
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
          <nav className="space-y-1">
            {NAV_EMPRESA.filter(itemPermitido).map((item) => {
              const active = pathname === item.path
              const Icon = item.icon
              const totalPendencias = pendenciasPorModulo[item.notificacaoModulo] ?? 0
              const mostrarIndicador = totalPendencias > 0

              return (
                <Link 
                  key={item.path} 
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
                        style={{ backgroundColor: primary }}
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
              )
            })}
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
              {!expandida && totalNotificacoes > 0 && <span className="absolute -right-1.5 -top-1 h-2.5 w-2.5 rounded-full border border-black" style={{ backgroundColor: primary }} />}
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
          <button onClick={() => setMobileOpen(true)} className="md:hidden text-foreground-muted hover:text-foreground">
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
          {rotaAtualPermitida ? children : <div className="py-16 text-center text-xs font-mono text-foreground-muted">Validando permissões...</div>}
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
              className="fixed inset-y-0 left-0 w-64 z-40 md:hidden border-r"
              style={{ backgroundColor: isLight ? '#ffffff' : '#0a0a0a', borderColor: 'var(--border)' }}
            >
              <button 
                onClick={() => setMobileOpen(false)}
                className="absolute top-4 right-4 text-foreground-muted hover:text-foreground"
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

'use client'

import { useCallback, useEffect, useState } from 'react'
import type { Dispatch, ReactNode, SetStateAction } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { useTheme } from '@/contexts/ThemeContext'
import { 
  LayoutDashboard, 
  Building2, 
  ShieldAlert, 
  Settings,
  LogOut,
  Menu,
  X,
  ShieldCheck,
  CreditCard,
  MessageSquare,
  Megaphone,
  Bell,
  CalendarDays,
} from 'lucide-react'
import ThemeToggle from '@/components/landing/ThemeToggle'
import NotificacoesPanel from '@/components/dashboard/NotificacoesPanel'
import SidebarBrandMark, { SidebarBrandIdentity } from '@/components/dashboard/SidebarBrandMark'
import SidebarAccountCard from '@/components/dashboard/SidebarAccountCard'
import DashboardEnvironmentBackground from '@/components/dashboard/DashboardEnvironmentBackground'
import { useSessionActivity } from '@/hooks/useSessionActivity'
import { DashboardMotion } from '@/components/motion/DashboardMotion'
import { ADMIN_BACKGROUND_PREFERENCES_EVENT, lerEstiloFundoAdmin } from '@/lib/adminSidebarPreferences'
import { estiloFundoEmpresaValido, type EstiloFundoEmpresa } from '@/lib/empresaPreferences'

// ─── Marcadores Operacionais do Super Admin ─────────────────────────────────
const NAV_ADMIN = [
  { id: 'dashboard', icon: LayoutDashboard, label: 'PAINEL MASTER' },
  { id: 'cronograma', icon: CalendarDays, label: 'CRONOGRAMA' },
  { id: 'companies', icon: Building2, label: 'EMPRESAS / CLIENTES' },
  { id: 'requests', icon: ShieldAlert, label: 'SOLICITAÇÕES DE ACESSO' },
  { id: 'subscriptions', icon: CreditCard, label: 'PLANOS / ASSINATURAS' },
  { id: 'resets', icon: ShieldAlert, label: 'REDEFINIÇÕES DE SENHA' },
  { id: 'security', icon: ShieldCheck, label: 'LOGS / SEGURANÇA' },
  { id: 'alerts', icon: Megaphone, label: 'ALERTAS DO SISTEMA' },
] as const

const CONFIG_ITEM = { id: 'settings', icon: Settings, label: 'CONFIGURAÇÕES' } as const
const NOTIFICATIONS_ITEM = { id: 'notifications', icon: Bell, label: 'CENTRAL DE NOTIFICAÇÕES' } as const

const LARGURA_RECOLHIDA = '72px'
const LARGURA_EXPANDIDA = '16rem'
export type AdminTab = 'cronograma' | 'dashboard' | 'companies' | 'requests' | 'subscriptions' | 'resets' | 'security' | 'chat' | 'alerts' | 'notifications' | 'settings'

// Dicionário para traduzir o activeTab no Header
const TAB_LABELS: Record<AdminTab, string> = {
  'cronograma': 'CRONOGRAMA',
  'chat': 'CHAT',
  'alerts': 'ALERTAS',
  'dashboard': 'PAINEL',
  'companies': 'EMPRESAS',
  'requests': 'SOLICITAÇÕES',
  'subscriptions': 'PLANOS / ASSINATURAS',
  'resets': 'SOLICITAÇÕES',
  'security': 'SEGURANÇA',
  'notifications': 'NOTIFICAÇÕES',
  'settings': 'CONFIGURAÇÕES'
}

interface AdminLayoutProps {
  children: ReactNode
  activeTab: AdminTab
  setActiveTab: Dispatch<SetStateAction<AdminTab>>
}

export default function AdminLayout({ children, activeTab, setActiveTab }: AdminLayoutProps) {
  const router = useRouter()
  useSessionActivity()
  const { primary, isLight } = useTheme()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [sidebarExpandida, setSidebarExpandida] = useState(false)
  const [accountName, setAccountName] = useState('Administrador')
  const [pendenciasPorModulo, setPendenciasPorModulo] = useState<Record<string, number>>({})
  const [ticketsNaoLidos, setTicketsNaoLidos] = useState(0)
  const [estiloFundo, setEstiloFundo] = useState<EstiloFundoEmpresa>('DESLIGADO')

  useEffect(() => {
    const initial = window.setTimeout(() => {
      try {
        const account: unknown = JSON.parse(localStorage.getItem('@rpmtruck:user') || 'null')
        if (account && typeof account === 'object' && 'nome' in account && typeof account.nome === 'string' && account.nome.trim()) setAccountName(account.nome)
      } catch { /* A identificação local é apenas apresentação. */ }
    }, 0)
    return () => window.clearTimeout(initial)
  }, [])

  useEffect(() => {
    const sincronizar = (event?: Event) => {
      const detalhe = (event as CustomEvent<EstiloFundoEmpresa> | undefined)?.detail
      setEstiloFundo(estiloFundoEmpresaValido(detalhe) ? detalhe : lerEstiloFundoAdmin())
    }
    const initial = window.setTimeout(sincronizar, 0)
    window.addEventListener(ADMIN_BACKGROUND_PREFERENCES_EVENT, sincronizar)
    return () => {
      window.clearTimeout(initial)
      window.removeEventListener(ADMIN_BACKGROUND_PREFERENCES_EVENT, sincronizar)
    }
  }, [])

  const atualizarResumoSuporte = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/chat?resumo=true', { cache: 'no-store' })
      if (!response.ok) return
      const body = await response.json()
      const tickets = Array.isArray(body.tickets) ? body.tickets : []
      const totalNaoLidas = typeof body.resumo?.mensagensNaoLidas === 'number'
        ? body.resumo.mensagensNaoLidas
        : tickets.reduce((total: number, ticket: { naoLidas?: number }) => total + (ticket.naoLidas ?? 0), 0)
      setTicketsNaoLidos(totalNaoLidas)
    } catch {
      // Falha do contador não impede a abertura da central.
    }
  }, [])

  useEffect(() => {
    const initial = window.setTimeout(() => void atualizarResumoSuporte(), 0)
    const interval = window.setInterval(() => { if (!document.hidden) void atualizarResumoSuporte() }, 30_000)
    return () => { window.clearTimeout(initial); window.clearInterval(interval) }
  }, [atualizarResumoSuporte])

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } finally {
      localStorage.removeItem('@rpmtruck:admin')
      localStorage.removeItem('@rpmtruck:user')
      router.replace('/auth/login')
    }
  }

  const changeTab = (tabId: AdminTab) => {
    setActiveTab(tabId)
    setMobileOpen(false) 
  }

  const renderSidebarContent = (expandida: boolean) => {
    const totalNotificacoes = Object.values(pendenciasPorModulo).reduce((total, quantidade) => total + quantidade, 0)
    return (
      <div className={`flex flex-col h-full justify-between p-4 font-mono ${expandida ? '' : 'pt-0'}`}>
        <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto pr-1 custom-scrollbar">
          <div className={`-mx-4 mb-3 flex shrink-0 items-center justify-start border-b border-border px-4 ${expandida ? 'h-20' : 'h-16'}`}>
            {expandida ? (
              <SidebarBrandIdentity
                primary={primary}
              />
            ) : (
              <SidebarBrandMark primary={primary} />
            )}
          </div>

          <nav className="space-y-1">
            {NAV_ADMIN.map((item) => {
              const active = activeTab === item.id
              const Icon = item.icon
              const moduloNotificacao = item.id === 'cronograma' ? 'TAREFAS' : item.id === 'requests' ? 'ACESSO' : item.id === 'subscriptions' ? 'ASSINATURA' : item.id === 'resets' ? 'SENHAS' : item.id === 'companies' ? 'EMPRESAS' : 'SISTEMA'
              const totalPendencias = pendenciasPorModulo[moduloNotificacao] ?? 0

              return (
                <button 
                  key={item.id} 
                  onClick={() => changeTab(item.id)}
                  title={!expandida ? item.label : undefined}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-xs font-bold uppercase tracking-wider transition-all rounded-sm ${
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
                    {!expandida && totalPendencias > 0 && (
                      <span
                        className="absolute -top-1 -right-1.5 w-2.5 h-2.5 rounded-full border border-black animate-pulse"
                        style={{ backgroundColor: primary }}
                      />
                    )}
                  </span>
                  {expandida && <span className="flex-1 text-left truncate">{item.label}</span>}
                  
                  {expandida && totalPendencias > 0 && (
                    <span
                      className="text-[9px] font-black px-1.5 py-0.5 rounded-full shrink-0"
                      style={{ backgroundColor: active ? '#000' : primary, color: active ? primary : '#000' }}
                    >
                      {totalPendencias}
                    </span>
                  )}
                </button>
              )
            })}
          </nav>
        </div>

        <div className="shrink-0 space-y-1 pt-4 border-t border-border">
          <SidebarAccountCard name={accountName} company="RPMTruck" expanded={expandida}
            logout={(
              <button
            onClick={handleLogout}
            title={!expandida ? 'SAIR DO TERMINAL' : undefined}
            className="w-full flex items-center gap-3 px-3 py-2.5 text-xs font-bold uppercase tracking-wider text-red-500 hover:bg-red-500/10 transition-all rounded-sm font-mono"
          >
            <LogOut size={18} className="shrink-0" />
            {expandida && <span>SAIR DO TERMINAL</span>}
          </button>
            )}
          >
            <button
              onClick={() => changeTab(NOTIFICATIONS_ITEM.id)}
              title={!expandida ? NOTIFICATIONS_ITEM.label : undefined}
              className={`w-full flex items-center gap-3 px-3 py-2.5 text-xs font-bold uppercase tracking-wider transition-all rounded-sm ${activeTab === NOTIFICATIONS_ITEM.id ? 'text-black font-black' : 'text-foreground-muted hover:text-foreground hover:bg-white/5'}`}
              style={{
                backgroundColor: activeTab === NOTIFICATIONS_ITEM.id ? primary : 'transparent',
                clipPath: activeTab === NOTIFICATIONS_ITEM.id ? 'polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 6px 100%, 0 calc(100% - 6px))' : 'none'
              }}
            >
              <span className="relative shrink-0">
                <Bell size={18} />
                {totalNotificacoes > 0 && !expandida && <span className="absolute -right-1.5 -top-1.5 h-2.5 w-2.5 rounded-full border border-black" style={{ backgroundColor: primary }} />}
              </span>
              {expandida && <span className="flex-1 truncate text-left">{NOTIFICATIONS_ITEM.label}</span>}
              {expandida && totalNotificacoes > 0 && <span className="min-w-5 rounded-full px-1.5 py-0.5 text-center text-[9px] font-black text-black" style={{ backgroundColor: primary }}>{totalNotificacoes > 99 ? '99+' : totalNotificacoes}</span>}
            </button>

            <button
              onClick={() => changeTab(CONFIG_ITEM.id)}
              title={!expandida ? CONFIG_ITEM.label : undefined}
              className={`w-full flex items-center gap-3 px-3 py-2.5 text-xs font-bold uppercase tracking-wider transition-all rounded-sm ${
                activeTab === CONFIG_ITEM.id
                  ? 'text-black font-black'
                  : 'text-foreground-muted hover:text-foreground hover:bg-white/5'
              }`}
              style={{
                backgroundColor: activeTab === CONFIG_ITEM.id ? primary : 'transparent',
                clipPath: activeTab === CONFIG_ITEM.id ? 'polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 6px 100%, 0 calc(100% - 6px))' : 'none'
              }}
            >
              <Settings size={18} className={`shrink-0 ${activeTab === CONFIG_ITEM.id ? 'text-black' : 'text-foreground-muted'}`} />
              {expandida && <span className="flex-1 text-left truncate">{CONFIG_ITEM.label}</span>}
            </button>


          </SidebarAccountCard>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-dvh overflow-hidden transition-colors duration-300" style={{ backgroundColor: 'var(--background)' }}>
      
      <aside
        onMouseEnter={() => setSidebarExpandida(true)}
        onMouseLeave={() => setSidebarExpandida(false)}
        className="relative z-20 hidden shrink-0 overflow-hidden border-r transition-[width] duration-300 ease-in-out motion-reduce:transition-none md:block"
        aria-label="Navegação principal do Superadmin"
        style={{
          backgroundColor: isLight ? '#f9f9f9' : '#090909',
          borderColor: 'var(--border)',
          width: sidebarExpandida ? LARGURA_EXPANDIDA : LARGURA_RECOLHIDA,
          willChange: 'width',
        }}
      >
        <div style={{ width: LARGURA_EXPANDIDA }} className="h-full">
          {renderSidebarContent(sidebarExpandida)}
        </div>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        
        <header 
          className="h-16 shrink-0 border-b flex items-center justify-between px-3 sm:px-6 z-40"
          style={{ backgroundColor: 'var(--background)', borderColor: 'var(--border)' }}
        >
          <button type="button" onClick={() => setMobileOpen(true)} aria-label="Abrir menu do Superadmin" aria-expanded={mobileOpen} className="md:hidden min-h-11 min-w-11 text-foreground-muted hover:text-foreground">
            <Menu size={20} />
          </button>

          <div className="hidden md:flex items-center gap-2 text-xs font-bold font-mono text-foreground-muted">
            <span>RPMTRUCK</span>
            <span style={{ color: primary }}>/</span>
            <span className="uppercase text-foreground">{TAB_LABELS[activeTab] || 'PAINEL'}</span>
          </div>

          <div className="flex items-center gap-4">
            <button type="button" onClick={() => changeTab('chat')} aria-label="Abrir suporte e tickets" title="Suporte e tickets" className="relative flex min-h-11 min-w-11 items-center justify-center border transition-colors hover:text-foreground" style={{ borderColor: activeTab === 'chat' ? primary : 'var(--border)', color: activeTab === 'chat' ? primary : 'var(--foreground-muted)' }}><MessageSquare size={18} />{ticketsNaoLidos > 0 && <span className="absolute -right-1.5 -top-1.5 min-w-5 rounded-full px-1 py-0.5 text-center text-[9px] font-black text-black" style={{ backgroundColor: primary }}>{ticketsNaoLidos > 99 ? '99+' : ticketsNaoLidos}</span>}</button>
            <NotificacoesPanel onPendenciasChange={setPendenciasPorModulo} centralHref={null} onOpenCentral={() => changeTab('notifications')} />
            <ThemeToggle />
            <div className="w-px h-6 bg-border hidden sm:block" style={{ backgroundColor: 'var(--border)' }} />
            <div className="hidden sm:flex flex-col text-right font-mono">
              <span className="text-[11px] font-bold text-foreground truncate max-w-[150px]">Administrador Base</span>
              <span className="text-[9px] uppercase tracking-widest" style={{ color: primary }}>Admin Master</span>
            </div>
          </div>
        </header>

        <main
          className={`relative min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain custom-scrollbar ${estiloFundo !== 'DESLIGADO' ? 'dashboard-environment-active' : ''}`}
          data-dashboard-environment={estiloFundo.toLowerCase()}
          style={{ scrollbarGutter: 'stable' }}
        >
          <DashboardEnvironmentBackground estilo={estiloFundo} />
          <div className="relative z-[1] p-3 sm:p-5 md:p-8">
            <DashboardMotion motionKey={activeTab}>{children}</DashboardMotion>
          </div>
        </main>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 md:hidden"
            />
            <motion.div 
              initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }}
              transition={{ type: 'tween', duration: 0.25 }}
              role="dialog"
              aria-modal="true"
              aria-label="Menu do Superadmin"
              className="fixed inset-y-0 left-0 z-[60] w-64 border-r md:hidden"
              style={{ backgroundColor: isLight ? '#ffffff' : '#0a0a0a', borderColor: 'var(--border)' }}
            >
              <button 
                type="button"
                onClick={() => setMobileOpen(false)}
                aria-label="Fechar menu do Superadmin"
                className="absolute top-4 right-4 z-50 min-h-10 min-w-10 text-foreground-muted hover:text-foreground"
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

'use client'

import { useState } from 'react'
import type { Dispatch, ReactNode, SetStateAction } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTheme } from '@/contexts/ThemeContext'
import { obterLogoPorTema } from '@/data/temasELogos'
import { 
  LayoutDashboard, 
  Building2, 
  ShieldAlert, 
  Settings,
  LogOut,
  Menu,
  X,
  Bell,
  CheckCheck,
  ShieldCheck,
  CreditCard,
} from 'lucide-react'
import ThemeToggle from '@/components/landing/ThemeToggle'
import NotificacoesPanel from '@/components/dashboard/NotificacoesPanel'

// ─── Marcadores Operacionais do Super Admin ─────────────────────────────────
const NAV_ADMIN = [
  { id: 'dashboard', icon: LayoutDashboard, label: 'PAINEL MASTER' },
  { id: 'companies', icon: Building2, label: 'EMPRESAS / CLIENTES' },
  { id: 'requests', icon: ShieldAlert, label: 'SOLICITAÇÕES DE ACESSO' },
  { id: 'subscriptions', icon: CreditCard, label: 'PLANOS / ASSINATURAS' },
  { id: 'resets', icon: ShieldAlert, label: 'REDEFINIÇÕES DE SENHA' },
  { id: 'security', icon: ShieldCheck, label: 'LOGS / SEGURANÇA' },
] as const

const CONFIG_ITEM = { id: 'settings', icon: Settings, label: 'CONFIGURAÇÕES' } as const

const LARGURA_RECOLHIDA = '72px'
const LARGURA_EXPANDIDA = '16rem'
export type AdminTab = 'dashboard' | 'companies' | 'requests' | 'subscriptions' | 'resets' | 'security' | 'settings'

// Dicionário para traduzir o activeTab no Header
const TAB_LABELS: Record<AdminTab, string> = {
  'dashboard': 'PAINEL',
  'companies': 'EMPRESAS',
  'requests': 'SOLICITAÇÕES',
  'subscriptions': 'PLANOS / ASSINATURAS',
  'resets': 'SOLICITAÇÕES',
  'security': 'SEGURANÇA',
  'settings': 'CONFIGURAÇÕES'
}

interface AdminLayoutProps {
  children: ReactNode
  activeTab: AdminTab
  setActiveTab: Dispatch<SetStateAction<AdminTab>>
}

export default function AdminLayout({ children, activeTab, setActiveTab }: AdminLayoutProps) {
  const { primary, isLight, themeReady } = useTheme()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [sidebarExpandida, setSidebarExpandida] = useState(false)
  const [pendenciasPorModulo, setPendenciasPorModulo] = useState<Record<string, number>>({})

  const handleLogout = () => {
    localStorage.removeItem('@rpmtruck:admin')
    window.location.href = '/auth/login'
  }

  const changeTab = (tabId: AdminTab) => {
    setActiveTab(tabId)
    setMobileOpen(false) 
  }

  const renderSidebarContent = (expandida: boolean) => {
    return (
      <div className="flex flex-col h-full justify-between p-4 font-mono">
        <div>
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
                <div className="text-[9px] uppercase tracking-[0.2em] mt-1 truncate pl-0.5" style={{ color: primary }}>
                  SUPER ADMIN
                </div>
              </div>
            ) : (
              <div className="w-10 h-10 flex items-center justify-center shrink-0 p-1 rounded bg-white/5 hover:bg-white/10 transition-all">
                <img
                  src={`/logos/${obterLogoPorTema(primary)}`}
                  alt="RPMTRUCK"
                  className={`h-full w-full object-contain transition-opacity duration-200 ${themeReady ? 'opacity-100' : 'opacity-0'}`}
                />
              </div>
            )}
          </div>

          <nav className="space-y-1">
            {NAV_ADMIN.map((item) => {
              const active = activeTab === item.id
              const Icon = item.icon
              const moduloNotificacao = item.id === 'requests' ? 'ACESSO' : item.id === 'subscriptions' ? 'ASSINATURA' : item.id === 'resets' ? 'SENHAS' : item.id === 'companies' ? 'EMPRESAS' : 'SISTEMA'
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

        <div className="space-y-1 pt-4 border-t border-white/10">
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

      <div className="flex-1 flex flex-col min-w-0">
        
        {/* CORREÇÃO DO Z-INDEX DO HEADER: Passou de z-10 para z-40 */}
        <header 
          className="h-16 border-b flex items-center justify-between px-6 z-40"
          style={{ backgroundColor: 'var(--background)', borderColor: 'var(--border)' }}
        >
          <button onClick={() => setMobileOpen(true)} className="md:hidden text-foreground-muted hover:text-foreground">
            <Menu size={20} />
          </button>

          <div className="hidden md:flex items-center gap-2 text-xs font-bold font-mono text-foreground-muted">
            <span>RPMTRUCK</span>
            <span style={{ color: primary }}>/</span>
            <span className="uppercase text-foreground">{TAB_LABELS[activeTab] || 'PAINEL'}</span>
          </div>

          <div className="flex items-center gap-4">
            <NotificacoesPanel onPendenciasChange={setPendenciasPorModulo} />
            <ThemeToggle />
            <div className="w-px h-6 bg-border hidden sm:block" style={{ backgroundColor: 'var(--border)' }} />
            <div className="hidden sm:flex flex-col text-right font-mono">
              <span className="text-[11px] font-bold text-foreground truncate max-w-[150px]">Administrador Base</span>
              <span className="text-[9px] uppercase tracking-widest" style={{ color: primary }}>Admin Master</span>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar">
          {children}
        </main>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <>
            {/* CORREÇÃO DO Z-INDEX BACKDROP MOBILE: Passou de z-30 para z-50 */}
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 md:hidden"
            />
            {/* CORREÇÃO DO Z-INDEX PANEL MOBILE: Passou de z-40 para z-60 */}
            <motion.div 
              initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }}
              transition={{ type: 'tween', duration: 0.25 }}
              className="fixed inset-y-0 left-0 w-64 z-60 md:hidden border-r"
              style={{ backgroundColor: isLight ? '#ffffff' : '#0a0a0a', borderColor: 'var(--border)' }}
            >
              <button 
                onClick={() => setMobileOpen(false)}
                className="absolute top-4 right-4 text-foreground-muted hover:text-foreground z-50"
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

function SininhoNotificacoesAdmin() {
  const { primary } = useTheme()
  const [aberto, setAberto] = useState(false)

  const [notificacoes, setNotificacoes] = useState<Array<{ id: string; tipo: string; modulo: string; titulo: string; mensagem: string; tempo: string; lida: boolean }>>([])

  const naoLidas = notificacoes.filter(n => !n.lida).length
  const marcarTodasComoLidas = () => setNotificacoes(prev => prev.map(n => ({ ...n, lida: true })))

  return (
    <div className="relative font-mono">
      <button 
        onClick={() => setAberto(!aberto)}
        className="relative p-2 border rounded-sm transition-all hover:bg-white/5 flex items-center justify-center"
        style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
      >
        <Bell size={16} className={naoLidas > 0 ? 'animate-pulse' : ''} style={{ color: naoLidas > 0 ? primary : 'var(--foreground-muted)' }} />
        {naoLidas > 0 && (
          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full border border-black" style={{ backgroundColor: primary }} />
        )}
      </button>

      <AnimatePresence>
        {aberto && (
          <>
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setAberto(false)}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
            />
            
            <motion.div 
              initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'tween', duration: 0.3 }}
              className="fixed inset-y-0 right-0 w-80 sm:w-96 border-l shadow-2xl z-50 flex flex-col"
              style={{ backgroundColor: 'var(--background)', borderColor: 'var(--border)' }}
            >
              <div className="flex items-center justify-between p-5 border-b" style={{ borderColor: 'var(--border)' }}>
                <div className="flex items-center gap-2">
                  <Bell size={18} style={{ color: primary }} />
                  <span className="text-sm font-black uppercase tracking-wider" style={{ color: 'var(--foreground)' }}>Central do Admin</span>
                </div>
                <button onClick={() => setAberto(false)} className="text-foreground-muted hover:text-red-500 transition-colors">
                  <X size={20} />
                </button>
              </div>

              {naoLidas > 0 && (
                <div className="px-5 py-3 border-b bg-white/5" style={{ borderColor: 'var(--border)' }}>
                  <button onClick={marcarTodasComoLidas} className="text-xs flex items-center gap-1 hover:underline font-bold" style={{ color: primary }}>
                    <CheckCheck size={14} /> Marcar {naoLidas} como lidas
                  </button>
                </div>
              )}

              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {notificacoes.length === 0 ? (
                  <div className="text-xs text-center py-10 text-foreground-muted">Nenhuma notificação no momento.</div>
                ) : (
                  notificacoes.map((n) => (
                    <div key={n.id} className="p-4 border text-xs transition-colors rounded-sm"
                      style={{ 
                        backgroundColor: n.lida ? 'transparent' : `${primary}10`, 
                        borderColor: n.lida ? 'var(--border)' : primary 
                      }}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-[10px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-sm" 
                              style={{ backgroundColor: 'var(--foreground)', color: 'var(--background)' }}>
                          {n.modulo}
                        </span>
                        <span className="text-[9px] text-foreground-muted">{n.tempo}</span>
                      </div>
                      <div className="font-bold text-sm mb-1" style={{ color: 'var(--foreground)' }}>{n.titulo}</div>
                      <div className="text-[11px] font-sans leading-relaxed" style={{ color: 'var(--foreground-muted)' }}>{n.mensagem}</div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { useTheme } from '@/contexts/ThemeContext'
import SubscriptionManagement from './_componentes/SubscriptionManagement'
import { AppearancePreferences, NavigationPreferences, NotificationPreferences } from './_componentes/PreferencePanels'
import SecuritySessions from './_componentes/SecuritySessions'
import { ActionFeedback } from '@/components/motion/DashboardMotion'
import { ProfileSkeleton } from '@/components/motion/OperationalFeedback'
import {
  lerEstiloFundoEmpresa,
  estiloFundoEmpresaValido,
  lerModulosOcultosEmpresa,
  salvarEstiloFundoEmpresa,
  salvarModulosOcultosEmpresa,
  type EstiloFundoEmpresa,
} from '@/lib/empresaPreferences'
import { normalizarModulos, type ModuloCodigo } from '@/utils/planos'
import { 
  Building2, 
  Palette, 
  ShieldCheck, 
  Save, 
  CreditCard,
  Trash2,
  KeyRound,
  UserRound,
  PanelLeft,
  BellRing,
  TriangleAlert,
} from 'lucide-react'

// As opções de cor vêm de src/data/temasELogos.ts — a MESMA fonte usada pela
// Navbar da landing e pela logo da Sidebar do dashboard. Antes esse array
// vivia duplicado aqui com hexadecimais diferentes dos da Navbar (ex:
// Âmbar #eab308 aqui vs #f59e0b lá), o que fazia a logo do topo da sidebar
// cair no fallback verde sempre que alguém escolhia uma cor só existente
// aqui. Centralizando, escolher uma cor em Configurações agora sempre bate
// com uma logo real.

type SettingsTab = 'PERFIL' | 'APARENCIA' | 'NAVEGACAO' | 'NOTIFICACOES' | 'SEGURANCA' | 'ASSINATURA' | 'RISCO'

export default function ConfiguracoesPage() {
  const { primary, setPrimary, isLight, setIsLight } = useTheme()
  const [montado, setMontado] = useState(false)
  const [tabAtiva, setTabAtiva] = useState<SettingsTab>('PERFIL')

  const [form, setForm] = useState({
    nome: '', cnpj: '', email: '', telefone: ''
  })
  const [salvando, setSalvando] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [diasDesdeAlteracao, setDiasDesdeAlteracao] = useState<number | null>(null)
  const [solicitandoReset, setSolicitandoReset] = useState(false)
  const [feedbackSenha, setFeedbackSenha] = useState('')
  const [carregandoPerfil, setCarregandoPerfil] = useState(true)
  const [identidade, setIdentidade] = useState({ role: '', plano: '', ativo: true })
  const [modulosPermitidos, setModulosPermitidos] = useState<ModuloCodigo[]>([])
  const [modulosOcultos, setModulosOcultos] = useState<string[]>([])
  const [estiloFundo, setEstiloFundo] = useState<EstiloFundoEmpresa>('DESLIGADO')

  useEffect(() => {
    queueMicrotask(() => {
      setMontado(true)
      setModulosOcultos(lerModulosOcultosEmpresa())
      setEstiloFundo(lerEstiloFundoEmpresa())
    })
    fetch('/api/empresa/perfil', { cache: 'no-store' })
      .then(async response => {
        const data = await response.json()
        if (!response.ok) throw new Error(data.erro)
        setForm({
          nome: data.empresa.nome || '',
          cnpj: data.empresa.cnpj || '',
          email: data.empresa.email || '',
          telefone: data.empresa.telefone || '',
        })
        setIdentidade({
          role: data.usuario.role || '',
          plano: data.empresa.plano || '',
          ativo: data.usuario.ativo !== false,
        })
        setModulosPermitidos(normalizarModulos(data.usuario.modulosAcesso))
        setPrimary(data.usuario.corTema)
        setIsLight(Boolean(data.usuario.temaClaro))
        if (estiloFundoEmpresaValido(data.usuario.estiloFundo)) {
          setEstiloFundo(data.usuario.estiloFundo)
          salvarEstiloFundoEmpresa(data.usuario.estiloFundo)
        }
        if (data.usuario.senhaAlteradaEm) {
          setDiasDesdeAlteracao(Math.max(0, Math.floor((Date.now() - new Date(data.usuario.senhaAlteradaEm).getTime()) / 86_400_000)))
        }
      })
      .catch(error => setFeedback(error instanceof Error ? error.message : 'Falha ao carregar perfil.'))
      .finally(() => setCarregandoPerfil(false))
  }, [setIsLight, setPrimary])

  const atualizarModulosOcultos = (paths: string[]) => {
    setModulosOcultos(salvarModulosOcultosEmpresa(paths))
  }

  const salvarPreferenciaVisual = async (corTema: string, temaClaro: boolean, fundo = estiloFundo) => {
    try {
      const response = await fetch('/api/empresa/preferencias-visuais', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ corTema, temaClaro, estiloFundo: fundo }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.erro || 'Não foi possível salvar o tema.')
      return true
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Falha ao salvar o tema.')
      return false
    }
  }

  const atualizarEstiloFundo = async (estilo: EstiloFundoEmpresa) => {
    const anterior = estiloFundo
    setEstiloFundo(estilo)
    salvarEstiloFundoEmpresa(estilo)
    if (!await salvarPreferenciaVisual(primary, isLight, estilo)) {
      setEstiloFundo(anterior)
      salvarEstiloFundoEmpresa(anterior)
    }
  }

  const atualizarCorTema = (corTema: string) => {
    setPrimary(corTema)
    void salvarPreferenciaVisual(corTema, isLight)
  }

  const atualizarModoTema = (temaClaro: boolean) => {
    setIsLight(temaClaro)
    void salvarPreferenciaVisual(primary, temaClaro)
  }

  const salvarPerfil = async () => {
    setSalvando(true); setFeedback('')
    const response = await fetch('/api/empresa/perfil', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, cnpj: form.cnpj || null, telefone: form.telefone || null }) })
    const data = await response.json(); setSalvando(false)
    setFeedback(response.ok ? 'Dados da empresa salvos com sucesso.' : data.erro || 'Não foi possível salvar o perfil.')
  }

  const solicitarAlteracaoSenha = async () => {
    setFeedbackSenha('')
    setSolicitandoReset(true)
    try {
      const response = await fetch('/api/auth/change-password/request', {
        method: 'POST',
      })
      const data = await response.json()
      if (!response.ok) {
        setFeedbackSenha(data.erro || 'Não foi possível enviar a solicitação.')
        return
      }
      setFeedbackSenha(data.mensagem)
    } catch {
      setFeedbackSenha('Falha de conexão ao enviar a solicitação.')
    } finally {
      setSolicitandoReset(false)
    }
  }

  if (!montado) return null

  return (
    <div className="space-y-6 max-w-[1200px] mx-auto">
      {feedback && <ActionFeedback message={feedback} tone={feedback.includes('sucesso') ? 'success' : 'error'} />}
      
      {/* ─── CABEÇALHO ─── */}
      <div className="mb-8">
        <h1 className="text-3xl font-black uppercase tracking-tight" style={{ color: 'var(--foreground)', fontFamily: 'Rajdhani, sans-serif' }}>
          Configurações <span style={{ color: primary }}>do Sistema</span>
        </h1>
        <p className="text-sm font-mono mt-1" style={{ color: 'var(--foreground-muted)' }}>
          Preferências de interface, dados da transportadora, segurança e assinatura.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-[240px_minmax(0,1fr)] lg:gap-8">
        
        {/* ─── MENU LATERAL (TABS) ─── */}
        <div className="flex gap-2 overflow-x-auto pb-2 font-mono md:sticky md:top-0 md:block md:self-start md:space-y-1 md:overflow-visible md:pb-0">
          <TabButton 
            ativa={tabAtiva === 'PERFIL'} onClick={() => setTabAtiva('PERFIL')} 
            icone={<Building2 size={16} />} label="PERFIL DA EMPRESA" primary={primary} 
          />
          <TabButton 
            ativa={tabAtiva === 'APARENCIA'} onClick={() => setTabAtiva('APARENCIA')} 
            icone={<Palette size={16} />} label="APARÊNCIA & TEMA" primary={primary} 
          />
          <TabButton
            ativa={tabAtiva === 'NAVEGACAO'} onClick={() => setTabAtiva('NAVEGACAO')}
            icone={<PanelLeft size={16} />} label="NAVEGAÇÃO" primary={primary}
          />
          <TabButton
            ativa={tabAtiva === 'NOTIFICACOES'} onClick={() => setTabAtiva('NOTIFICACOES')}
            icone={<BellRing size={16} />} label="NOTIFICAÇÕES" primary={primary}
          />
          <TabButton 
            ativa={tabAtiva === 'SEGURANCA'} onClick={() => setTabAtiva('SEGURANCA')} 
            icone={<ShieldCheck size={16} />} label="SEGURANÇA" primary={primary}
          />
          <TabButton
            ativa={tabAtiva === 'ASSINATURA'} onClick={() => setTabAtiva('ASSINATURA')}
            icone={<CreditCard size={16} />} label="GESTÃO DO PLANO" primary={primary}
          />
          <TabButton
            ativa={tabAtiva === 'RISCO'} onClick={() => setTabAtiva('RISCO')}
            icone={<TriangleAlert size={16} />} label="ÁREA DE RISCO" primary={primary}
            danger
          />
        </div>

        {/* ─── ÁREA DE CONTEÚDO DAS TABS ─── */}
        <div className="min-w-0">
          <AnimatePresence mode="wait">
            
            {/* TIPO: APARÊNCIA */}
            {tabAtiva === 'APARENCIA' && (
              <motion.div key="aparencia" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} transition={{ duration: 0.24 }}>
                <AppearancePreferences
                  primary={primary}
                  isLight={isLight}
                  backgroundStyle={estiloFundo}
                  onPrimaryChange={atualizarCorTema}
                  onThemeChange={atualizarModoTema}
                  onBackgroundStyleChange={(estilo) => void atualizarEstiloFundo(estilo)}
                />
              </motion.div>
            )}

            {tabAtiva === 'NAVEGACAO' && (
              <motion.div key="navegacao" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} transition={{ duration: 0.24 }}>
                <NavigationPreferences
                  primary={primary}
                  allowedModules={modulosPermitidos}
                  hiddenPaths={modulosOcultos}
                  onHiddenPathsChange={atualizarModulosOcultos}
                />
              </motion.div>
            )}

            {tabAtiva === 'NOTIFICACOES' && (
              <motion.div key="notificacoes" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} transition={{ duration: 0.24 }}>
                <NotificationPreferences primary={primary} />
              </motion.div>
            )}

            {/* TIPO: PERFIL */}
            {tabAtiva === 'PERFIL' && (
              <motion.div key="perfil" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                {carregandoPerfil ? <ProfileSkeleton /> : (
                <div className="p-6 border space-y-6" style={{ backgroundColor: 'var(--background-secondary)', borderColor: 'var(--border)' }}>
                  <CompanyIdentityCard
                    nome={form.nome}
                    email={form.email}
                    cnpj={form.cnpj}
                    role={identidade.role}
                    plano={identidade.plano}
                    ativo={identidade.ativo}
                    primary={primary}
                  />

                  <h3 className="border-b pb-4 text-xs font-bold font-mono uppercase tracking-widest" style={{ color: 'var(--foreground)', borderColor: 'var(--border)' }}>
                    Dados cadastrais
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <InputField label="Nome da Empresa / Razão Social" valor={form.nome} onChange={(v) => setForm({...form, nome: v})} primary={primary} />
                    <InputField label="CNPJ / NIF" valor={form.cnpj} onChange={(v) => setForm({...form, cnpj: v})} primary={primary} />
                    <InputField label="E-mail de Contato" valor={form.email} onChange={(v) => setForm({...form, email: v})} primary={primary} />
                    <InputField label="Telefone Base" valor={form.telefone} onChange={(v) => setForm({...form, telefone: v})} primary={primary} />
                  </div>

                  <div className="pt-4 flex justify-end">
                    <motion.button 
                      onClick={() => void salvarPerfil()}
                      disabled={salvando}
                      whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                      className="flex items-center gap-2 px-6 py-3 text-xs font-bold uppercase tracking-widest transition-all font-mono"
                      style={{ 
                        backgroundColor: primary, color: '#000',
                        clipPath: 'polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px))'
                      }}
                    >
                      <Save size={16} /> {salvando ? 'Salvando...' : 'Salvar Alterações'}
                    </motion.button>
                  </div>
                </div>
                )}
              </motion.div>
            )}

            {/* TIPO: SEGURANÇA */}
            {tabAtiva === 'SEGURANCA' && (
              <motion.div key="seguranca" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} transition={{ duration: 0.24 }} className="space-y-6">
                <div className="p-6 border space-y-6 mb-6" style={{ backgroundColor: 'var(--background-secondary)', borderColor: 'var(--border)' }}>
                  <h3 className="text-xs font-bold font-mono uppercase tracking-widest flex items-center gap-2" style={{ color: 'var(--foreground)' }}>
                    <ShieldCheck size={16} style={{ color: primary }}/> Credenciais de Acesso
                  </h3>
                  <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>
                    {diasDesdeAlteracao === null
                      ? 'Carregando a data da última alteração da senha…'
                      : `A sua senha atual foi definida há ${diasDesdeAlteracao} dia${diasDesdeAlteracao === 1 ? '' : 's'}. Recomendamos revisar a credencial periodicamente.`}
                  </p>
                  <div className="space-y-4" aria-describedby="fluxo-alteracao-senha">
                    <div id="fluxo-alteracao-senha" className="border p-4 text-xs leading-relaxed text-foreground-muted" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background)' }}>
                      <span className="mb-1 block font-mono text-[10px] font-bold uppercase tracking-widest" style={{ color: primary }}>Fluxo protegido</span>
                      A alteração não é feita diretamente neste painel. A solicitação entra na fila do superadmin; após a aprovação, você recebe um código de uso único e define a nova senha na recuperação de acesso.
                    </div>
                    {feedbackSenha && (
                      <ActionFeedback
                        message={feedbackSenha}
                        tone={feedbackSenha.startsWith('Solicitação enviada') ? 'success' : 'error'}
                        className="text-xs"
                      />
                    )}
                    <button
                      type="button"
                      onClick={() => void solicitarAlteracaoSenha()}
                      disabled={solicitandoReset || feedbackSenha.startsWith('Solicitação enviada')}
                      className="interactive-control inline-flex min-h-11 items-center gap-2 border px-4 text-xs font-mono font-bold uppercase tracking-widest transition-colors hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
                      style={{ borderColor: primary, color: primary }}
                    >
                      <KeyRound size={15} /> {solicitandoReset ? 'Enviando solicitação…' : 'Solicitar alteração ao superadmin'}
                    </button>
                    <p className="text-[10px] text-foreground-muted">Nenhuma senha é enviada ou armazenada nesta etapa.</p>
                  </div>
                </div>

                <SecuritySessions primary={primary} />

              </motion.div>
            )}

            {tabAtiva === 'RISCO' && (
              <motion.div key="risco" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} transition={{ duration: 0.24 }}>
                <section className="border border-red-500/30 bg-red-500/5 p-5 sm:p-6">
                  <div className="border-b border-red-500/20 pb-4">
                    <h2 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-red-500"><Trash2 size={16} /> Exclusão da empresa</h2>
                    <p className="mt-2 text-[10px] leading-relaxed text-foreground-muted">Ações irreversíveis ficam separadas das configurações rotineiras para reduzir erros.</p>
                  </div>
                  <div className="mt-5 border border-red-500/20 bg-background p-4">
                    <h3 className="text-xs font-bold uppercase tracking-wider">Encerrar conta e remover dados</h3>
                    <p className="mt-2 text-sm text-foreground-muted">Exporte o backup completo e consulte o fluxo protegido antes de encerrar a conta da empresa.</p>
                    <Link href="/dashboard/empresa/configuracoes/exclusao-conta" className="interactive-control mt-4 inline-flex min-h-11 items-center border border-red-500/50 px-4 text-xs font-bold uppercase tracking-wider text-red-500 hover:bg-red-500/10">Abrir exclusão de conta</Link>
                  </div>
                </section>
              </motion.div>
            )}

            {tabAtiva === 'ASSINATURA' && (
              <motion.div key="assinatura" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <SubscriptionManagement />
              </motion.div>
            )}

          </AnimatePresence>
        </div>

      </div>
    </div>
  )
}

// ─── COMPONENTES AUXILIARES ──────────────────────────────────────────────────

function CompanyIdentityCard({
  nome,
  email,
  cnpj,
  role,
  plano,
  ativo,
  primary,
}: {
  nome: string
  email: string
  cnpj: string
  role: string
  plano: string
  ativo: boolean
  primary: string
}) {
  const roleLabel = role === 'GESTOR_EMPRESA' || role === 'GESTOR'
    ? 'Gestor da empresa'
    : role === 'OPERADOR'
      ? 'Operador'
      : role === 'VISUALIZADOR'
        ? 'Visualizador'
        : 'Usuário da empresa'

  return (
    <section
      aria-label="Cartão de identidade da empresa"
      className="relative overflow-hidden border p-5 sm:p-6"
      style={{
        borderColor: `color-mix(in srgb, ${primary} 42%, var(--border))`,
        background: `linear-gradient(125deg, color-mix(in srgb, ${primary} 10%, var(--background)) 0%, var(--background) 58%)`,
      }}
    >
      <span className="absolute inset-y-0 left-0 w-1" style={{ backgroundColor: primary }} aria-hidden="true" />
      <span className="absolute -right-10 -top-12 h-32 w-32 rotate-12 border opacity-20" style={{ borderColor: primary }} aria-hidden="true" />

      <div className="relative grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(260px,0.8fr)] lg:items-center">
        <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center">
          <div
            className="flex h-20 w-20 shrink-0 items-center justify-center border"
            style={{ borderColor: primary, backgroundColor: `${primary}14`, color: primary }}
            aria-hidden="true"
          >
            <UserRound size={38} strokeWidth={1.5} />
          </div>

          <div className="min-w-0">
            <p className="text-[9px] font-black uppercase tracking-[0.22em]" style={{ color: primary }}>Identidade corporativa</p>
            <h3 className="mt-1 truncate font-rajdhani text-2xl font-black uppercase tracking-tight" title={nome || undefined}>
              {nome || 'Nome da transportadora'}
            </h3>
            <p className="mt-1 truncate text-xs text-foreground-muted" title={email || undefined}>{email || 'E-mail não informado'}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="border px-2 py-1 text-[8px] font-black uppercase tracking-widest" style={{ borderColor: `${primary}66`, color: primary }}>
                {plano ? `Plano ${plano.replaceAll('_', ' ')}` : 'Plano não informado'}
              </span>
              <span className="flex items-center gap-1.5 text-[8px] font-black uppercase tracking-widest" style={{ color: ativo ? 'var(--status-success)' : 'var(--status-danger)' }}>
                <i className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" /> {ativo ? 'Acesso ativo' : 'Acesso inativo'}
              </span>
            </div>
          </div>
        </div>

        <dl className="grid grid-cols-1 gap-3 border-t pt-4 sm:grid-cols-2 lg:grid-cols-1 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0" style={{ borderColor: 'var(--border)' }}>
          <div>
            <dt className="text-[8px] font-black uppercase tracking-[0.18em] text-foreground-muted">Perfil de acesso</dt>
            <dd className="mt-1 text-xs font-bold uppercase">{roleLabel}</dd>
          </div>
          <div>
            <dt className="text-[8px] font-black uppercase tracking-[0.18em] text-foreground-muted">Identificação fiscal</dt>
            <dd className="mt-1 text-xs font-bold">{cnpj || 'CNPJ não informado'}</dd>
          </div>
        </dl>
      </div>
    </section>
  )
}

function TabButton({ ativa, onClick, icone, label, primary, danger = false }: { ativa: boolean; onClick: () => void; icone: React.ReactNode; label: string; primary: string; danger?: boolean }) {
  const activeColor = danger ? 'var(--status-danger)' : primary
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={ativa}
      className="flex min-h-12 min-w-max items-center gap-3 px-4 text-xs font-bold uppercase tracking-widest transition-all md:w-full"
      style={{
        backgroundColor: ativa ? `color-mix(in srgb, ${activeColor} 12%, transparent)` : 'transparent',
        color: ativa || danger ? activeColor : 'var(--foreground-muted)',
        borderLeft: `3px solid ${ativa ? activeColor : 'transparent'}`,
      }}
    >
      <span className={ativa ? '' : 'opacity-70'}>{icone}</span>
      {label}
    </button>
  )
}

function InputField({ label, valor, onChange, primary }: { label: string, valor: string, onChange: (v: string) => void, primary: string }) {
  return (
    <div>
      <label className="block text-[10px] uppercase tracking-widest font-bold mb-2 font-mono" style={{ color: 'var(--foreground-muted)' }}>
        {label}
      </label>
      <input 
        type="text" 
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-4 py-3 text-sm outline-none border transition-colors font-mono"
        style={{ backgroundColor: 'var(--background)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
        onFocus={(e) => e.target.style.borderColor = primary}
        onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
      />
    </div>
  )
}

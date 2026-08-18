'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Check, 
  Building2, 
  User, 
  Mail, 
  Phone, 
  Truck,
  Lock, 
  Star, 
  Send, 
  ArrowLeft, 
  Info,
  PlusCircle
} from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'

// ─── Planos disponíveis ─────────────────────────────────────────────
const PLANS = [
  { 
    id: 'ESSENCIAL', 
    name: 'ESSENCIAL', 
    desc: 'Gestão completa e controle operacional para frotas em crescimento', 
    price: 450, setup: 300, users: 4, vehicles: 10,
    modules: [
      'Gestão completa do catálogo de veículos e motoristas',
      'Até 1 ano (365 dias) de histórico e auditoria',
      'Dashboard analítica de custos e combustível (R$)',
      'Controle básico de manutenção preventiva e corretiva',
      'Até 4 usuários administradores e 10 veículos'
    ], 
    restricted: false 
  },
  { 
    id: 'AVANCADO', 
    name: 'AVANÇADO', 
    desc: 'Precisão operacional e gestão multi-bases/pátios', 
    price: 650, setup: 500, users: 10, vehicles: 25,
    modules: [
      'Tudo do plano Essencial',
      'Até 2 anos (730 dias) de histórico analítico',
      'Delegação direta de tarefas e alertas entre operadores',
      'Vincular custos por Veículo + Condutor específico',
      'Gestão de Bases, Pátios e Unidades Operacionais',
      'Até 10 usuários e 25 veículos inclusos'
    ], 
    featured: true, restricted: false 
  },
  { 
    id: 'ENTERPRISE', 
    name: 'ENTERPRISE', 
    desc: 'Inteligência de frota de alta escala com delegação e APIs', 
    price: 1250, setup: 1000, users: 25, vehicles: 80,
    modules: [
      'Tudo do plano Avançado',
      'Até 3 anos (1.095 dias) de histórico de dados',
      'Relatórios e Filtros de Data 100% Personalizados',
      'Notificações e delegações avançadas prioritárias',
      'Até 25 usuários, 80 veículos e Gerente Dedicado'
    ], 
    restricted: false 
  },
  { 
    id: 'PREVIEW', 
    name: 'PREVIEW', 
    desc: 'Acesso de teste — somente via Admin', 
    price: 0, setup: 0, users: 'Ilimitado', vehicles: 'Ilimitado',
    modules: [
      'Ambiente Sandbox de homologação',
      'Acesso antecipado a módulos beta',
      'Testes de novas rotinas operacionais'
    ], 
    restricted: true 
  },
]

const STEPS = [
  'Envie a solicitação',
  'Nossa equipe analisa em até 24h',
  'Você recebe as credenciais por email ou WhatsApp',
  'Acesse e configure sua frota',
]

type FormData = {
  empresa: string
  responsavel: string
  email: string
  whatsapp: string
  veiculos: string
  plano: string
  mensagem: string
  contatoPref: 'email' | 'whatsapp'
}

export default function SolicitarAcesso() {
  const { primary, isLight } = useTheme()
  const router = useRouter()
  const [selectedPlan, setSelectedPlan] = useState<string>('')
  const [form, setForm] = useState<FormData>({
    empresa: '', responsavel: '', email: '', whatsapp: '',
    veiculos: '', plano: '', mensagem: '', contatoPref: 'email',
  })
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const planoParam = params.get('plano')?.toUpperCase() || ''
      if (PLANS.some(p => p.id === planoParam)) {
        handlePlanSelect(planoParam)
      }
    }
  }, [])

  // 🎯 NAVEGAÇÃO SEGURA DE VOLTA PARA A LANDING PAGE
  const handleVoltarLanding = () => {
    if (typeof window !== 'undefined') {
      window.history.scrollRestoration = 'manual'
      window.scrollTo(0, 0)
    }
    router.push('/')
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }))
  }

  const handlePlanSelect = (planId: string) => {
    const plan = PLANS.find(p => p.id === planId)
    setSelectedPlan(planId)
    setForm(f => ({ 
      ...f, 
      plano: planId,
      veiculos: plan && plan.vehicles !== 'Ilimitado' ? String(plan.vehicles) : '0'
    }))
  }

  const handleSubmit = async () => {
    if (!form.empresa || !form.responsavel || !form.email || !form.plano) return
    setLoading(true)
    setErrorMessage('')

    try {
      const res = await fetch('/api/solicitacoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.erro || 'Erro ao processar solicitação.')
      setSubmitted(true)
    } catch (err: any) {
      setErrorMessage(err.message || 'Falha de comunicação com o servidor.')
    } finally {
      setLoading(false)
    }
  }

  if (submitted) {
    return <SuccessScreen primary={primary} isLight={isLight} form={form} onVoltar={handleVoltarLanding} />
  }

  return (
    <div className="min-h-screen transition-colors duration-300 relative overflow-hidden font-mono" style={{ backgroundColor: 'var(--background)', color: 'var(--foreground)' }}>
      <div className="fixed inset-0 pointer-events-none opacity-[0.03]" style={{ backgroundImage: `linear-gradient(${primary}55 1px, transparent 1px), linear-gradient(90deg, ${primary}55 1px, transparent 1px)`, backgroundSize: '60px 60px' }} />
      <div className="fixed inset-0 pointer-events-none" style={{ background: `radial-gradient(ellipse 50% 30% at 50% 0%, ${primary}15 0%, transparent 70%)` }} />

      {/* NAVBAR DA TELA DE SOLICITAÇÃO */}
      <nav className="relative z-20 flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
        <button 
          onClick={handleVoltarLanding} 
          className="flex items-center gap-2 text-sm uppercase tracking-widest font-bold cursor-pointer font-rajdhani hover:opacity-80 transition-opacity" 
          style={{ color: primary }}
        >
          <ArrowLeft size={16} /> Voltar
        </button>

        <div className="font-bold text-lg font-rajdhani" style={{ color: 'var(--foreground)' }}>
          RPM<span style={{ color: primary }}>TRUCK</span>
        </div>

        {/* Rotear para a rota correta de Login */}
        <Link 
          href="/auth/login" 
          className="text-xs uppercase tracking-widest font-semibold font-rajdhani hover:underline" 
          style={{ color: 'var(--foreground-muted)' }}
        >
          Já tenho conta
        </Link>
      </nav>

      <div className="relative z-10 max-w-7xl mx-auto px-6 py-16">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 border rounded-full mb-6 text-xs uppercase tracking-widest font-bold font-mono" style={{ borderColor: `${primary}40`, color: primary, backgroundColor: `${primary}10` }}>
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: primary }} />
            Solicitação de Acesso
          </div>
          <h1 className="text-5xl md:text-7xl font-black leading-none mb-4 font-rajdhani">
            FAÇA PARTE DA<br />
            <span style={{ color: primary }}>EQUIPE VENCEDORA</span>
          </h1>
          <p className="text-foreground-muted max-w-lg mx-auto text-sm font-sans">
            Selecione a estrutura ideal para a sua transportadora. Nossa precificação é transparente e feita para escalar com você.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6, delay: 0.1 }} className="lg:col-span-2 space-y-6">
            
            {/* 01 — PLANOS */}
            <FormSection label="01 — Estrutura e Plano" primary={primary}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3">
                {PLANS.map(plan => (
                  <div key={plan.id} className="relative flex">
                    {plan.featured && (
                      <span className="absolute -top-3 left-4 z-10 text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 border font-mono" style={{ color: primary, borderColor: primary, backgroundColor: 'var(--card)' }}>Popular</span>
                    )}
                    <button disabled={plan.restricted} onClick={() => !plan.restricted && handlePlanSelect(plan.id)} className="w-full relative p-4 text-left border transition-all duration-200 group flex flex-col" style={{ borderColor: selectedPlan === plan.id ? primary : 'var(--border)', backgroundColor: selectedPlan === plan.id ? `${primary}12` : 'var(--card)', opacity: plan.restricted ? 0.45 : 1, cursor: plan.restricted ? 'not-allowed' : 'pointer', clipPath: 'polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px))' }}>
                      <div className="w-full flex items-start justify-between gap-2">
                        <div className="w-full">
                          <div className="font-bold text-sm mb-0.5 flex items-center gap-2 font-rajdhani" style={{ color: selectedPlan === plan.id ? primary : 'var(--foreground)' }}>
                            {plan.restricted && <Lock size={12} />}
                            {plan.name}
                          </div>
                          <div className="text-xs mb-3 font-sans" style={{ color: 'var(--foreground-muted)' }}>{plan.desc}</div>
                          
                          {!plan.restricted && (
                            <div className="flex flex-col gap-1 mt-2 pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
                              <span className="text-xs font-mono font-bold">R$ {plan.price},00 <span className="opacity-50 font-normal">/mês</span></span>
                              <span className="text-[10px] font-mono opacity-70 uppercase tracking-widest">Base: {plan.vehicles} Veículos • {plan.users} Acessos</span>
                            </div>
                          )}
                        </div>
                        {selectedPlan === plan.id && (
                          <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5" style={{ backgroundColor: primary }}><Check size={11} color="#000" /></div>
                        )}
                      </div>
                    </button>
                  </div>
                ))}
              </div>
            </FormSection>

            {/* 02 — DADOS DA TRANSPORTADORA */}
            <FormSection label="02 — Dados da Transportadora" primary={primary}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <InputField icon={<Building2 size={14} />} label="Nome da empresa" name="empresa" placeholder="Transportadora XYZ" value={form.empresa} onChange={handleChange} primary={primary} />
                <InputField icon={<User size={14} />} label="Nome do responsável" name="responsavel" placeholder="João Silva" value={form.responsavel} onChange={handleChange} primary={primary} />
                <InputField icon={<Mail size={14} />} label="E-mail corporativo" name="email" type="email" placeholder="contato@empresa.com" value={form.email} onChange={handleChange} primary={primary} />
                <InputField icon={<Phone size={14} />} label="WhatsApp" name="whatsapp" placeholder="(11) 99999-9999" value={form.whatsapp} onChange={handleChange} primary={primary} />
                <div className="sm:col-span-2 relative">
                  <InputField 
                    icon={<Truck size={14} />} 
                    label="Frota Base do Plano (Pré-preenchido)" 
                    name="veiculos" 
                    type="text" 
                    placeholder="Selecione um plano primeiro" 
                    value={form.veiculos ? `${form.veiculos} Veículos` : ''} 
                    onChange={() => {}} 
                    primary={primary} 
                    readOnly={true} 
                  />
                  {!form.veiculos && (
                    <div className="absolute right-4 top-9 text-[10px] uppercase tracking-widest font-bold text-red-500 bg-background px-2">Aguardando Plano</div>
                  )}
                </div>
              </div>
            </FormSection>

            {/* 03 — PREFERÊNCIA DE CONTATO */}
            <FormSection label="03 — Como prefere receber o acesso?" primary={primary}>
              <div className="flex gap-3">
                {(['email', 'whatsapp'] as const).map(opt => (
                  <button key={opt} onClick={() => setForm(f => ({ ...f, contatoPref: opt }))} className="flex-1 py-3 px-4 border font-bold text-xs uppercase tracking-widest transition-all duration-200 font-rajdhani cursor-pointer" style={{ borderColor: form.contatoPref === opt ? primary : 'var(--border)', backgroundColor: form.contatoPref === opt ? `${primary}12` : 'var(--card)', color: form.contatoPref === opt ? primary : 'var(--foreground-muted)', clipPath: 'polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 6px 100%, 0 calc(100% - 6px))' }}>
                    {opt === 'email' ? '✉ E-mail' : '📱 WhatsApp'}
                  </button>
                ))}
              </div>
            </FormSection>

            {/* 04 — MENSAGEM */}
            <FormSection label="04 — Mensagem Adicional (opcional)" primary={primary}>
              <textarea name="mensagem" placeholder="Precisa de mais veículos ou usuários do que o plano oferece? Descreva suas necessidades aqui..." value={form.mensagem} onChange={handleChange} rows={4} className="w-full resize-none text-sm outline-none transition-all duration-200 p-4 border font-sans" style={{ backgroundColor: 'var(--background-secondary)', border: `1px solid var(--border)`, color: 'var(--foreground)', borderRadius: '0' }} onFocus={e => e.target.style.borderColor = primary} onBlur={e => e.target.style.borderColor = 'var(--border)'} />
            </FormSection>

            {errorMessage && <div className="p-4 border text-xs font-bold uppercase tracking-wider bg-red-500/10 border-red-500/30 text-red-500 font-mono">⚠ {errorMessage}</div>}

            <motion.button onClick={handleSubmit} disabled={loading || !form.empresa || !form.responsavel || !form.email || !form.plano} whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }} className="w-full py-5 font-black text-sm uppercase tracking-[0.2em] flex items-center justify-center gap-3 disabled:opacity-40 disabled:cursor-not-allowed font-rajdhani cursor-pointer" style={{ backgroundColor: primary, color: '#000', clipPath: 'polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 12px 100%, 0 calc(100% - 12px))' }}>
              {loading ? (<><span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" /> ENVIANDO...</>) : (<><Send size={16} /> ENVIAR SOLICITAÇÃO →</>)}
            </motion.button>
          </motion.div>

          {/* SIDEBAR DETALHADA */}
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6, delay: 0.2 }} className="space-y-4">
            <AnimatePresence mode="wait">
              {selectedPlan ? (
                <motion.div key={selectedPlan} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="border p-6" style={{ borderColor: primary, backgroundColor: 'var(--card)' }}>
                  <div className="text-xs uppercase tracking-widest mb-3 font-bold font-mono" style={{ color: primary }}>Resumo do Investimento</div>
                  {(() => {
                    const plan = PLANS.find(p => p.id === selectedPlan)
                    if (!plan) return null
                    return (
                      <>
                        <h3 className="text-2xl font-black mb-1 font-rajdhani" style={{ color: primary }}>{plan.name}</h3>
                        <p className="text-xs mb-4 font-sans" style={{ color: 'var(--foreground-muted)' }}>{plan.desc}</p>
                        
                        <div className="bg-background-secondary border p-4 mb-4" style={{ borderColor: 'var(--border)' }}>
                           <div className="flex justify-between items-end mb-2">
                             <span className="text-[10px] font-bold uppercase tracking-widest opacity-60">Mensalidade</span>
                             <span className="font-mono font-black">R$ {plan.price},00</span>
                           </div>
                           <div className="flex justify-between items-end">
                             <span className="text-[10px] font-bold uppercase tracking-widest opacity-60">Taxa de Setup*</span>
                             <span className="font-mono font-black">R$ {plan.setup},00</span>
                           </div>
                        </div>

                        <ul className="space-y-2 mb-6">
                          {plan.modules.map(m => (
                            <li key={m} className="flex items-center gap-2 text-xs font-mono" style={{ color: 'var(--foreground-muted)' }}>
                              <Check size={14} className="shrink-0" style={{ color: primary }} /> {m}
                            </li>
                          ))}
                        </ul>

                        <div className="mt-4 pt-4 border-t space-y-3" style={{ borderColor: 'var(--border)' }}>
                          <div className="flex gap-2">
                             <Info size={14} className="shrink-0 mt-0.5" style={{ color: primary }} />
                             <p className="text-[10px] leading-relaxed opacity-70 font-mono">
                               *<strong className="text-foreground">Taxa de Implementação (Setup):</strong> Valor único pago na entrada. Cobre a estruturação do seu banco de dados isolado, configuração inicial do ambiente e treinamento da equipe.
                             </p>
                          </div>
                          <div className="flex gap-2">
                             <PlusCircle size={14} className="shrink-0 mt-0.5" style={{ color: primary }} />
                             <p className="text-[10px] leading-relaxed opacity-70 font-mono">
                                <strong className="text-foreground">Expansão sob demanda:</strong> Adicione mais capacidade a qualquer momento. Usuários extras: R$ 25/mês. Veículos extras: R$ 30/mês.
                             </p>
                          </div>
                        </div>
                      </>
                    )
                  })()}
                </motion.div>
              ) : (
                <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="border border-dashed p-6 text-center" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--card)' }}>
                  <Star size={24} className="mx-auto mb-3" style={{ color: 'var(--muted)' }} />
                  <p className="text-sm font-sans" style={{ color: 'var(--foreground-muted)' }}>Selecione um plano ao lado para ver a composição de preços e regras de implementação.</p>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="border p-6" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--card)' }}>
              <div className="text-xs uppercase tracking-widest mb-4 font-bold font-mono" style={{ color: primary }}>Processo de ativação</div>
              <ol className="space-y-3">
                {STEPS.map((step, i) => (
                  <li key={step} className="flex gap-3 text-sm font-mono" style={{ color: 'var(--foreground-muted)' }}>
                    <span className="w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5 font-mono" style={{ backgroundColor: `${primary}20`, color: primary }}>{i + 1}</span>
                    {step}
                  </li>
                ))}
              </ol>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  )
}

function FormSection({ label, primary, children }: { label: string; primary: string; children: React.ReactNode }) {
  return (
    <div className="border p-6 transition-colors duration-300" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--card)' }}>
      <div className="text-xs uppercase tracking-[0.2em] font-bold mb-5 flex items-center gap-2 font-mono" style={{ color: primary }}>
        <span className="w-1 h-4" style={{ backgroundColor: primary }} /> {label}
      </div>
      {children}
    </div>
  )
}

function InputField({ icon, label, name, placeholder, value, onChange, primary, type = 'text', readOnly = false }: { icon: React.ReactNode; label: string; name: string; placeholder: string; value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; primary: string; type?: string; readOnly?: boolean }) {
  return (
    <div>
      <label className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest font-bold mb-2 font-mono" style={{ color: 'var(--foreground-muted)' }}>
        <span style={{ color: primary }}>{icon}</span> {label}
      </label>
      <input 
        type={type} 
        name={name} 
        placeholder={placeholder} 
        value={value} 
        onChange={onChange} 
        readOnly={readOnly}
        className="w-full px-4 py-3 text-sm outline-none transition-all duration-200 border font-sans" 
        style={{ 
          backgroundColor: readOnly ? 'var(--background)' : 'var(--background-secondary)', 
          borderColor: 'var(--border)', 
          color: readOnly ? 'var(--foreground-muted)' : 'var(--foreground)', 
          cursor: readOnly ? 'not-allowed' : 'text'
        }} 
        onFocus={e => !readOnly && (e.target.style.borderColor = primary)} 
        onBlur={e => e.target.style.borderColor = 'var(--border)'} 
      />
    </div>
  )
}

function SuccessScreen({ primary, form, onVoltar }: { primary: string; isLight: boolean; form: FormData; onVoltar: () => void }) {
  const planName = PLANS.find(p => p.id === form.plano)?.name || form.plano

  return (
    <div className="min-h-screen flex flex-col items-center justify-center text-center px-6 transition-colors duration-300 font-mono" style={{ backgroundColor: 'var(--background)', color: 'var(--foreground)' }}>
      <div className="fixed inset-0 pointer-events-none" style={{ background: `radial-gradient(ellipse 50% 50% at 50% 50%, ${primary}10 0%, transparent 70%)` }} />
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5 }} className="relative z-10 max-w-lg">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-8" style={{ backgroundColor: `${primary}20`, border: `2px solid ${primary}` }}>
          <Check size={36} style={{ color: primary }} />
        </motion.div>
        <div className="text-xs tracking-[0.3em] uppercase mb-4 font-bold font-mono" style={{ color: primary }}>Solicitação enviada!</div>
        <h1 className="text-5xl font-black mb-4 font-rajdhani">TUDO CERTO,<br /><span style={{ color: primary }}>{form.responsavel.split(' ')[0].toUpperCase()}!</span></h1>
        
        <p className="text-sm tracking-wide font-mono opacity-50 uppercase mb-4" style={{ color: primary }}>Processo de Cadastro e Triagem Técnica Inicial</p>
        
        <p className="text-foreground-muted mb-2 font-sans">Recebemos a solicitação da empresa <strong style={{ color: 'var(--foreground)' }}>{form.empresa}</strong> para o plano <strong style={{ color: primary }}>{planName}</strong>.</p>
        <p className="text-foreground-muted mb-8 font-sans">Nossa equipe entrará em contato via <strong style={{ color: 'var(--foreground)' }}>{form.contatoPref === 'email' ? form.email : form.whatsapp}</strong> em até 24 horas.</p>
        <button 
          onClick={onVoltar} 
          className="inline-flex items-center gap-2 font-bold px-8 py-4 text-sm uppercase tracking-widest font-rajdhani cursor-pointer hover:opacity-90 transition-all" 
          style={{ backgroundColor: primary, color: '#000', clipPath: 'polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px))' }}
        >
          <ArrowLeft size={14} /> VOLTAR AO INÍCIO
        </button>
      </motion.div>
    </div>
  )
}
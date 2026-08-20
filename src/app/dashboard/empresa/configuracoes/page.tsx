'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTheme } from '@/contexts/ThemeContext'
import { CORES_E_LOGOS } from '@/data/temasELogos'
import { 
  Settings, 
  Building2, 
  Palette, 
  ShieldCheck, 
  Save, 
  Moon, 
  Sun,
  Check
} from 'lucide-react'

// As opções de cor vêm de src/data/temasELogos.ts — a MESMA fonte usada pela
// Navbar da landing e pela logo da Sidebar do dashboard. Antes esse array
// vivia duplicado aqui com hexadecimais diferentes dos da Navbar (ex:
// Âmbar #eab308 aqui vs #f59e0b lá), o que fazia a logo do topo da sidebar
// cair no fallback verde sempre que alguém escolhia uma cor só existente
// aqui. Centralizando, escolher uma cor em Configurações agora sempre bate
// com uma logo real.

export default function ConfiguracoesPage() {
  const { primary, setPrimary, isLight, setIsLight } = useTheme()
  const [montado, setMontado] = useState(false)
  const [tabAtiva, setTabAtiva] = useState<'PERFIL' | 'APARENCIA' | 'SEGURANCA'>('APARENCIA')

  const [form, setForm] = useState({
    nome: '', cnpj: '', email: '', telefone: ''
  })
  const [salvando, setSalvando] = useState(false)
  const [feedback, setFeedback] = useState('')

  useEffect(() => {
    setMontado(true)
    fetch('/api/empresa/perfil', { cache: 'no-store' }).then(async response => { const data = await response.json(); if (!response.ok) throw new Error(data.erro); setForm({ nome: data.empresa.nome || '', cnpj: data.empresa.cnpj || '', email: data.empresa.email || '', telefone: data.empresa.telefone || '' }) }).catch(error => setFeedback(error instanceof Error ? error.message : 'Falha ao carregar perfil.'))
  }, [])

  const salvarPerfil = async () => {
    setSalvando(true); setFeedback('')
    const response = await fetch('/api/empresa/perfil', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, cnpj: form.cnpj || null, telefone: form.telefone || null }) })
    const data = await response.json(); setSalvando(false)
    setFeedback(response.ok ? 'Dados da empresa salvos com sucesso.' : data.erro || 'Não foi possível salvar o perfil.')
  }

  if (!montado) return null

  return (
    <div className="space-y-6 max-w-[1200px] mx-auto">
      {feedback && <div role="status" className="border p-3 text-sm" style={{ borderColor: primary, color: primary }}>{feedback}</div>}
      
      {/* ─── CABEÇALHO ─── */}
      <div className="mb-8">
        <h1 className="text-3xl font-black uppercase tracking-tight" style={{ color: 'var(--foreground)', fontFamily: 'Rajdhani, sans-serif' }}>
          Configurações <span style={{ color: primary }}>do Sistema</span>
        </h1>
        <p className="text-sm font-mono mt-1" style={{ color: 'var(--foreground-muted)' }}>
          Preferências de interface, dados da transportadora e segurança.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
        
        {/* ─── MENU LATERAL (TABS) ─── */}
        <div className="md:col-span-1 space-y-2 font-mono">
          <TabButton 
            ativa={tabAtiva === 'PERFIL'} onClick={() => setTabAtiva('PERFIL')} 
            icone={<Building2 size={16} />} label="PERFIL DA EMPRESA" primary={primary} 
          />
          <TabButton 
            ativa={tabAtiva === 'APARENCIA'} onClick={() => setTabAtiva('APARENCIA')} 
            icone={<Palette size={16} />} label="APARÊNCIA & TEMA" primary={primary} 
          />
          <TabButton 
            ativa={tabAtiva === 'SEGURANCA'} onClick={() => setTabAtiva('SEGURANCA')} 
            icone={<ShieldCheck size={16} />} label="SEGURANÇA & PLANO" primary={primary} 
          />
        </div>

        {/* ─── ÁREA DE CONTEÚDO DAS TABS ─── */}
        <div className="md:col-span-3">
          <AnimatePresence mode="wait">
            
            {/* TIPO: APARÊNCIA */}
            {tabAtiva === 'APARENCIA' && (
              <motion.div key="aparencia" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-8">
                
                <div className="p-6 border" style={{ backgroundColor: 'var(--background-secondary)', borderColor: 'var(--border)' }}>
                  <h3 className="text-xs font-bold font-mono uppercase tracking-widest mb-6" style={{ color: 'var(--foreground)' }}>
                    Modo de Exibição
                  </h3>
                  <div className="flex gap-4">
                    <button 
                      onClick={() => setIsLight(false)}
                      className="flex-1 p-6 border flex flex-col items-center gap-3 transition-all"
                      style={{ 
                        borderColor: !isLight ? primary : 'var(--border)', 
                        backgroundColor: !isLight ? `${primary}10` : 'var(--background)',
                        color: 'var(--foreground)'
                      }}
                    >
                      <Moon size={24} style={{ color: !isLight ? primary : 'var(--foreground-muted)' }} />
                      <span className="font-mono text-xs font-bold uppercase tracking-widest">Modo Escuro (Dark)</span>
                    </button>
                    <button 
                      onClick={() => setIsLight(true)}
                      className="flex-1 p-6 border flex flex-col items-center gap-3 transition-all"
                      style={{ 
                        borderColor: isLight ? primary : 'var(--border)', 
                        backgroundColor: isLight ? `${primary}10` : 'var(--background)',
                        color: 'var(--foreground)'
                      }}
                    >
                      <Sun size={24} style={{ color: isLight ? primary : 'var(--foreground-muted)' }} />
                      <span className="font-mono text-xs font-bold uppercase tracking-widest">Modo Claro (Light)</span>
                    </button>
                  </div>
                </div>

                <div className="p-6 border" style={{ backgroundColor: 'var(--background-secondary)', borderColor: 'var(--border)' }}>
                  <h3 className="text-xs font-bold font-mono uppercase tracking-widest mb-6" style={{ color: 'var(--foreground)' }}>
                    Cor Destaque da Empresa
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    {CORES_E_LOGOS.map((cor) => (
                      <button
                        key={cor.value}
                        onClick={() => setPrimary(cor.value)}
                        className="p-4 border flex items-center justify-between transition-all group"
                        style={{ 
                          borderColor: primary === cor.value ? cor.value : 'var(--border)',
                          backgroundColor: primary === cor.value ? `${cor.value}15` : 'var(--background)',
                        }}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-4 h-4 rounded-full border border-black/20" style={{ backgroundColor: cor.value }} />
                          <span className="font-mono text-[10px] uppercase tracking-widest font-bold" style={{ color: 'var(--foreground)' }}>{cor.label}</span>
                        </div>
                        {primary === cor.value && <Check size={14} style={{ color: cor.value }} />}
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] font-mono mt-4 text-foreground-muted">
                    Essas são as mesmas cores usadas na Landing Page — a logo do sistema muda automaticamente conforme a cor escolhida.
                  </p>
                </div>

              </motion.div>
            )}

            {/* TIPO: PERFIL */}
            {tabAtiva === 'PERFIL' && (
              <motion.div key="perfil" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <div className="p-6 border space-y-6" style={{ backgroundColor: 'var(--background-secondary)', borderColor: 'var(--border)' }}>
                  <h3 className="text-xs font-bold font-mono uppercase tracking-widest mb-6 border-b pb-4" style={{ color: 'var(--foreground)', borderColor: 'var(--border)' }}>
                    Informações Fiscais
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
              </motion.div>
            )}

            {/* TIPO: SEGURANÇA */}
            {tabAtiva === 'SEGURANCA' && (
              <motion.div key="seguranca" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <div className="p-6 border space-y-6 mb-6" style={{ backgroundColor: 'var(--background-secondary)', borderColor: 'var(--border)' }}>
                  <h3 className="text-xs font-bold font-mono uppercase tracking-widest flex items-center gap-2" style={{ color: 'var(--foreground)' }}>
                    <ShieldCheck size={16} style={{ color: primary }}/> Credenciais de Acesso
                  </h3>
                  <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>A sua senha atual foi definida há 45 dias. Recomendamos a alteração a cada 90 dias por motivos de segurança.</p>
                  <button className="px-4 py-2 border text-xs font-mono font-bold uppercase tracking-widest transition-colors hover:bg-white/5" style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}>
                    Redefinir Senha
                  </button>
                </div>

                <div className="p-6 border border-dashed" style={{ backgroundColor: 'transparent', borderColor: 'var(--border)' }}>
                  <h3 className="text-xs font-bold font-mono uppercase tracking-widest mb-2" style={{ color: 'var(--foreground)' }}>
                    Plano Atual RPMTruck
                  </h3>
                  <div className="flex items-center justify-between mt-4">
                    <div>
                      <div className="text-xl font-black font-rajdhani" style={{ color: primary }}>PLANO ENTERPRISE LOGISTICS</div>
                      <div className="text-xs font-mono mt-1" style={{ color: 'var(--foreground-muted)' }}>Limite: 50 Veículos • Ilimitados Motoristas</div>
                    </div>
                    <button className="px-4 py-2 bg-white/5 border text-xs font-mono font-bold uppercase tracking-widest opacity-50 cursor-not-allowed" style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}>
                      Contactar Admin
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>

      </div>
    </div>
  )
}

// ─── COMPONENTES AUXILIARES ──────────────────────────────────────────────────

function TabButton({ ativa, onClick, icone, label, primary }: { ativa: boolean, onClick: () => void, icone: React.ReactNode, label: string, primary: string }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-4 text-xs font-bold uppercase tracking-widest transition-all"
      style={{
        backgroundColor: ativa ? `${primary}15` : 'transparent',
        color: ativa ? primary : 'var(--foreground-muted)',
        borderLeft: `3px solid ${ativa ? primary : 'transparent'}`
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

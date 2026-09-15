'use client'

import { FormEvent, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, MotionConfig } from 'framer-motion'
import { Loader2, Save, UserRoundPen, X } from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'
import { erroCPF, formatarCPF, formatarRG, normalizarDocumentoIdentidade, normalizarRegistroCNH, somenteNumeros } from '@/utils/documentos'

export interface MotoristaEditavel {
  id: string
  nome: string
  cpf: string
  rg: string
  cnh: string
  categoria: string
  validade: string
  status: string
}

interface EditMotoristaDialogProps {
  motorista: MotoristaEditavel
  onClose: () => void
  onSaved: (motorista: MotoristaEditavel) => void
}

const categorias = ['A', 'B', 'C', 'D', 'E', 'AB', 'AC', 'AD', 'AE']
const status = [
  { value: 'DISPONIVEL', label: 'Disponível' },
  { value: 'EM_ROTA', label: 'Em rota' },
  { value: 'ALERTA', label: 'Alerta' },
  { value: 'FERIAS', label: 'Férias' },
]

export function EditMotoristaDialog({ motorista, onClose, onSaved }: EditMotoristaDialogProps) {
  const { primary } = useTheme()
  const titleId = useId()
  const descriptionId = useId()
  const nomeRef = useRef<HTMLInputElement>(null)
  const [form, setForm] = useState<MotoristaEditavel>({ ...motorista, cpf: formatarCPF(motorista.cpf) })
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [campoErro, setCampoErro] = useState('')

  useEffect(() => {
    const frame = requestAnimationFrame(() => nomeRef.current?.focus())
    return () => cancelAnimationFrame(frame)
  }, [motorista])

  useEffect(() => {
    if (!motorista) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !salvando) onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [motorista, onClose, salvando])

  const atualizar = (campo: keyof MotoristaEditavel, valor: string) => {
    setForm((atual) => ({ ...atual, [campo]: valor }))
    if (campoErro === campo) {
      setCampoErro('')
      setErro('')
    }
  }

  const salvar = async (event: FormEvent) => {
    event.preventDefault()
    const mensagemCpf = form.cpf ? erroCPF(form.cpf) : null
    if (mensagemCpf) {
      setCampoErro('cpf')
      setErro(mensagemCpf)
      return
    }

    setSalvando(true)
    setErro('')
    setCampoErro('')
    try {
      const response = await fetch(`/api/motoristas/${form.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: form.nome,
          ...(form.cpf ? { cpf: somenteNumeros(form.cpf, 11) } : {}),
          rg: form.rg ? normalizarDocumentoIdentidade(form.rg) : null,
          cnh: normalizarRegistroCNH(form.cnh),
          categoria: form.categoria,
          validade: form.validade,
          status: form.status,
        }),
      })
      const data = await response.json()
      if (!response.ok) {
        setCampoErro(typeof data.campo === 'string' ? data.campo : '')
        setErro(data.erro || 'Não foi possível atualizar o motorista.')
        return
      }
      onSaved({
        id: data.id,
        nome: data.nome,
        cpf: data.cpf ?? '',
        rg: data.rg ?? '',
        cnh: data.cnh,
        categoria: data.categoria,
        validade: String(data.validade).slice(0, 10),
        status: data.status,
      })
      onClose()
    } catch {
      setErro('Falha de conexão. Tente salvar novamente.')
    } finally {
      setSalvando(false)
    }
  }

  if (typeof document === 'undefined') return null

  return createPortal(
    <MotionConfig reducedMotion="user">
      <AnimatePresence>
        {(
          <motion.div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onMouseDown={(event) => {
              if (event.target === event.currentTarget && !salvando) onClose()
            }}
          >
            <motion.form
              onSubmit={salvar}
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              aria-describedby={descriptionId}
              className="relative max-h-[92dvh] w-full max-w-2xl overflow-y-auto border bg-background shadow-2xl"
              style={{ borderColor: primary }}
              initial={{ opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={{ duration: 0.22, ease: [0.2, 0, 0, 1] }}
            >
              <span className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: primary }} aria-hidden="true" />
              <div className="flex items-start justify-between gap-4 border-b p-5 pt-6 sm:p-6" style={{ borderColor: 'var(--border)' }}>
                <div className="flex gap-3">
                  <div className="grid h-11 w-11 shrink-0 place-items-center border" style={{ borderColor: primary, color: primary }}>
                    <UserRoundPen size={20} aria-hidden="true" />
                  </div>
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-[0.2em]" style={{ color: primary }}>Cadastro do condutor</p>
                    <h2 id={titleId} className="mt-1 font-rajdhani text-xl font-black uppercase">Editar motorista</h2>
                    <p id={descriptionId} className="mt-1 text-xs text-foreground-muted">Corrija os dados e confirme antes de salvar.</p>
                  </div>
                </div>
                <button type="button" disabled={salvando} onClick={onClose} aria-label="Fechar edição" className="p-2 text-foreground-muted transition-colors hover:text-foreground disabled:opacity-40">
                  <X size={18} />
                </button>
              </div>

              <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2 sm:p-6">
                {erro && <div role="alert" className="border border-red-500/40 bg-red-500/5 p-3 text-xs text-red-500 sm:col-span-2">{erro}</div>}
                <label className="sm:col-span-2">
                  <span className="mb-1 block text-[10px] font-bold uppercase">Nome completo *</span>
                  <input ref={nomeRef} required minLength={3} maxLength={120} value={form.nome} onChange={(event) => atualizar('nome', event.target.value)} aria-invalid={campoErro === 'nome'} className="w-full border bg-transparent p-2.5 text-xs outline-none" style={{ borderColor: campoErro === 'nome' ? '#ef4444' : 'var(--border)' }} />
                </label>
                <label>
                  <span className="mb-1 block text-[10px] font-bold uppercase">CPF</span>
                  <input inputMode="numeric" value={form.cpf} onChange={(event) => atualizar('cpf', formatarCPF(event.target.value))} aria-describedby="edicao-ajuda-cpf" aria-invalid={campoErro === 'cpf'} className="w-full border bg-transparent p-2.5 text-xs outline-none" style={{ borderColor: campoErro === 'cpf' ? '#ef4444' : 'var(--border)' }} />
                  <span id="edicao-ajuda-cpf" className="mt-1 block text-[9px] text-foreground-muted">Pode ficar vazio somente em cadastros legados.</span>
                </label>
                <label>
                  <span className="mb-1 block text-[10px] font-bold uppercase">RG / CIN</span>
                  <input minLength={7} maxLength={14} value={form.rg} onChange={(event) => atualizar('rg', formatarRG(event.target.value))} aria-invalid={campoErro === 'rg'} className="w-full border bg-transparent p-2.5 text-xs outline-none" style={{ borderColor: campoErro === 'rg' ? '#ef4444' : 'var(--border)' }} />
                </label>
                <label>
                  <span className="mb-1 block text-[10px] font-bold uppercase">Número da CNH *</span>
                  <input required inputMode="numeric" pattern="[0-9]{9,11}" minLength={9} maxLength={11} value={form.cnh} onChange={(event) => atualizar('cnh', normalizarRegistroCNH(event.target.value))} aria-invalid={campoErro === 'cnh'} className="w-full border bg-transparent p-2.5 text-xs outline-none" style={{ borderColor: campoErro === 'cnh' ? '#ef4444' : 'var(--border)' }} />
                </label>
                <label>
                  <span className="mb-1 block text-[10px] font-bold uppercase">Categoria *</span>
                  <select required value={form.categoria} onChange={(event) => atualizar('categoria', event.target.value)} className="w-full border bg-background p-2.5 text-xs outline-none" style={{ borderColor: 'var(--border)' }}>
                    {categorias.map((categoria) => <option key={categoria} value={categoria}>Categoria {categoria}</option>)}
                  </select>
                </label>
                <label>
                  <span className="mb-1 block text-[10px] font-bold uppercase">Validade da CNH *</span>
                  <input required type="date" value={form.validade} onChange={(event) => atualizar('validade', event.target.value)} aria-invalid={campoErro === 'validade'} className="w-full border bg-transparent p-2.5 text-xs outline-none" style={{ borderColor: campoErro === 'validade' ? '#ef4444' : 'var(--border)' }} />
                </label>
                <label>
                  <span className="mb-1 block text-[10px] font-bold uppercase">Situação operacional *</span>
                  <select required value={form.status} onChange={(event) => atualizar('status', event.target.value)} className="w-full border bg-background p-2.5 text-xs outline-none" style={{ borderColor: 'var(--border)' }}>
                    {status.map((opcao) => <option key={opcao.value} value={opcao.value}>{opcao.label}</option>)}
                  </select>
                </label>
              </div>

              <div className="flex flex-col-reverse gap-2 border-t p-5 sm:flex-row sm:justify-end" style={{ borderColor: 'var(--border)' }}>
                <button type="button" disabled={salvando} onClick={onClose} className="min-h-11 border px-5 text-xs font-black uppercase disabled:opacity-40" style={{ borderColor: 'var(--border)' }}>Cancelar</button>
                <motion.button type="submit" disabled={salvando} whileTap={salvando ? undefined : { scale: 0.985 }} className="flex min-h-11 items-center justify-center gap-2 px-5 text-xs font-black uppercase text-black disabled:cursor-wait disabled:opacity-70" style={{ backgroundColor: primary }}>
                  {salvando ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <Save size={15} aria-hidden="true" />}
                  {salvando ? 'Salvando...' : 'Salvar alterações'}
                </motion.button>
              </div>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>
    </MotionConfig>,
    document.body,
  )
}

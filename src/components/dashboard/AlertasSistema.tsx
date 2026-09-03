'use client'

import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, Info, ShieldAlert, X } from 'lucide-react'

type Alerta = { id: string; titulo: string; mensagem: string; severidade: 'INFORMACAO' | 'AVISO' | 'CRITICO'; inicio_em: string; fim_em: string | null }

const estilos = {
  INFORMACAO: { cor: 'var(--primary)', Icone: Info },
  AVISO: { cor: 'var(--status-warning)', Icone: AlertTriangle },
  CRITICO: { cor: 'var(--status-danger)', Icone: ShieldAlert },
} as const

export default function AlertasSistema() {
  const [alertas, setAlertas] = useState<Alerta[]>([])

  const carregar = useCallback(async () => {
    try {
      const response = await fetch('/api/alertas', { cache: 'no-store' })
      if (!response.ok) return
      const body = await response.json()
      setAlertas(body.alertas)
    } catch {}
  }, [])

  useEffect(() => {
    const initial = window.setTimeout(() => void carregar(), 0)
    const interval = window.setInterval(() => { if (!document.hidden) void carregar() }, 60000)
    return () => { window.clearTimeout(initial); window.clearInterval(interval) }
  }, [carregar])

  const dispensar = async (id: string) => {
    setAlertas((atuais) => atuais.filter((alerta) => alerta.id !== id))
    const response = await fetch(`/api/alertas/${id}/ler`, { method: 'POST' })
    if (!response.ok) void carregar()
  }

  if (alertas.length === 0) return null

  return <section aria-label="Alertas do sistema" className="mb-5 space-y-2">
    {alertas.map((alerta) => {
      const { cor, Icone } = estilos[alerta.severidade]
      return <article key={alerta.id} role={alerta.severidade === 'CRITICO' ? 'alert' : 'status'} className="flex items-start gap-3 border-l-4 p-3 sm:p-4" style={{ borderColor: cor, backgroundColor: `color-mix(in srgb, ${cor} 10%, var(--background-secondary))` }}>
        <Icone size={19} className="mt-0.5 shrink-0" style={{ color: cor }} />
        <div className="min-w-0 flex-1"><h2 className="text-sm font-black uppercase">{alerta.titulo}</h2><p className="mt-1 whitespace-pre-wrap break-words text-sm text-foreground-muted">{alerta.mensagem}</p>{alerta.fim_em && <p className="mt-2 text-[9px] font-bold uppercase tracking-wider text-foreground-muted">Válido até {new Date(alerta.fim_em).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</p>}</div>
        <button type="button" onClick={() => void dispensar(alerta.id)} aria-label={`Dispensar alerta: ${alerta.titulo}`} className="min-h-10 min-w-10 p-2 text-foreground-muted hover:text-foreground"><X size={17} /></button>
      </article>
    })}
  </section>
}

'use client'

import { useEffect, useState } from 'react'
import PaymentAccessCountdown, { type ResumoPagamento } from './PaymentAccessCountdown'

export default function PaymentAccessNotice() {
  const [pagamento, setPagamento] = useState<ResumoPagamento | null>(null)
  const [falha, setFalha] = useState(false)
  useEffect(() => {
    const controller = new AbortController()
    async function carregar() {
      try {
        const response = await fetch('/api/empresa/assinatura', { cache: 'no-store', signal: controller.signal })
        if (!response.ok) {
          if (!controller.signal.aborted) setFalha(true)
          return
        }
        const dados = await response.json()
        if (!controller.signal.aborted) { setPagamento(dados.pagamento); setFalha(false) }
      } catch {
        // A consulta opcional nunca libera acesso; a API operacional valida a dívida.
        if (!controller.signal.aborted) setFalha(true)
      }
    }
    void carregar()
    const intervalo = window.setInterval(() => { if (!document.hidden) void carregar() }, 60000)
    return () => { controller.abort(); window.clearInterval(intervalo) }
  }, [])
  return <>{pagamento && <PaymentAccessCountdown pagamento={pagamento} />}{falha && <p role="status" className="text-xs text-foreground-muted">Não foi possível atualizar o prazo de pagamento. Uma nova consulta será feita automaticamente.</p>}</>
}

'use client'

import { useEffect } from 'react'
import { SESSION_HEARTBEAT_INTERVAL_MS } from '@/lib/sessionPresence'
import { proximaMeiaNoiteBrasilia } from '@/lib/brasiliaTime'

/**
 * Mantém a presença operacional atualizada apenas enquanto a aba está visível.
 * A API autenticada continua sendo a fronteira confiável para identificar a sessão.
 */
export function useSessionActivity() {
  useEffect(() => {
    let controller: AbortController | null = null
    let encerrando = false
    const expiraVisualEm = proximaMeiaNoiteBrasilia().getTime()

    const encerrarNaViradaDoDia = () => {
      if (encerrando) return
      encerrando = true
      void fetch('/api/auth/logout', { method: 'POST', cache: 'no-store', keepalive: true })
        .finally(() => window.location.replace('/auth/login?motivo=sessao-expirada'))
    }

    const registrar = () => {
      if (document.visibilityState !== 'visible' || !navigator.onLine) return
      controller?.abort()
      controller = new AbortController()
      void fetch('/api/auth/activity', {
        method: 'POST',
        cache: 'no-store',
        signal: controller.signal,
      }).catch(() => undefined)
    }

    const aoMudarVisibilidade = () => {
      if (document.visibilityState === 'visible') registrar()
    }

    registrar()
    const intervalId = window.setInterval(registrar, SESSION_HEARTBEAT_INTERVAL_MS)
    const midnightId = window.setTimeout(encerrarNaViradaDoDia, Math.max(0, expiraVisualEm - Date.now() + 250))
    const verificarValidadeVisual = () => {
      if (Date.now() >= expiraVisualEm) encerrarNaViradaDoDia()
    }
    document.addEventListener('visibilitychange', aoMudarVisibilidade)
    document.addEventListener('visibilitychange', verificarValidadeVisual)
    window.addEventListener('focus', registrar)
    window.addEventListener('online', registrar)

    return () => {
      controller?.abort()
      window.clearInterval(intervalId)
      window.clearTimeout(midnightId)
      document.removeEventListener('visibilitychange', aoMudarVisibilidade)
      document.removeEventListener('visibilitychange', verificarValidadeVisual)
      window.removeEventListener('focus', registrar)
      window.removeEventListener('online', registrar)
    }
  }, [])
}

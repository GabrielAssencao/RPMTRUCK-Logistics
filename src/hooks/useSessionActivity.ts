'use client'

import { useEffect } from 'react'

const HEARTBEAT_INTERVAL_MS = 2 * 60 * 1000

/**
 * Mantém a presença operacional atualizada apenas enquanto a aba está visível.
 * A API autenticada continua sendo a fronteira confiável para identificar a sessão.
 */
export function useSessionActivity() {
  useEffect(() => {
    let controller: AbortController | null = null

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
    const intervalId = window.setInterval(registrar, HEARTBEAT_INTERVAL_MS)
    document.addEventListener('visibilitychange', aoMudarVisibilidade)
    window.addEventListener('focus', registrar)
    window.addEventListener('online', registrar)

    return () => {
      controller?.abort()
      window.clearInterval(intervalId)
      document.removeEventListener('visibilitychange', aoMudarVisibilidade)
      window.removeEventListener('focus', registrar)
      window.removeEventListener('online', registrar)
    }
  }, [])
}

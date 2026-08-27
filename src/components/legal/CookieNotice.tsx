'use client'

import { useState, useSyncExternalStore } from 'react'
import Link from 'next/link'

const NOTICE_STORAGE_KEY = 'rpmtruck-cookie-notice-v1'
const NOTICE_EVENT = 'rpmtruck-cookie-notice-changed'

function subscribe(onStoreChange: () => void) {
  const handleStorage = (event: StorageEvent) => {
    if (event.key === NOTICE_STORAGE_KEY) onStoreChange()
  }
  window.addEventListener('storage', handleStorage)
  window.addEventListener(NOTICE_EVENT, onStoreChange)
  return () => {
    window.removeEventListener('storage', handleStorage)
    window.removeEventListener(NOTICE_EVENT, onStoreChange)
  }
}

function getSnapshot() {
  try {
    return localStorage.getItem(NOTICE_STORAGE_KEY) !== 'acknowledged'
  } catch {
    return true
  }
}

function getServerSnapshot() {
  return false
}

export default function CookieNotice() {
  const storedNoticeVisible = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  const [dismissedForThisPage, setDismissedForThisPage] = useState(false)
  const visible = storedNoticeVisible && !dismissedForThisPage

  const acknowledge = () => {
    try {
      localStorage.setItem(NOTICE_STORAGE_KEY, 'acknowledged')
    } catch {
      // O fechamento continua válido para esta navegação se o storage estiver bloqueado.
    }
    setDismissedForThisPage(true)
    window.dispatchEvent(new Event(NOTICE_EVENT))
  }

  if (!visible) return null

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-labelledby="cookie-notice-title"
      aria-describedby="cookie-notice-description"
      className="fixed inset-x-4 bottom-4 z-[100] mx-auto max-w-4xl border border-border-strong bg-card p-5 text-foreground shadow-2xl md:flex md:items-center md:gap-6 md:p-6"
    >
      <div className="min-w-0 flex-1">
        <h2 id="cookie-notice-title" className="text-lg font-black" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
          Privacidade e armazenamento essencial
        </h2>
        <p id="cookie-notice-description" className="mt-2 text-sm leading-6 text-foreground-muted">
          Usamos somente recursos necessários para sessão, segurança, preferências de interface e para lembrar este aviso.
          Atualmente não usamos cookies de publicidade ou analytics. Saiba mais no nosso{' '}
          <Link href="/cookies" className="font-semibold text-primary hover:underline">Aviso de Cookies</Link>{' '}
          e na <Link href="/privacidade" className="font-semibold text-primary hover:underline">Política de Privacidade</Link>.
        </p>
      </div>
      <button
        type="button"
        onClick={acknowledge}
        className="mt-4 min-h-11 w-full shrink-0 bg-primary px-6 py-3 text-sm font-bold uppercase tracking-wider focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary md:mt-0 md:w-auto"
        style={{ color: 'var(--primary-contrast)' }}
      >
        Entendi
      </button>
    </div>
  )
}

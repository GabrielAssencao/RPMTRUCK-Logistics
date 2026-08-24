'use client'

import Script from 'next/script'
import { useCallback, useEffect, useId, useRef } from 'react'

declare global {
  interface Window {
    turnstile?: {
      render: (container: HTMLElement, options: Record<string, unknown>) => string
      remove: (widgetId: string) => void
    }
  }
}

export default function TurnstileWidget({
  action,
  onTokenChange,
}: {
  action: string
  onTokenChange: (token: string) => void
}) {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
  const containerRef = useRef<HTMLDivElement>(null)
  const widgetIdRef = useRef<string | null>(null)
  const reactId = useId()

  const renderWidget = useCallback(() => {
    if (!siteKey || !containerRef.current || !window.turnstile || widgetIdRef.current) return
    widgetIdRef.current = window.turnstile.render(containerRef.current, {
      sitekey: siteKey,
      action,
      theme: 'auto',
      size: 'flexible',
      callback: (token: string) => onTokenChange(token),
      'expired-callback': () => onTokenChange(''),
      'error-callback': () => onTokenChange(''),
    })
  }, [action, onTokenChange, siteKey])

  useEffect(() => {
    renderWidget()
    return () => {
      if (widgetIdRef.current && window.turnstile) window.turnstile.remove(widgetIdRef.current)
      widgetIdRef.current = null
    }
  }, [renderWidget])

  if (!siteKey) return null

  return (
    <>
      <Script
        id={`turnstile-${reactId.replace(/:/g, '')}`}
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onLoad={renderWidget}
      />
      <div ref={containerRef} className="my-4 min-h-[65px] w-full" aria-label="Verificação contra robôs" />
    </>
  )
}

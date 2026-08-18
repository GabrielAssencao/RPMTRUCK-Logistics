'use client'

import Link from 'next/link'
import { useTheme } from '@/contexts/ThemeContext'

export default function Footer() {
  const { primary } = useTheme()

  const handleAnchorClick = (event: React.MouseEvent<HTMLAnchorElement>, targetId: string) => {
    const target = document.getElementById(targetId)

    if (!target) return

    event.preventDefault()
    target.scrollIntoView({ behavior: 'smooth', block: 'start' })
    window.history.replaceState(null, '', `#${targetId}`)
  }

  return (
    <footer className="relative z-10 w-full border-t border-border bg-background py-10 transition-colors duration-500 overflow-hidden">
      <div
        className="absolute top-0 left-0 right-0 h-px"
        style={{ background: `linear-gradient(90deg, transparent, ${primary}, transparent)` }}
      />

      <div className="max-w-7xl mx-auto px-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div
            className="text-xl font-bold text-foreground select-none"
            style={{ fontFamily: 'Rajdhani, sans-serif' }}
          >
            RPM<span style={{ color: primary }}>TRUCK</span>
            <span className="text-foreground-muted text-xs ml-1 font-normal tracking-widest">
              LOGISTICS
            </span>
          </div>

          <div
            className="flex flex-wrap items-center justify-center gap-6 text-xs text-foreground-muted uppercase tracking-widest"
            style={{ fontFamily: 'Rajdhani, sans-serif' }}
          >
            <Link
              href="#funcionalidades"
              scroll={false}
              onClick={(event) => handleAnchorClick(event, 'funcionalidades')}
              className="hover:text-foreground transition-colors"
            >
              Funcionalidades
            </Link>
            <Link
              href="#planos"
              scroll={false}
              onClick={(event) => handleAnchorClick(event, 'planos')}
              className="hover:text-foreground transition-colors"
            >
              Planos
            </Link>
            <Link href="/login" className="hover:text-foreground transition-colors">
              Login
            </Link>
            <Link
              href="/auth/solicitar-acesso"
              className="transition-colors font-bold hover:opacity-80"
              style={{ color: primary }}
            >
              Solicitar Acesso
            </Link>
          </div>

          <div
            className="text-xs text-foreground-muted/50"
            style={{ fontFamily: 'JetBrains Mono, monospace' }}
          >
            © {new Date().getFullYear()} RPMTruck Logistics
          </div>
        </div>
      </div>
    </footer>
  )
}
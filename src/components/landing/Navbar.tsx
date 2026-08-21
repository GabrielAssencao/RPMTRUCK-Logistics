'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, useScroll, useTransform } from 'framer-motion'
import { useTheme } from '@/contexts/ThemeContext'

const COLORS = [
  { value: '#22c55e', label: 'Verde',    logoName: 'logoRPMTRUCK_verde.png'    },
  { value: '#ef4444', label: 'Vermelho', logoName: 'logoRPMTRUCK_vermelho.png' },
  { value: '#3b82f6', label: 'Azul',     logoName: 'logoRPMTRUCK_azul.png'     },
  { value: '#f59e0b', label: 'Âmbar',    logoName: 'logoRPMTRUCK_amarelo.png'  },
  { value: '#5e17eb', label: 'Roxo',     logoName: 'logoRPMTRUCK_roxo.png'     }
]

export default function Navbar() {
  const { isLight, setIsLight, primary, setPrimary } = useTheme()
  const [mobileOpen, setMobile] = useState(false)
  const router = useRouter()

  const { scrollY } = useScroll()
  const navChromeOpacity = useTransform(scrollY, [0, 80], [0, 1])

  const currentLogo = COLORS.find(c => c.value === primary)?.logoName || 'logoRPMTRUCK_verde.png'

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-50">
        <motion.div
          aria-hidden="true"
          style={{ opacity: navChromeOpacity }}
          className="absolute inset-0 border-b border-border bg-background pointer-events-none"
        />
        <div className="relative max-w-7xl mx-auto px-6 flex items-center justify-between py-4">

          {/* LOGO */}
          <Link href="/" className="flex items-center gap-2 select-none">
            <Image
              src={`/logos/${currentLogo}`}
              alt="RPM Truck Logo"
              width={32}
              height={32}
              className="h-8 w-8 object-contain transition-all duration-300"
              priority
            />
            <span 
              className="text-xl font-bold tracking-tight text-foreground hidden sm:block ml-2" 
              style={{ fontFamily: 'Rajdhani, sans-serif' }}
            >
              RPM<span style={{ color: primary }}>TRUCK</span>
            </span>
          </Link>

          {/* SELETOR DE TEMAS & LOGIN */}
          <div className="flex items-center gap-3">
            
            {/* SELETOR DE CORES (Desktop) */}
            <div className="hidden sm:flex items-center gap-1.5">
              {COLORS.map((c) => (
                <button 
                  key={c.value} 
                  onClick={() => setPrimary(c.value)} 
                  title={c.label}
                  className="w-4 h-4 rounded-full transition-transform hover:scale-125 cursor-pointer"
                  style={{ 
                    backgroundColor: c.value, 
                    outline: primary === c.value ? `2px solid ${c.value}` : 'none', 
                    outlineOffset: '2px' 
                  }}
                />
              ))}
            </div>

            <div className="w-px h-5 bg-border hidden sm:block mx-1" />

            {/* BOTÃO CLARO / ESCURO */}
            <button 
              onClick={() => setIsLight(!isLight)}
              className="relative w-12 h-6 rounded-full border border-border transition-colors hover:bg-border cursor-pointer"
              aria-label="Alternar tema"
            >
              <span
                className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full flex items-center justify-center text-xs transition-transform duration-300"
                style={{ 
                  backgroundColor: primary, 
                  color: isLight ? '#000' : '#fff', 
                  transform: isLight ? 'translateX(24px)' : 'translateX(0)' 
                }}
              >
                {isLight ? '☀' : '☾'}
              </span>
            </button>

            <div className="w-px h-5 bg-border hidden sm:block mx-1" />

            {/* BOTÃO LOGIN DESKTOP */}
            <button
              type="button"
              onClick={() => router.push('/auth/login')}
              className="hidden sm:inline-flex items-center justify-center px-5 py-2 text-xs font-bold uppercase tracking-widest border transition-all duration-200 cursor-pointer"
              style={{
                fontFamily: 'Rajdhani, sans-serif',
                borderColor: primary,
                color: primary,
                backgroundColor: 'transparent',
                clipPath: 'polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 6px 100%, 0 calc(100% - 6px))',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.backgroundColor = primary
                e.currentTarget.style.color = isLight ? '#000' : '#fff'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.backgroundColor = 'transparent'
                e.currentTarget.style.color = primary
              }}
            >
              Login
            </button>

            {/* MENU HAMBÚRGUER MOBILE */}
            <button 
              className="sm:hidden flex flex-col gap-1.5 p-2 cursor-pointer" 
              onClick={() => setMobile(!mobileOpen)} 
              aria-label="Menu"
            >
              <span className={`block w-5 h-px bg-foreground transition-all duration-300 ${mobileOpen ? 'rotate-45 translate-y-2' : ''}`} />
              <span className={`block w-5 h-px bg-foreground transition-all duration-300 ${mobileOpen ? 'opacity-0' : ''}`} />
              <span className={`block w-5 h-px bg-foreground transition-all duration-300 ${mobileOpen ? '-rotate-45 -translate-y-2' : ''}`} />
            </button>
          </div>
        </div>
      </nav>

      {/* MENU MOBILE EXPANDIDO (Cores + Login) */}
      {mobileOpen && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }} 
          animate={{ opacity: 1, y: 0 }}
          className="fixed top-[72px] left-0 right-0 z-40 bg-background border-b border-border sm:hidden p-6 flex flex-col gap-4"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-widest text-foreground-muted font-bold font-rajdhani">
              Tema
            </span>
            <div className="flex items-center gap-2">
              {COLORS.map((c) => (
                <button 
                  key={c.value} 
                  onClick={() => setPrimary(c.value)} 
                  className="w-5 h-5 rounded-full"
                  style={{ 
                    backgroundColor: c.value, 
                    outline: primary === c.value ? `2px solid ${c.value}` : 'none', 
                    outlineOffset: '2px' 
                  }}
                />
              ))}
            </div>
          </div>

          <button 
            type="button"
            onClick={() => { setMobile(false); router.push('/auth/login'); }}
            className="w-full py-3 text-center border font-bold text-sm uppercase tracking-widest cursor-pointer mt-2"
            style={{ fontFamily: 'Rajdhani, sans-serif', borderColor: primary, color: primary }}
          >
            Login
          </button>
        </motion.div>
      )}
    </>
  )
}

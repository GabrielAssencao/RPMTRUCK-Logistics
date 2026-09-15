'use client'

import { useId, useState, type ReactNode } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { ChevronUp } from 'lucide-react'

export default function SidebarAccountCard({ name, company, expanded, children, logout }: { name: string; company: string; expanded: boolean; children?: ReactNode; logout?: ReactNode }) {
  const [open, setOpen] = useState(false)
  const menuId = useId()
  const reduceMotion = useReducedMotion()
  const initials = name.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase() || 'U'
  return (
    <div
      className="relative flex flex-col items-start py-2"
      data-sidebar-account
      onMouseLeave={event => {
        if (!event.currentTarget.contains(document.activeElement)) setOpen(false)
      }}
      onBlur={event => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false)
      }}
      onKeyDown={event => {
        if (event.key === 'Escape') {
          setOpen(false)
          event.currentTarget.querySelector<HTMLButtonElement>('[aria-controls]')?.focus()
        }
      }}
    >
      {logout && <div className="mb-4 w-full">{logout}</div>}
      <AnimatePresence>
        {open && children && (
          <motion.div
            id={menuId}
            className="w-full overflow-hidden"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.18, ease: [0.2, 0, 0, 1] }}
          >
            <nav aria-label="Opções da conta" className="mb-4 space-y-2 rounded-md border border-border bg-background p-2" onClick={event => {
              if (event.target instanceof HTMLElement && event.target.closest('a, button')) setOpen(false)
            }}>
              {children}
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
      <button
        type="button"
        aria-label={`Opções da conta de ${name}, ${company}`}
        aria-expanded={open}
        aria-controls={menuId}
        title={`${name} · ${company}`}
        onMouseEnter={() => setOpen(true)}
        onClick={() => setOpen(value => !value)}
        className={`flex min-w-0 items-center text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${expanded ? 'w-full gap-3 rounded-md border border-border bg-[var(--background-secondary)] p-3 shadow-sm' : 'rounded-full'}`}
      >
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center bg-[var(--background-secondary)] text-sm font-bold text-primary ${expanded ? 'rounded-md' : 'rounded-full border border-border'}`}>{initials}</span>
        {expanded && <>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-sans text-xs font-semibold text-foreground">{name}</span>
            <span className="mt-1 block truncate font-sans text-[11px] text-foreground-muted">{company}</span>
          </span>
          <ChevronUp size={14} aria-hidden="true" className={`shrink-0 text-foreground-muted transition-transform duration-200 motion-reduce:transition-none ${open ? 'rotate-180' : ''}`} />
        </>}
      </button>
    </div>
  )
}

// src/components/ThemeToggle.tsx
'use client'

import { useTheme } from '@/contexts/ThemeContext'
import { Sun, Moon } from 'lucide-react'

export default function ThemeToggle({ disabled = false, onToggle }: { disabled?: boolean; onToggle?: (isLight: boolean) => void }) {
  const { isLight, setIsLight, primary } = useTheme()

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onToggle ? onToggle(!isLight) : setIsLight(!isLight)}
      className="flex min-h-11 min-w-11 items-center justify-center rounded-sm border p-2 transition-all hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-45"
      style={{ 
        borderColor: 'var(--border)', 
        color: 'var(--foreground)' 
      }}
      title={disabled ? 'Tema administrado pelo gestor' : isLight ? 'Mudar para Modo Escuro' : 'Mudar para Modo Claro'}
      aria-label={disabled ? 'Tema administrado pelo gestor' : isLight ? 'Mudar para modo escuro' : 'Mudar para modo claro'}
    >
      {isLight ? (
        <Moon size={16} style={{ color: primary }} />
      ) : (
        <Sun size={16} style={{ color: primary }} />
      )}
    </button>
  )
}

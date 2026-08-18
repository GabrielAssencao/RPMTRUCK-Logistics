// src/components/ThemeToggle.tsx
'use client'

import { useTheme } from '@/contexts/ThemeContext'
import { Sun, Moon } from 'lucide-react'

export default function ThemeToggle() {
  const { isLight, setIsLight, primary } = useTheme()

  return (
    <button
      onClick={() => setIsLight(!isLight)}
      className="p-2 border rounded-sm transition-all flex items-center justify-center hover:bg-white/5"
      style={{ 
        borderColor: 'var(--border)', 
        color: 'var(--foreground)' 
      }}
      title={isLight ? 'Mudar para Modo Escuro' : 'Mudar para Modo Claro'}
    >
      {isLight ? (
        <Moon size={16} style={{ color: primary }} />
      ) : (
        <Sun size={16} style={{ color: primary }} />
      )}
    </button>
  )
}
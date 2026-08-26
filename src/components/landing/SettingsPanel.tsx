'use client'

import { useState } from 'react'
import { Palette } from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'
import { CORES_E_LOGOS } from '@/data/temasELogos'

export default function SettingsPanel() {
  const { primary, setPrimary } = useTheme()
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    // Aqui você adicionaria a lógica para persistir no seu banco de dados (Supabase)
    await new Promise(r => setTimeout(r, 800))
    setSaving(false)
  }

  return (
    <div className="bg-card border border-border p-8 max-w-2xl">
      <h3 className="flex items-center gap-2 font-black uppercase tracking-widest text-sm mb-6">
        <Palette size={16} style={{ color: primary }} /> Customização Visual
      </h3>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        {CORES_E_LOGOS.map(c => (
          <button
            key={c.value}
            onClick={() => setPrimary(c.value)}
            className="group flex flex-col items-center gap-2"
          >
            <div 
              className={`w-16 h-16 border-2 transition-all ${primary === c.value ? 'border-foreground scale-110' : 'border-border'}`}
              style={{ backgroundColor: c.value }}
            />
            <span className="text-[10px] font-bold uppercase tracking-widest">{c.label}</span>
          </button>
        ))}
      </div>

      <button 
        onClick={handleSave}
        disabled={saving}
        className="w-full py-3 font-black text-xs uppercase tracking-[0.2em] flex items-center justify-center gap-2 transition-all"
        style={{ 
            backgroundColor: primary, 
            color: '#000',
            clipPath: 'polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px))' 
        }}
      >
        {saving ? 'SALVANDO...' : 'SALVAR PREFERÊNCIAS'}
      </button>
    </div>
  )
}

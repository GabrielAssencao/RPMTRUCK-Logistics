'use client'
import { useState } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { Palette, Moon, Sun } from 'lucide-react';

const CORES_PRIMARIAS = ['#3b82f6', '#8b5cf6', '#ef4444', '#10b981', '#f59e0b'];

export default function SettingsModule() {
  // Chamamos as variáveis reais do seu ThemeContext atual
  const { isLight, setIsLight, primary, setPrimary } = useTheme();
  const [salvando, setSalvando] = useState(false);

  const handleSave = async (settings) => {
    setSalvando(true);
    
    // Salva o modo Escuro/Claro diretamente na função nativa do Contexto
    if (settings.theme !== undefined) {
      setIsLight(settings.theme === 'light');
    }
    
    // Salva a cor primária diretamente na função nativa do Contexto
    if (settings.primary !== undefined) {
      setPrimary(settings.primary);
    }

    setSalvando(false);
  };

  return (
    <div className="space-y-8 font-mono">
      <div>
        <p className="font-bold tracking-[0.3em] text-[10px] mb-1" style={{ color: primary }}>PERSONALIZAÇÃO</p>
        <h2 className="text-2xl font-black font-rajdhani">CONFIGURAÇÕES</h2>
      </div>

      {/* Modo de Cor */}
      <div className="border p-6 space-y-4" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background-secondary)' }}>
        <h3 className="font-bold text-sm uppercase tracking-widest">Tema da Interface</h3>
        <div className="flex gap-4">
          <button 
            onClick={() => handleSave({ theme: 'light' })}
            className={`flex items-center gap-2 px-6 py-3 border font-bold text-xs uppercase tracking-wider transition-all ${isLight ? 'text-black' : 'text-foreground-muted hover:text-foreground'}`}
            style={{ 
              borderColor: isLight ? primary : 'var(--border)',
              backgroundColor: isLight ? primary : 'transparent'
            }}
          >
            <Sun size={16} /> Claro
          </button>
          
          <button 
            onClick={() => handleSave({ theme: 'dark' })}
            className={`flex items-center gap-2 px-6 py-3 border font-bold text-xs uppercase tracking-wider transition-all ${!isLight ? 'text-black' : 'text-foreground-muted hover:text-foreground'}`}
            style={{ 
              borderColor: !isLight ? primary : 'var(--border)',
              backgroundColor: !isLight ? primary : 'transparent'
            }}
          >
            <Moon size={16} /> Escuro
          </button>
        </div>
      </div>

      {/* Cores Primárias */}
      <div className="border p-6 space-y-4" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background-secondary)' }}>
        <h3 className="font-bold text-sm flex items-center gap-2 uppercase tracking-widest">
          <Palette size={16} style={{ color: primary }} /> Cor de Destaque
        </h3>
        <div className="flex gap-4">
          {CORES_PRIMARIAS.map(cor => (
            <button 
              key={cor} 
              onClick={() => handleSave({ primary: cor })}
              className="w-10 h-10 rounded-full transition-transform hover:scale-110 cursor-pointer"
              style={{ 
                backgroundColor: cor,
                outline: primary === cor ? `2px solid ${cor}` : 'none',
                outlineOffset: '2px'
              }}
              title={`Trocar cor para ${cor}`}
            />
          ))}
        </div>
      </div>
      
      {/* Botão de Feedback de Salvamento */}
      {salvando && (
        <p className="text-xs font-bold animate-pulse" style={{ color: primary }}>
          Aplicando preferências...
        </p>
      )}
    </div>
  );
}

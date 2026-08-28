'use client'
import { useState } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { CORES_E_LOGOS } from '@/data/temasELogos';
import { KeyRound, Palette, Moon, ShieldCheck, Sun } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function SettingsModule() {
  const router = useRouter();
  // Chamamos as variáveis reais do seu ThemeContext atual
  const { isLight, setIsLight, primary, setPrimary } = useTheme();
  const [salvando, setSalvando] = useState(false);
  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [alterandoSenha, setAlterandoSenha] = useState(false);
  const [retornoSenha, setRetornoSenha] = useState({ tipo: '', mensagem: '' });

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

  const handlePasswordChange = async (event) => {
    event.preventDefault();
    setRetornoSenha({ tipo: '', mensagem: '' });
    if (novaSenha !== confirmacao) {
      setRetornoSenha({ tipo: 'erro', mensagem: 'A confirmação deve ser igual à nova senha.' });
      return;
    }

    setAlterandoSenha(true);
    try {
      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ senhaAtual, novaSenha }),
      });
      const data = await response.json();
      if (!response.ok) {
        setRetornoSenha({ tipo: 'erro', mensagem: data.erro || 'Não foi possível alterar a senha.' });
        return;
      }

      localStorage.removeItem('@rpmtruck:user');
      localStorage.removeItem('@rpmtruck:admin');
      setRetornoSenha({ tipo: 'sucesso', mensagem: data.mensagem });
      setSenhaAtual('');
      setNovaSenha('');
      setConfirmacao('');
      window.setTimeout(() => { router.replace('/auth/login'); }, 1800);
    } catch {
      setRetornoSenha({ tipo: 'erro', mensagem: 'Erro de conexão. Tente novamente.' });
    } finally {
      setAlterandoSenha(false);
    }
  };

  return (
    <div className="space-y-8 font-mono">
      <div>
        <p className="font-bold tracking-[0.3em] text-[10px] mb-1" style={{ color: primary }}>PERSONALIZAÇÃO</p>
        <h2 className="text-2xl font-black font-rajdhani">CONFIGURAÇÕES</h2>
      </div>

      {/* Modo de Cor */}
      <div className="border p-4 space-y-4 sm:p-6" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background-secondary)' }}>
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

      <form onSubmit={handlePasswordChange} className="border p-4 space-y-4 sm:p-6" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background-secondary)' }}>
        <div>
          <h3 className="font-bold text-sm flex items-center gap-2 uppercase tracking-widest">
            <ShieldCheck size={16} style={{ color: primary }} /> Segurança da conta
          </h3>
          <p className="mt-2 text-xs text-foreground-muted font-sans max-w-2xl">
            Ao salvar, todas as sessões abertas serão encerradas. Use uma senha exclusiva com 12 ou mais caracteres, maiúscula, minúscula, número e símbolo.
          </p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <PasswordField label="Senha atual" value={senhaAtual} onChange={setSenhaAtual} autoComplete="current-password" />
          <PasswordField label="Nova senha" value={novaSenha} onChange={setNovaSenha} autoComplete="new-password" />
          <PasswordField label="Confirmar nova senha" value={confirmacao} onChange={setConfirmacao} autoComplete="new-password" />
        </div>
        {retornoSenha.mensagem && (
          <p role="status" className={`text-xs font-bold ${retornoSenha.tipo === 'erro' ? 'text-red-500' : 'text-green-500'}`}>
            {retornoSenha.mensagem}
          </p>
        )}
        <button
          type="submit"
          disabled={alterandoSenha || !senhaAtual || !novaSenha || !confirmacao}
          className="inline-flex items-center gap-2 px-5 py-3 text-xs font-black uppercase tracking-wider disabled:opacity-40"
          style={{ backgroundColor: primary, color: '#000' }}
        >
          <KeyRound size={15} /> {alterandoSenha ? 'Alterando...' : 'Alterar senha'}
        </button>
      </form>

      {/* Cores Primárias */}
      <div className="border p-4 space-y-4 sm:p-6" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background-secondary)' }}>
        <h3 className="font-bold text-sm flex items-center gap-2 uppercase tracking-widest">
          <Palette size={16} style={{ color: primary }} /> Cor de Destaque
        </h3>
        <div className="flex gap-4">
          {CORES_E_LOGOS.map(tema => (
            <button 
              key={tema.value}
              onClick={() => handleSave({ primary: tema.value })}
              className="w-10 h-10 rounded-full transition-transform hover:scale-110 cursor-pointer"
              style={{ 
                backgroundColor: tema.value,
                outline: primary === tema.value ? `2px solid ${tema.value}` : 'none',
                outlineOffset: '2px'
              }}
              title={`Trocar cor para ${tema.label}`}
              aria-label={`Trocar cor para ${tema.label}`}
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

function PasswordField({ label, value, onChange, autoComplete }) {
  return (
    <label className="space-y-2 text-[10px] font-bold uppercase tracking-widest text-foreground-muted">
      <span>{label}</span>
      <input
        type="password"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        autoComplete={autoComplete}
        maxLength={128}
        required
        className="w-full border px-4 py-3 text-sm normal-case tracking-normal outline-none focus-visible:ring-2"
        style={{ backgroundColor: 'var(--background)', borderColor: 'var(--border)' }}
      />
    </label>
  );
}

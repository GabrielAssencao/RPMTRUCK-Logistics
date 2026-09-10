'use client'
import { useEffect, useState } from 'react';
import { AnimatePresence, motion, MotionConfig } from 'framer-motion';
import { useTheme } from '@/contexts/ThemeContext';
import { KeyRound, Palette, ShieldCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { AppearancePreferences } from '@/app/dashboard/empresa/configuracoes/_componentes/PreferencePanels';
import { lerEstiloFundoAdmin, salvarEstiloFundoAdmin } from '@/lib/adminSidebarPreferences';

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
  const [estiloFundo, setEstiloFundo] = useState('DESLIGADO');
  const [secaoAtiva, setSecaoAtiva] = useState('PERSONALIZACAO');

  useEffect(() => {
    const initial = window.setTimeout(() => setEstiloFundo(lerEstiloFundoAdmin()), 0);
    return () => window.clearTimeout(initial);
  }, []);

  const atualizarEstiloFundo = (estilo) => {
    setEstiloFundo(estilo);
    salvarEstiloFundoAdmin(estilo);
  };

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
    <MotionConfig reducedMotion="user">
      <div className="mx-auto max-w-[1200px] space-y-6 font-mono">
        <header className="mb-8">
          <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.3em]" style={{ color: primary }}>Administração do terminal</p>
          <h1 className="font-rajdhani text-3xl font-black uppercase tracking-tight">Configurações <span style={{ color: primary }}>do sistema</span></h1>
          <p className="mt-1 text-sm text-foreground-muted">Personalize o painel administrativo e proteja suas credenciais de acesso.</p>
        </header>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-[240px_minmax(0,1fr)] lg:gap-8">
          <nav className="flex gap-2 overflow-x-auto pb-2 md:sticky md:top-0 md:block md:self-start md:space-y-1 md:overflow-visible md:pb-0" aria-label="Seções das configurações do Superadmin">
            <SettingsTab active={secaoAtiva === 'PERSONALIZACAO'} onClick={() => setSecaoAtiva('PERSONALIZACAO')} icon={<Palette size={16} />} label="Personalização" primary={primary} />
            <SettingsTab active={secaoAtiva === 'SENHA'} onClick={() => setSecaoAtiva('SENHA')} icon={<KeyRound size={16} />} label="Redefinição de senha" primary={primary} />
          </nav>

          <div className="min-w-0">
            <AnimatePresence mode="wait">
              {secaoAtiva === 'PERSONALIZACAO' && (
                <motion.div key="personalizacao" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} transition={{ duration: 0.24, ease: [0.2, 0, 0, 1] }}>
                  <AppearancePreferences
                    primary={primary}
                    isLight={isLight}
                    backgroundStyle={estiloFundo}
                    onPrimaryChange={(color) => void handleSave({ primary: color })}
                    onThemeChange={(light) => void handleSave({ theme: light ? 'light' : 'dark' })}
                    onBackgroundStyleChange={atualizarEstiloFundo}
                  />
                  {salvando && <p role="status" className="mt-4 text-xs font-bold animate-pulse" style={{ color: primary }}>Aplicando preferências...</p>}
                </motion.div>
              )}

              {secaoAtiva === 'SENHA' && (
                <motion.div key="senha" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} transition={{ duration: 0.24, ease: [0.2, 0, 0, 1] }}>
                  <form onSubmit={handlePasswordChange} className="space-y-5 border p-5 sm:p-6" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background-secondary)' }}>
                    <div className="border-b pb-4" style={{ borderColor: 'var(--border)' }}>
                      <h2 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest"><ShieldCheck size={16} style={{ color: primary }} /> Segurança da conta</h2>
                      <p className="mt-2 max-w-2xl text-[10px] leading-relaxed text-foreground-muted">Ao salvar, todas as sessões abertas serão encerradas. Use uma senha exclusiva com 12 ou mais caracteres, maiúscula, minúscula, número e símbolo.</p>
                    </div>
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                      <PasswordField label="Senha atual" value={senhaAtual} onChange={setSenhaAtual} autoComplete="current-password" />
                      <PasswordField label="Nova senha" value={novaSenha} onChange={setNovaSenha} autoComplete="new-password" />
                      <PasswordField label="Confirmar nova senha" value={confirmacao} onChange={setConfirmacao} autoComplete="new-password" />
                    </div>
                    {retornoSenha.mensagem && <p role={retornoSenha.tipo === 'erro' ? 'alert' : 'status'} className={`border p-3 text-xs font-bold ${retornoSenha.tipo === 'erro' ? 'border-red-500/40 bg-red-500/10 text-red-500' : 'border-green-500/40 bg-green-500/10 text-green-500'}`}>{retornoSenha.mensagem}</p>}
                    <button type="submit" disabled={alterandoSenha || !senhaAtual || !novaSenha || !confirmacao} className="interactive-control inline-flex min-h-11 items-center gap-2 px-5 text-xs font-black uppercase tracking-wider disabled:opacity-40" style={{ backgroundColor: primary, color: '#000' }}><KeyRound size={15} /> {alterandoSenha ? 'Alterando...' : 'Alterar senha'}</button>
                  </form>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </MotionConfig>
  );
}

function SettingsTab({ active, onClick, icon, label, primary }) {
  return <button type="button" onClick={onClick} aria-pressed={active} className="flex min-h-12 min-w-max items-center gap-3 px-4 text-xs font-bold uppercase tracking-widest transition-all md:w-full" style={{ backgroundColor: active ? `color-mix(in srgb, ${primary} 12%, transparent)` : 'transparent', color: active ? primary : 'var(--foreground-muted)', borderLeft: `3px solid ${active ? primary : 'transparent'}` }}><span className={active ? '' : 'opacity-70'}>{icon}</span>{label}</button>;
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

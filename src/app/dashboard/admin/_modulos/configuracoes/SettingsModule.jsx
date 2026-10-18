'use client'
import { useEffect, useState } from 'react';
import { AnimatePresence, motion, MotionConfig } from 'framer-motion';
import { useTheme } from '@/contexts/ThemeContext';
import { FileWarning, KeyRound, Loader2, Palette, ShieldCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { AppearancePreferences } from '@/app/dashboard/empresa/configuracoes/_componentes/PreferencePanels';
import { ActionConfirmDialog } from '@/components/dashboard/ActionConfirmDialog';
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
            <SettingsTab active={secaoAtiva === 'DOCUMENTOS'} onClick={() => setSecaoAtiva('DOCUMENTOS')} icon={<FileWarning size={16} />} label="Proteção de documentos" primary={primary} />
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

              {secaoAtiva === 'DOCUMENTOS' && (
                <motion.div key="documentos" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} transition={{ duration: 0.24, ease: [0.2, 0, 0, 1] }}>
                  <DocumentSecurityPanel primary={primary} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </MotionConfig>
  );
}

function DocumentSecurityPanel({ primary }) {
  const [obrigatoria, setObrigatoria] = useState(true);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [retorno, setRetorno] = useState({ tipo: '', mensagem: '' });
  const [pendentes, setPendentes] = useState(0);
  const [incidentes, setIncidentes] = useState([]);

  useEffect(() => {
    let ativo = true;
    fetch('/api/admin/configuracoes-seguranca', { cache: 'no-store' })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.erro || 'Não foi possível consultar a proteção.');
        if (ativo) {
          setObrigatoria(data.verificacaoAntimalwareObrigatoria !== false);
          setPendentes(data.pendentes || 0);
          setIncidentes(data.incidentes || []);
        }
      })
      .catch((error) => {
        if (ativo) setRetorno({ tipo: 'erro', mensagem: error.message });
      })
      .finally(() => { if (ativo) setCarregando(false); });
    return () => { ativo = false; };
  }, []);

  const processarPendentes = async () => {
    let restante = pendentes;
    do {
      const response = await fetch('/api/admin/configuracoes-seguranca/varredura', { method: 'POST' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.erro || 'Não foi possível verificar os arquivos pendentes.');
      restante = data.pendentes || 0;
      setPendentes(restante);
      if (data.falhas > 0) break;
    } while (restante > 0);
    return restante;
  };

  const atualizar = async (novoValor) => {
    setSalvando(true);
    setRetorno({ tipo: '', mensagem: '' });
    try {
      const response = await fetch('/api/admin/configuracoes-seguranca', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          verificacaoAntimalwareObrigatoria: novoValor,
          confirmacao: novoValor ? undefined : 'DESATIVAR_VERIFICACAO_ANTIMALWARE',
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.erro || 'Não foi possível alterar a proteção.');
      setObrigatoria(data.verificacaoAntimalwareObrigatoria);
      setConfirmando(false);
      const restanteInicial = data.fila?.pendentes ?? pendentes;
      setPendentes(restanteInicial);
      const restante = data.verificacaoAntimalwareObrigatoria && restanteInicial > 0 && !data.fila?.falhas
        ? await processarPendentes()
        : restanteInicial;
      if (data.verificacaoAntimalwareObrigatoria) {
        const resumoResponse = await fetch('/api/admin/configuracoes-seguranca', { cache: 'no-store' });
        const resumo = await resumoResponse.json();
        if (resumoResponse.ok) {
          setIncidentes(resumo.incidentes || []);
          setPendentes(resumo.pendentes || restante);
        }
      }
      setRetorno({
        tipo: 'sucesso',
        mensagem: data.verificacaoAntimalwareObrigatoria
          ? (restante ? `${restante} arquivo(s) permanecem isolados até o scanner voltar.` : 'Verificação obrigatória reativada e fila pendente analisada.')
          : 'Liberação temporária ativada. PDFs continuam validados por formato e tamanho, mas não serão examinados pelo antivírus.',
      });
    } catch (error) {
      setRetorno({ tipo: 'erro', mensagem: error instanceof Error ? error.message : 'Erro de conexão.' });
    } finally {
      setSalvando(false);
    }
  };

  return (
    <>
      <section className="space-y-5 border p-5 sm:p-6" style={{ borderColor: obrigatoria ? 'var(--border)' : '#ef444466', backgroundColor: 'var(--background-secondary)' }}>
        <div className="flex flex-col gap-4 border-b pb-5 sm:flex-row sm:items-start sm:justify-between" style={{ borderColor: 'var(--border)' }}>
          <div className="max-w-2xl">
            <h2 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest"><FileWarning size={16} style={{ color: obrigatoria ? primary : '#ef4444' }} /> Proteção antimalware de PDFs</h2>
            <p className="mt-2 text-[11px] leading-relaxed text-foreground-muted">Controla PDFs de boletos, comprovantes e relatórios privados. Imagens, planilhas e CSVs continuam sujeitos às validações específicas de formato e tamanho.</p>
          </div>
          <span className={`w-fit border px-3 py-2 text-[9px] font-black uppercase tracking-wider ${obrigatoria ? 'border-green-500/40 bg-green-500/10 text-green-500' : 'border-red-500/50 bg-red-500/10 text-red-500'}`}>
            {carregando ? 'Consultando...' : obrigatoria ? 'Verificação obrigatória' : 'Antivírus dispensado'}
          </span>
        </div>

        {carregando ? (
          <p role="status" className="flex min-h-20 items-center gap-2 text-xs text-foreground-muted"><Loader2 size={16} className="animate-spin" /> Consultando a política de documentos...</p>
        ) : (
          <div className="space-y-4">
            <div className={`border p-4 ${obrigatoria ? 'border-green-500/30 bg-green-500/5' : 'border-red-500/40 bg-red-500/5'}`}>
              <p className="text-xs font-black uppercase" style={{ color: obrigatoria ? '#22c55e' : '#ef4444' }}>{obrigatoria ? 'Modo protegido' : 'Exceção temporária ativa'}</p>
              <p className="mt-2 text-xs leading-relaxed text-foreground-muted">
                {obrigatoria
                  ? 'Se o ClamAV estiver indisponível ou não confirmar que o PDF está limpo, upload e download permanecem bloqueados.'
                  : 'PDFs serão aceitos sem varredura de malware. Use este modo somente enquanto o scanner privado não estiver disponível e reative-o assim que a infraestrutura estiver pronta.'}
              </p>
            </div>
            <div className="grid gap-3 border p-4 sm:grid-cols-[1fr_auto] sm:items-center" style={{ borderColor: 'var(--border)' }}>
              <div><p className="text-xs font-black uppercase">Arquivos aguardando reanálise: {pendentes}</p><p className="mt-1 text-[10px] text-foreground-muted">Após a reativação, documentos pendentes permanecem isolados até o ClamAV confirmar que estão limpos.</p></div>
              {obrigatoria && pendentes > 0 && <button type="button" disabled={salvando} onClick={async () => { setSalvando(true); try { const restante = await processarPendentes(); setRetorno({ tipo: restante ? 'erro' : 'sucesso', mensagem: restante ? `${restante} arquivo(s) continuam isolados. Verifique o scanner.` : 'Todos os arquivos pendentes foram analisados.' }); } catch (error) { setRetorno({ tipo: 'erro', mensagem: error instanceof Error ? error.message : 'Erro de conexão.' }); } finally { setSalvando(false); } }} className="interactive-control min-h-11 border px-4 text-xs font-black uppercase disabled:opacity-50" style={{ borderColor: primary, color: primary }}>Verificar pendentes</button>}
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={obrigatoria}
              disabled={salvando}
              onClick={() => obrigatoria ? setConfirmando(true) : void atualizar(true)}
              className="interactive-control inline-flex min-h-11 items-center gap-2 border px-5 text-xs font-black uppercase tracking-wider disabled:cursor-wait disabled:opacity-50"
              style={{ borderColor: obrigatoria ? '#ef4444' : primary, color: obrigatoria ? '#ef4444' : '#000', backgroundColor: obrigatoria ? 'transparent' : primary }}
            >
              {salvando && <Loader2 size={15} className="animate-spin" />}
              {salvando ? 'Salvando...' : obrigatoria ? 'Liberar PDFs temporariamente' : 'Reativar verificação obrigatória'}
            </button>
          </div>
        )}

        {retorno.mensagem && <p role={retorno.tipo === 'erro' ? 'alert' : 'status'} className={`border p-3 text-xs font-bold ${retorno.tipo === 'erro' ? 'border-red-500/40 bg-red-500/10 text-red-500' : 'border-green-500/40 bg-green-500/10 text-green-500'}`}>{retorno.mensagem}</p>}
      </section>

      {incidentes.length > 0 && <section className="mt-5 border p-5" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background-secondary)' }}><h3 className="text-xs font-black uppercase tracking-widest">Arquivos isolados recentemente</h3><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[680px] text-left text-xs"><thead className="text-[9px] uppercase text-foreground-muted"><tr><th className="p-2">Arquivo</th><th className="p-2">Empresa</th><th className="p-2">Enviado por</th><th className="p-2">Resultado</th><th className="p-2">Data</th></tr></thead><tbody>{incidentes.map((item) => <tr key={item.id} className="border-t" style={{ borderColor: 'var(--border)' }}><td className="p-2 font-bold">{item.nome}</td><td className="p-2">{item.empresa}</td><td className="p-2">{item.usuario ? `${item.usuario.nome} · ${item.usuario.email}` : 'Usuário removido'}</td><td className="p-2 text-red-500">{item.detalhe}</td><td className="p-2">{item.verificadoEm ? new Date(item.verificadoEm).toLocaleString('pt-BR') : '—'}</td></tr>)}</tbody></table></div></section>}

      <ActionConfirmDialog
        open={confirmando}
        title="Liberar PDFs sem antivírus?"
        description="Enquanto esta exceção estiver ativa, PDFs de boletos, comprovantes e relatórios poderão ser armazenados e baixados sem análise do ClamAV. Validações de tamanho, tipo e assinatura do arquivo continuarão ativas, e a alteração ficará registrada na auditoria."
        eyebrow="Redução temporária de proteção"
        confirmLabel="Confirmar liberação temporária"
        loadingLabel="Liberando..."
        tone="danger"
        loading={salvando}
        onClose={() => { if (!salvando) setConfirmando(false); }}
        onConfirm={() => void atualizar(false)}
      />
    </>
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

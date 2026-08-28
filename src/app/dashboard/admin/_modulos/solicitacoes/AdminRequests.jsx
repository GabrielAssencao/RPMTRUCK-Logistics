// src/app/admin/modules/solicitacoes/AdminRequests.jsx
'use client'
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Phone, User, Truck, CheckCircle, XCircle, Copy, KeyRound } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { criarMensagensPrimeiroAcesso } from '@/lib/accessMessages';

export default function AdminRequests() {
  const { primary } = useTheme();
  const [solicitacoes, setSolicitacoes] = useState([]);
  const [filtro, setFiltro] = useState('pendente');
  const [processando, setProcessando] = useState(null);
  const [loading, setLoading] = useState(true);
  const [entrega, setEntrega] = useState(null);
  const [copiado, setCopiado] = useState('');
  const [erroAcao, setErroAcao] = useState('');

  const carregarSolicitacoes = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/solicitacoes');
      if (res.ok) {
        const data = await res.json();
        setSolicitacoes(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error("Erro ao carregar solicitações:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    queueMicrotask(() => void carregarSolicitacoes());
  }, []);

  const aprovarSolicitacao = async (id) => {
    if (confirm("Confirmar aprovação deste lead? Isso criará a empresa e a conta do gestor automaticamente.")) {
      setProcessando(id);
      setErroAcao('');
      try {
        const solicitacao = solicitacoes.find((item) => item.id === id);
        const res = await fetch(`/api/solicitacoes/${id}/aprovar`, { method: 'POST' });
        const data = await res.json();
        if (!res.ok) {
          setErroAcao(data.erro || 'Não foi possível aprovar a solicitação.');
          return;
        }
        const mensagens = criarMensagensPrimeiroAcesso({
          empresa: solicitacao.empresa,
          responsavel: solicitacao.responsavel,
          email: data.credencialTemporaria.email,
          senhaTemporaria: data.credencialTemporaria.senha,
          expiraEm: data.credencialTemporaria.expiraEm,
          loginUrl: `${window.location.origin}/auth/login`,
        });
        setEntrega({ solicitacao, credencial: data.credencialTemporaria, mensagens });
        await carregarSolicitacoes();
      } catch {
        setErroAcao('Erro de conexão ao aprovar a solicitação.');
      } finally {
        setProcessando(null);
      }
    }
  };

  const copiar = async (tipo, texto) => {
    await navigator.clipboard.writeText(texto);
    setCopiado(tipo);
    window.setTimeout(() => setCopiado(''), 1800);
  };

  const rejeitarSolicitacao = async (id) => {
    if (confirm("Deseja rejeitar esta solicitação de acesso?")) {
      setProcessando(id);
      const res = await fetch(`/api/solicitacoes/${id}/rejeitar`, { method: 'POST' });
      if (res.ok) carregarSolicitacoes();
      setProcessando(null);
    }
  };

  const filtrarSolicitacoes = filtro === 'all' 
    ? solicitacoes 
    : solicitacoes.filter(r => r.status?.toLowerCase() === filtro.toLowerCase());

  return (
    <div className="space-y-6 max-w-full overflow-hidden">
      {/* CABEÇALHO */}
      <div>
        <p className="text-primary font-bold tracking-[0.3em] text-[10px] mb-1">MÓDULO DE ENTRADA</p>
        <h2 className="text-3xl font-black" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
          SOLICITAÇÕES DE <span className="text-primary">ACESSO</span>
        </h2>
      </div>

      {erroAcao && <p role="alert" className="border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-500">{erroAcao}</p>}

      {/* FILTROS CIBER-INDUSTRIAS */}
      <div className="flex gap-1 overflow-x-auto custom-scrollbar border-b pb-2" style={{ borderColor: 'var(--border)' }}>
        {['pendente', 'aprovado', 'rejeitado', 'all'].map(f => {
          const total = solicitacoes.filter(r => r.status?.toLowerCase() === f || f === 'all').length;
          const ativo = filtro === f;
          return (
            <button 
              key={f} 
              onClick={() => setFiltro(f)}
              className="px-4 py-2.5 text-[10px] font-black tracking-widest uppercase transition-all border whitespace-nowrap"
              style={{ 
                backgroundColor: ativo ? primary : 'var(--background-secondary)',
                borderColor: ativo ? primary : 'var(--border)',
                color: ativo ? '#000' : 'var(--foreground-muted)'
              }}
            >
              {f} [{total}]
            </button>
          );
        })}
      </div>

      {/* CONTAINER DAS SOLICITAÇÕES */}
      <div className="space-y-4 max-h-[calc(100vh-260px)] overflow-y-auto custom-scrollbar pr-1">
        {loading ? (
          <div className="p-12 text-center text-xs font-mono font-bold tracking-widest animate-pulse uppercase">
            Sincronizando Leads com a Database...
          </div>
        ) : filtrarSolicitacoes.length === 0 ? (
          <div className="p-12 text-center text-xs font-mono border border-dashed opacity-40" style={{ borderColor: 'var(--border)' }}>
            Nenhuma requisição encontrada nesta categoria.
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {filtrarSolicitacoes.map((req, i) => (
              <motion.div 
                key={req.id || i} 
                initial={{ opacity: 0, y: 10 }} 
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className="border p-5 relative" 
                style={{ backgroundColor: 'var(--background-secondary)', borderColor: 'var(--border)' }}
              >
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-3 flex-wrap">
                      <h3 className="font-black text-2xl tracking-tight uppercase" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
                        {req.empresa}
                      </h3>
                      <span className="text-[10px] font-mono px-2 py-0.5 border uppercase font-bold" style={{ color: primary, borderColor: `${primary}40`, backgroundColor: `${primary}05` }}>
                        Plano: {req.plano || 'N/I'}
                      </span>
                    </div>

                    {/* GRUPO DE INFOS DO LEAD */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs font-mono font-bold pt-1">
                      <div className="flex items-center gap-2 opacity-70">
                        <User size={12} style={{ color: primary }} />
                        <span className="truncate">{req.responsavel}</span>
                      </div>
                      <div className="flex items-center gap-2 opacity-70">
                        <Mail size={12} style={{ color: primary }} />
                        <span className="truncate">{req.email}</span>
                      </div>
                      <div className="flex items-center gap-2 opacity-70">
                        <Phone size={12} style={{ color: primary }} />
                        <span>{req.whatsapp || 'NÃO INFORMADO'}</span>
                      </div>
                      <div className="flex items-center gap-2 opacity-70">
                        <Truck size={12} style={{ color: primary }} />
                        <span className="uppercase">FROTA: {req.veiculos || '0'} TRUCKS</span>
                      </div>
                    </div>

                    {req.mensagem && (
                      <p className="text-xs bg-black/10 p-3 border border-border text-foreground-muted font-sans mt-2 italic">
                        “{req.mensagem}”
                      </p>
                    )}
                  </div>
                  
                  {/* BOTÕES DE DECISÃO TÉCNICA */}
                  {req.status?.toLowerCase() === 'pendente' && (
                    <div className="flex gap-2 w-full md:w-auto shrink-0 pt-2 md:pt-0">
                      <button 
                        onClick={() => aprovarSolicitacao(req.id)} 
                        disabled={processando !== null}
                        className="flex-1 md:flex-initial flex items-center justify-center gap-2 bg-green-500/10 text-green-500 hover:bg-green-500/20 px-4 py-2 text-[10px] font-black border border-green-500/20 tracking-wider transition-colors"
                      >
                        <CheckCircle size={14} /> APROVAR
                      </button>
                      <button 
                        onClick={() => rejeitarSolicitacao(req.id)} 
                        disabled={processando !== null}
                        className="p-2 border border-border text-red-500 hover:bg-red-500/10 hover:border-red-500/20 transition-all bg-background" 
                        title="Rejeitar Solicitação"
                      >
                        <XCircle size={14} />
                      </button>
                    </div>
                  )}

                  {req.status?.toLowerCase() === 'aprovado' && (
                    <span className="text-[10px] font-mono font-black border border-green-500/30 text-green-500 bg-green-500/5 px-3 py-1 uppercase tracking-widest shrink-0">
                      ✓ INSTÂNCIA ATIVA
                    </span>
                  )}

                  {req.status?.toLowerCase() === 'rejeitado' && (
                    <span className="text-[10px] font-mono font-black border border-red-500/30 text-red-500 bg-red-500/5 px-3 py-1 uppercase tracking-widest shrink-0">
                      🗙 RECUSADO
                    </span>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>

      <AnimatePresence>
        {entrega && (
          <motion.div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div role="dialog" aria-modal="true" aria-labelledby="credencial-title" className="w-full max-w-3xl max-h-[90vh] overflow-y-auto border p-6 space-y-5" style={{ backgroundColor: 'var(--background)', borderColor: primary }} initial={{ scale: 0.97 }} animate={{ scale: 1 }}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: primary }}>Entrega única</p>
                  <h3 id="credencial-title" className="text-2xl font-black font-rajdhani">CREDENCIAL DE PRIMEIRO ACESSO</h3>
                </div>
                <button type="button" onClick={() => setEntrega(null)} aria-label="Fechar" className="p-2 border" style={{ borderColor: 'var(--border)' }}><XCircle size={18} /></button>
              </div>
              <p className="border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-500">
                Esta senha aparece somente agora e não é armazenada em texto legível. Copie a mensagem antes de fechar.
              </p>
              <div className="grid sm:grid-cols-2 gap-3 text-xs">
                <div className="border p-3" style={{ borderColor: 'var(--border)' }}><span className="block opacity-60 mb-1">E-mail</span>{entrega.credencial.email}</div>
                <div className="border p-3" style={{ borderColor: 'var(--border)' }}><span className="block opacity-60 mb-1">Senha temporária</span><span className="font-bold">{entrega.credencial.senha}</span></div>
              </div>
              <div className="border p-4 space-y-3" style={{ borderColor: 'var(--border)' }}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <strong className="text-xs uppercase tracking-widest"><Mail size={14} className="inline mr-2" />Modelo de e-mail</strong>
                  <button type="button" onClick={() => copiar('email', `Assunto: ${entrega.mensagens.assunto}\n\n${entrega.mensagens.email}`)} className="flex items-center gap-2 border px-3 py-2 text-[10px] font-bold uppercase" style={{ borderColor: primary, color: primary }}><Copy size={13} />{copiado === 'email' ? 'Copiado' : 'Copiar e-mail'}</button>
                </div>
                <p className="text-xs"><strong>Assunto:</strong> {entrega.mensagens.assunto}</p>
                <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed text-foreground-muted">{entrega.mensagens.email}</pre>
              </div>
              <div className="border p-4 space-y-3" style={{ borderColor: entrega.solicitacao.contatoPref === 'whatsapp' ? primary : 'var(--border)' }}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <strong className="text-xs uppercase tracking-widest"><Phone size={14} className="inline mr-2" />Modelo de WhatsApp</strong>
                  <button type="button" onClick={() => copiar('whatsapp', entrega.mensagens.whatsapp)} className="flex items-center gap-2 border px-3 py-2 text-[10px] font-bold uppercase" style={{ borderColor: primary, color: primary }}><Copy size={13} />{copiado === 'whatsapp' ? 'Copiado' : 'Copiar WhatsApp'}</button>
                </div>
                <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed text-foreground-muted">{entrega.mensagens.whatsapp}</pre>
              </div>
              <button type="button" onClick={() => setEntrega(null)} className="w-full py-3 text-xs font-black uppercase tracking-wider" style={{ backgroundColor: primary, color: '#000' }}><KeyRound size={14} className="inline mr-2" />Já copiei — fechar</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

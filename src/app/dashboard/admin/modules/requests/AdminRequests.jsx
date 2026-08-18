// src/app/admin/modules/solicitacoes/AdminRequests.jsx
'use client'
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Phone, Building2, User, Truck, Layers, CheckCircle, XCircle, Clock } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';

export default function AdminRequests() {
  const { primary } = useTheme();
  const [solicitacoes, setSolicitacoes] = useState([]);
  const [filtro, setFiltro] = useState('pendente');
  const [processando, setProcessando] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { 
    carregarSolicitacoes(); 
  }, []);

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

  const aprovarSolicitacao = async (id) => {
    if (confirm("Confirmar aprovação deste lead? Isso criará a empresa e a conta do gestor automaticamente.")) {
      setProcessando(id);
      const res = await fetch(`/api/solicitacoes/${id}/aprovar`, { method: 'POST' });
      if (res.ok) carregarSolicitacoes();
      setProcessando(null);
    }
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
                        "{req.mensagem}"
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
    </div>
  );
}
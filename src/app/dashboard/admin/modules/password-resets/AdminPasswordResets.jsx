// src/app/dashboard/admin/modules/password-resets/AdminPasswordResets.jsx
'use client'
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, X, KeyRound, UserPlus, Copy, Calendar, Mail } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';

export default function AdminRequestsAndResets() {
  const { primary } = useTheme();
  const [subTab, setSubTab] = useState('contas'); // 'contas' ou 'resets'
  
  // Filtros de status individuais
  const [filtroContas, setFiltroContas] = useState('PENDENTE');
  const [filtroResets, setFiltroResets] = useState('PENDENTE');

  const [contas, setContas] = useState([]);
  const [resets, setResets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generatedKey, setGeneratedKey] = useState({ id: null, key: '' });

  // ─── BUSCANDO DADOS REAIS DO BANCO ─────────────────────────────────────────
  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        // Dispara as duas requisições simultaneamente para performance
        const [resContas, resResets] = await Promise.all([
          fetch('/api/solicitacoes'), // Rota que lista a tabela "solicitacoes_acesso"
          fetch('/api/resets')        // Rota que lista a tabela "resets_senha"
        ]);

        if (resContas.ok) {
          const dadosContas = await resContas.json();
          setContas(dadosContas);
        }
        
        if (resResets.ok) {
          const dadosResets = await resResets.json();
          setResets(dadosResets);
        }
      } catch (error) {
        console.error("Erro ao sincronizar com o banco de dados:", error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [subTab]);

  // ─── AÇÕES CONECTADAS AO BANCO (UPDATE/PATCH) ────────────────────────────
  const handleAprovarConta = async (id) => {
    try {
      const response = await fetch(`/api/solicitacoes/${id}/aprovar`, { method: 'POST' });

      if (response.ok) {
        setContas(contas.map(c => c.id === id ? { ...c, status: 'APROVADO' } : c));
        alert("Instância criada na base de dados com sucesso!");
      }
    } catch (error) {
      console.error("Erro ao aprovar conta:", error);
      alert("Falha ao se comunicar com o servidor.");
    }
  };

  const handleRejeitarConta = async (id) => {
    try {
      const response = await fetch(`/api/solicitacoes/${id}/rejeitar`, { method: 'POST' });

      if (response.ok) {
        setContas(contas.map(c => c.id === id ? { ...c, status: 'REJEITADO' } : c));
      }
    } catch (error) {
      console.error("Erro ao rejeitar conta:", error);
    }
  };

  const handleGerarSenhaTemporaria = async (id) => {
    // Gera a chave e atualiza no banco de dados real
    try {
      const response = await fetch(`/api/resets/${id}/liberar`, { method: 'POST' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.erro || 'Não foi possível liberar o reset.');

      setGeneratedKey({ id, key: data.chave });
      setResets(resets.map(r => r.id === id ? { ...r, status: 'CONCLUIDO', chave: data.chave } : r));
    } catch (error) {
      console.error("Erro ao liberar reset:", error);
      alert(error instanceof Error ? error.message : 'Erro ao liberar a senha temporária.');
    }
  };

  const handleCopyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    alert(`Chave copiada com sucesso: ${text}`);
  };

  // Lógica de filtragem baseada nas seleções superiores
  const contasFiltradas = filtroContas === 'ALL' ? contas : contas.filter(c => c.status === filtroContas);
  const resetsFiltrados = filtroResets === 'ALL' ? resets : resets.filter(r => r.status === filtroResets);

  return (
    <div className="space-y-6 max-w-full overflow-hidden">
      
      {/* MENU SUPERIOR DE ABAS SECUNDÁRIAS */}
      <div className="flex border-b gap-2 overflow-x-auto custom-scrollbar" style={{ borderColor: 'var(--border)' }}>
        <button onClick={() => setSubTab('contas')} className="px-4 py-3 text-[10px] font-black tracking-widest flex items-center gap-2 relative whitespace-nowrap" style={{ color: subTab === 'contas' ? primary : 'var(--foreground-muted)' }}>
          <UserPlus size={14} /> CRIAÇÃO DE CONTA (LANDING PAGE)
          {subTab === 'contas' && <motion.div layoutId="subTabLine" className="absolute bottom-0 left-0 right-0 h-0.5" style={{ backgroundColor: primary }} />}
        </button>
        <button onClick={() => setSubTab('resets')} className="px-4 py-3 text-[10px] font-black tracking-widest flex items-center gap-2 relative whitespace-nowrap" style={{ color: subTab === 'resets' ? primary : 'var(--foreground-muted)' }}>
          <KeyRound size={14} /> RESETS DE SENHA
          {subTab === 'resets' && <motion.div layoutId="subTabLine" className="absolute bottom-0 left-0 right-0 h-0.5" style={{ backgroundColor: primary }} />}
        </button>
      </div>

      {/* FILTROS SUB-DIVIDIDOS POR STATUS */}
      <div className="flex gap-1 overflow-x-auto custom-scrollbar">
        {subTab === 'contas' ? (
          ['PENDENTE', 'APROVADO', 'REJEITADO', 'ALL'].map(f => (
            <button key={f} onClick={() => setFiltroContas(f)} className="px-3 py-1.5 text-[9px] font-mono border uppercase tracking-widest font-black" style={{ backgroundColor: filtroContas === f ? primary : 'transparent', borderColor: filtroContas === f ? primary : 'var(--border)', color: filtroContas === f ? '#000' : 'var(--foreground-muted)' }}>
              {f} ({f === 'ALL' ? contas.length : contas.filter(c => c.status === f).length})
            </button>
          ))
        ) : (
          ['PENDENTE', 'CONCLUIDO', 'REJEITADO', 'ALL'].map(f => (
            <button key={f} onClick={() => setFiltroResets(f)} className="px-3 py-1.5 text-[9px] font-mono border uppercase tracking-widest font-black" style={{ backgroundColor: filtroResets === f ? primary : 'transparent', borderColor: filtroResets === f ? primary : 'var(--border)', color: filtroResets === f ? '#000' : 'var(--foreground-muted)' }}>
              {f} ({f === 'ALL' ? resets.length : resets.filter(r => r.status === f).length})
            </button>
          ))
        )}
      </div>

      {/* CONTAINER DE EXIBIÇÃO */}
      {loading ? (
        <div className="h-48 flex items-center justify-center font-bold font-mono tracking-widest animate-pulse text-xs uppercase" style={{ color: primary }}>
          Sincronizando Banco Técnico...
        </div>
      ) : (
        <AnimatePresence mode="wait">
          {subTab === 'contas' ? (
            <motion.div key="contas-table" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
              <table className="w-full text-left border-collapse">
                <thead className="bg-background-secondary border-b" style={{ borderColor: 'var(--border)' }}>
                  <tr>
                    {['EMPRESA / SOLICITANTE', 'E-mail', 'PLANO PRETENDIDO', 'STATUS LOG', 'AÇÕES'].map(h => (
                      <th key={h} className="px-5 py-3 text-[10px] font-black tracking-widest opacity-60 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {contasFiltradas.length === 0 ? (
                    <tr><td colSpan={5} className="p-8 text-center text-xs text-foreground-muted font-mono">Nenhuma solicitação encontrada.</td></tr>
                  ) : contasFiltradas.map(c => (
                    <tr key={c.id} className="border-b last:border-0 hover:bg-black/5 text-sm font-bold" style={{ borderColor: 'var(--border)' }}>
                      <td className="px-5 py-4">
                        <div className="uppercase tracking-wide font-black" style={{ fontFamily: 'Rajdhani, sans-serif' }}>{c.nome_empresa || c.empresa}</div>
                        <div className="text-[10px] opacity-40 font-mono font-normal mt-0.5">CONTATO: {c.contato || c.responsavel}</div>
                      </td>
                      <td className="px-5 py-4 font-mono text-xs font-normal">{c.email}</td>
                      <td className="px-5 py-4"><span className="text-[10px] font-mono px-2 py-0.5 border" style={{ color: primary, borderColor: `${primary}30` }}>{c.plano_escolhido || c.plano}</span></td>
                      <td className="px-5 py-4">
                        <span className={`text-[9px] font-mono px-2 py-0.5 border font-black ${c.status === 'PENDENTE' ? 'text-yellow-500 bg-yellow-500/5' : c.status === 'APROVADO' ? 'text-green-500 bg-green-500/5' : 'text-red-500 bg-red-500/5'}`}>{c.status}</span>
                      </td>
                      <td className="px-5 py-4">
                        {c.status === 'PENDENTE' && (
                          <div className="flex gap-2">
                            <button onClick={() => handleAprovarConta(c.id)} className="p-1.5 border border-border text-green-500 hover:bg-green-500/10 transition-colors"><Check size={14} /></button>
                            <button onClick={() => handleRejeitarConta(c.id)} className="p-1.5 border border-border text-red-500 hover:bg-red-500/10 transition-colors"><X size={14} /></button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </motion.div>
          ) : (
            <motion.div key="resets-table" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
              <table className="w-full text-left border-collapse">
                <thead className="bg-background-secondary border-b" style={{ borderColor: 'var(--border)' }}>
                  <tr>
                    {['USUÁRIO SOLICITANTE', 'DATA DO PEDIDO', 'STATUS LOG', 'CHAVE GERADA', 'INFRAESTRUTURA AÇÕES'].map(h => (
                      <th key={h} className="px-5 py-3 text-[10px] font-black tracking-widest opacity-60 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {resetsFiltrados.length === 0 ? (
                    <tr><td colSpan={5} className="p-8 text-center text-xs text-foreground-muted font-mono">Nenhum reset encontrado.</td></tr>
                  ) : resetsFiltrados.map(r => (
                    <tr key={r.id} className="border-b last:border-0 hover:bg-black/5 text-sm font-bold" style={{ borderColor: 'var(--border)' }}>
                      <td className="px-5 py-4 font-mono text-xs">{r.email}</td>
                      <td className="px-5 py-4 font-mono text-xs opacity-70 font-normal">
                        {new Date(r.criado_em || r.created_at).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="px-5 py-4">
                        <span className={`text-[9px] font-mono px-2 py-0.5 border font-black ${r.status === 'PENDENTE' ? 'text-yellow-500 bg-yellow-500/5 animate-pulse' : 'text-green-500 bg-green-500/5'}`}>{r.status}</span>
                      </td>
                      <td className="px-5 py-4 font-mono text-xs">
                        {(r.chave || generatedKey.id === r.id) ? (
                          <div onClick={() => handleCopyToClipboard(r.chave || generatedKey.key)} className="inline-flex items-center gap-2 border border-dashed px-2 py-1 bg-black/5 text-primary cursor-pointer hover:bg-white/5 transition-colors">
                            <span className="text-[11px]">{r.chave || generatedKey.key}</span><Copy size={11} />
                          </div>
                        ) : <span className="opacity-30 italic text-xs font-normal">Nenhuma chave ativa</span>}
                      </td>
                      <td className="px-5 py-4">
                        {r.status === 'PENDENTE' && (
                          <button onClick={() => handleGerarSenhaTemporaria(r.id)} className="px-3 py-1.5 text-[10px] font-black border tracking-widest hover:bg-primary/10 transition-colors" style={{ color: primary, borderColor: primary }}>
                            LIBERAR RESET
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  );
}

'use client'
import { useState } from 'react';
import { Search, SlidersHorizontal, ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAdminData } from '../../hooks/useAdminData';
import { useTheme } from '@/contexts/ThemeContext';
import CompanyFinancialControl from './CompanyFinancialControl';

export default function CompaniesModule() {
  const { primary } = useTheme();
  const { empresas, loading, refresh } = useAdminData();
  const [filtroBusca, setFiltroBusca] = useState('');
  const [empresaSelecionada, setEmpresaSelecionada] = useState(null);

  if (loading) return <div className="h-64 flex items-center justify-center font-bold animate-pulse tracking-widest">SINCRONIZANDO OPERAÇÕES...</div>;

  const listaEmpresas = Array.isArray(empresas) ? empresas : [];
  const empresasFiltradas = listaEmpresas.filter(e => 
    e.nome?.toLowerCase().includes(filtroBusca.toLowerCase()) || e.cnpj?.includes(filtroBusca)
  );

  return (
    <div className="space-y-6 max-w-full overflow-hidden">
      <AnimatePresence mode="wait">
        {!empresaSelecionada ? (
          <motion.div key="lista-view" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} className="space-y-6">
            <div>
              <p className="text-primary font-bold tracking-[0.3em] text-[10px] mb-1">MÓDULO DE CONTROLE</p>
              <h1 className="text-3xl font-black" style={{ fontFamily: 'Rajdhani, sans-serif' }}>GESTÃO DE <span className="text-primary">EMPRESAS</span></h1>
            </div>

            <div className="flex gap-3 w-full">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 opacity-40" size={16} />
                <input 
                  type="text" placeholder="Buscar por transportadora, CNPJ..." value={filtroBusca}
                  onChange={(e) => setFiltroBusca(e.target.value)}
                  className="w-full pl-12 pr-4 py-3.5 text-sm outline-none border transition-all bg-[var(--background-secondary)]"
                  style={{ borderColor: 'var(--border)' }}
                />
              </div>
            </div>

            <div className="w-full border overflow-y-auto max-h-[calc(100vh-270px)] custom-scrollbar" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background-secondary)' }}>
              <table className="w-full text-left border-collapse relative">
                <thead className="sticky top-0 bg-[var(--background-secondary)] z-10 shadow-[0_1px_0_0_var(--border)]">
                  <tr className="border-b" style={{ borderColor: 'var(--border)' }}>
                    {['TRANSPORTADORA', 'PLANO', 'MENSALIDADE', 'STATUS FINANCEIRO', 'AÇÃO'].map(h => (
                      <th key={h} className="px-5 py-4 text-[10px] font-black tracking-widest opacity-60 bg-[var(--background-secondary)]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {empresasFiltradas.map((empresa) => (
                    <tr key={empresa.id} className="border-b last:border-0 hover:bg-black/5 text-sm font-bold" style={{ borderColor: 'var(--border)' }}>
                      <td className="px-5 py-4 font-black uppercase tracking-wide">{empresa.nome}</td>
                      <td className="px-5 py-4"><span className="text-[10px] font-mono px-2 py-0.5 border" style={{ color: primary, borderColor: `${primary}30` }}>{empresa.plano}</span></td>
                      
                      {/* COLUNA MENSALIDADE CORRIGIDA */}
                      <td className="px-5 py-4 font-mono text-xs font-black">
                        {empresa.plano === 'PREVIEW' 
                          ? <span className="text-blue-500">GRÁTIS</span> 
                          : empresa.mensalidade === 0 ? 'CUSTO ZERO' : `R$ ${Number(empresa.mensalidade).toFixed(2)}`
                        }
                      </td>

                      <td className="px-5 py-4">
                        {empresa.plano === 'PREVIEW' ? (
                          <span className="text-[10px] px-2 py-1 uppercase font-mono border bg-blue-500/10 text-blue-400 border-blue-500/20">✦ PREVIEW</span>
                        ) : (
                          <span className={`text-[10px] px-2 py-1 uppercase font-mono border ${empresa.status === 'ATIVO' ? 'bg-green-500/10 text-green-500 border-green-500/20' : 'bg-red-500/10 text-red-500 border-red-500/20'}`}>
                            {empresa.status}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <button onClick={() => setEmpresaSelecionada(empresa)} className="px-3 py-1.5 text-xs font-black bg-primary text-black">GERENCIAR</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        ) : (
          <motion.div key="detalhe-view" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}>
            <button onClick={() => setEmpresaSelecionada(null)} className="mb-4 flex items-center gap-2 text-xs font-black opacity-50"><ArrowLeft size={14}/> VOLTAR</button>
            <CompanyFinancialControl
              empresa={empresaSelecionada}
              onUpdate={(empresaAtualizada) => {
                setEmpresaSelecionada(atual => ({ ...atual, ...empresaAtualizada }));
                void refresh();
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

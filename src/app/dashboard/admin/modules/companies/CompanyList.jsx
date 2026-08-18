'use client'
import { useState } from 'react';
import { motion } from 'framer-motion';
import { Search, ChevronRight } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';

export default function CompanyList({ companies = [], loading, onSelect }) {
  const { primary } = useTheme();
  const [search, setSearch] = useState('');

  // PROTEÇÃO: Garante que trabalharemos sempre com um array
  const listaSegura = Array.isArray(companies) ? companies : [];

  const filtered = listaSegura.filter(c =>
    c.nome?.toLowerCase().includes(search.toLowerCase()) ||
    c.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Busca */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-50" />
        <input 
          value={search} 
          onChange={e => setSearch(e.target.value)} 
          placeholder="Buscar empresa..."
          className="w-full bg-transparent border px-10 py-2.5 text-sm outline-none focus:border-primary transition-colors" 
          style={{ borderColor: 'var(--border)' }} 
        />
      </div>

      {/* Tabela */}
      <div className="border" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background-secondary)' }}>
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b" style={{ borderColor: 'var(--border)' }}>
              {['EMPRESA', 'RESPONSÁVEL', 'PLANO', 'MÓDULOS', 'STATUS', ''].map(h => (
                <th key={h} className="px-4 py-3 text-[10px] font-bold tracking-widest opacity-60 uppercase">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="p-10 text-center animate-pulse">CARREGANDO DADOS...</td></tr>
            ) : (
              filtered.map((c, i) => (
                <motion.tr 
                  key={c.id} 
                  initial={{ opacity: 0 }} 
                  animate={{ opacity: 1 }} 
                  transition={{ delay: i * 0.05 }}
                  className="border-b last:border-0 hover:bg-black/5 transition-colors" 
                  style={{ borderColor: 'var(--border)' }}
                >
                  <td className="px-4 py-4 font-bold">{c.nome}</td>
                  <td className="px-4 py-4 text-sm opacity-70">{c.nome_contato || '—'}</td>
                  <td className="px-4 py-4 text-sm opacity-70 uppercase">{c.plano}</td>
                  
                  <td className="px-4 py-4">
                    <div className="flex gap-1 flex-wrap">
                      {(Array.isArray(c.modulos) ? c.modulos : []).map(m => (
                        <span 
                          key={m} 
                          className="text-[9px] font-bold px-2 py-0.5 uppercase tracking-widest" 
                          style={{ 
                            backgroundColor: `${primary}20`, 
                            color: primary, 
                            border: `1px solid ${primary}40` 
                          }}
                        >
                          {m.substring(0, 3)}
                        </span>
                      ))}
                    </div>
                  </td>

                  <td className="px-4 py-4">
                    <StatusBadge status={c.status} />
                  </td>
                  
                  <td className="px-4 py-4 text-right">
                    <button 
                      onClick={() => onSelect(c.id)}
                      className="flex items-center gap-1 text-xs font-bold hover:underline ml-auto" 
                      style={{ color: primary }}
                    >
                      GERENCIAR <ChevronRight className="w-3 h-3" />
                    </button>
                  </td>
                </motion.tr>
              ))
            )}
          </tbody>
        </table>
        
        {!loading && filtered.length === 0 && (
          <div className="p-10 text-center opacity-50">Nenhuma empresa encontrada.</div>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const colors = { 
    ativo: 'bg-green-500/10 text-green-500 border-green-500/20', 
    aguardando_aprovacao: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
    pendente: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
    inadimplente: 'bg-red-500/10 text-red-500 border-red-500/20'
  };
  
  return (
    <span className={`text-[10px] px-2 py-1 uppercase font-bold border ${colors[status] || 'bg-gray-500/10 border-gray-500/20'}`}>
      {status?.replace('_', ' ') || 'Pendente'}
    </span>
  );
}
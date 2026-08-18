// src/app/admin/modules/companies/CompanyFinancialControl.jsx
'use client'
import { useState, useEffect } from 'react';
import { 
  LayoutDashboard, Layers, Users, Truck, 
  CreditCard, Plus, Minus, Check, Save 
} from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { motion } from 'framer-motion';
import CompanyUsersManager from './CompanyUsersManager'; 
import CompanyVehiclesManager from './CompanyVehiclesManager'; 

// ─── CONSTANTES DE PRECIFICAÇÃO E LIMITES ────────────────────────────────
const PLANOS_CONFIG = {
  ESSENCIAL: { base: 450, setup: 300, uBase: 4, vBase: 10 },
  AVANCADO: { base: 650, setup: 500, uBase: 10, vBase: 25 },
  ENTERPRISE: { base: 1250, setup: 1000, uBase: 25, vBase: 80 },
  PREVIEW: { base: 0, setup: 0, uBase: 999, vBase: 999 }
};

const MODULOS_PADRAO = {
  ESSENCIAL: ['Módulo Frota'],
  AVANCADO: ['Módulo Frota', 'Controle & Gestão'],
  ENTERPRISE: ['Módulo Frota', 'Controle & Gestão', 'Relatórios & Dashboards'],
  PREVIEW: []
};

const TODOS_OS_MODULOS = ['Módulo Frota', 'Controle & Gestão', 'Relatórios & Dashboards'];
// ─────────────────────────────────────────────────────────────────────────

export default function CompanyFinancialControl({ empresa, onBack }) {
  const { primary } = useTheme();
  const [tabAtiva, setTabAtiva] = useState('geral');

  const [plano, setPlano] = useState(empresa.plano || 'ESSENCIAL');
  const [uExtra, setUExtra] = useState(empresa.usuarios_adicionais || 0);
  const [vExtra, setVExtra] = useState(empresa.veiculos_adicionais || 0);
  const [modulosAtivos, setModulosAtivos] = useState(empresa.modulos || []);

  const config = PLANOS_CONFIG[plano];
  const mensalidadeCalculada = config.base + (uExtra * 25) + (vExtra * 30);

  // Faturas controladas por estado dinâmico
  const [faturas, setFaturas] = useState([
    { id: 'fat-1', mes: 'Jun', ano: 2026, tipo: 'IMPLEMENTACAO', valor: config.setup, status: 'pendente' },
    { id: 'fat-2', mes: 'Jun', ano: 2026, tipo: 'MENSALIDADE', valor: mensalidadeCalculada, status: 'pendente' }
  ]);

  // 1. Sincroniza módulos quando o plano muda
  useEffect(() => {
    if (plano !== 'PREVIEW') {
      setModulosAtivos(MODULOS_PADRAO[plano] || []);
    }
  }, [plano]);

  // 2. Recálculo automático de faturas que ainda estão pendentes
  useEffect(() => {
    setFaturas(prevFaturas => 
      prevFaturas.map(fatura => {
        if (fatura.status === 'pendente') {
          if (fatura.tipo === 'IMPLEMENTACAO') {
            return { ...fatura, valor: config.setup };
          }
          if (fatura.tipo === 'MENSALIDADE') {
            return { ...fatura, valor: mensalidadeCalculada };
          }
        }
        return fatura;
      })
    );
  }, [plano, uExtra, vExtra, mensalidadeCalculada, config.setup]);

  const toggleModulo = (mod) => {
    setModulosAtivos(prev => prev.includes(mod) ? prev.filter(m => m !== mod) : [...prev, mod]);
  };

  const handleEditValorFatura = (id, novoValor) => {
    setFaturas(prev => prev.map(f => f.id === id ? { ...f, valor: parseFloat(novoValor) || 0 } : f));
  };

  const Abas = [
    { id: 'geral', label: 'VISÃO GERAL', icon: <LayoutDashboard size={14}/> },
    { id: 'plano', label: 'MÓDULOS & PLANO', icon: <Layers size={14}/> },
    { id: 'usuarios', label: 'USUÁRIOS DA EMPRESA', icon: <Users size={14}/> },
    { id: 'veiculos', label: 'VEÍCULOS', icon: <Truck size={14}/> },
    { id: 'pagamentos', label: 'PAGAMENTOS', icon: <CreditCard size={14}/> },
  ];

  return (
    <div className="space-y-6">
      {/* HEADER DA EMPRESA */}
      <div className="flex justify-between items-start border-b pb-6" style={{borderColor: 'var(--border)'}}>
        <div className="flex gap-4">
          <div className="w-12 h-12 bg-primary/10 border flex items-center justify-center text-primary" style={{borderColor: primary}}>
            <Truck size={24} />
          </div>
          <div>
            <h2 className="text-3xl font-black font-rajdhani uppercase leading-none">{empresa.nome}</h2>
            <p className="text-xs opacity-50 font-mono mt-1">GESTÃO E FINANÇAS • {empresa.email}</p>
          </div>
        </div>
        <select className="bg-transparent border border-border text-[10px] p-2 font-black uppercase tracking-widest cursor-pointer outline-none hover:border-primary transition-colors" style={{ color: 'var(--foreground)', backgroundColor: 'var(--background)' }}>
          <option>ATIVO</option>
          <option>INADIMPLENTE</option>
          <option>INATIVO</option>
        </select>
      </div>

      {/* NAVEGAÇÃO ENTRE ABAS */}
      <div className="flex gap-1 border-b overflow-x-auto custom-scrollbar" style={{borderColor: 'var(--border)'}}>
        {Abas.map(aba => (
          <button key={aba.id} onClick={() => setTabAtiva(aba.id)} className="px-4 py-3 text-[10px] font-black tracking-widest flex items-center gap-2 transition-all relative whitespace-nowrap" style={{ color: tabAtiva === aba.id ? primary : 'var(--foreground-muted)' }}>
            {aba.icon} {aba.label}
            {tabAtiva === aba.id && <motion.div layoutId="tabLine" className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" style={{backgroundColor: primary}} />}
          </button>
        ))}
      </div>

      {/* CONTEÚDO DINÂMICO DAS ABAS */}
      <div className="py-4">
        {tabAtiva === 'geral' && (
           <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <StatCard label="VEÍCULOS" val={`8 / ${config.vBase + vExtra}`} sub="Frota atual" primary={primary}/>
              <StatCard label="MOTORISTAS" val="5" sub="Cadastrados" primary={primary}/>
              <StatCard label="MENSALIDADE" val={plano === 'PREVIEW' ? 'GRÁTIS' : `R$ ${mensalidadeCalculada.toFixed(2)}`} sub="Valor recorrente" primary={primary} className={plano === 'PREVIEW' ? 'text-blue-500' : ''} />
              <StatCard label="TOTAL PAGO" val={`R$ ${empresa.total_pago_historico || '0,00'}`} sub="Acumulado" primary={primary}/>
           </div>
        )}

        {tabAtiva === 'plano' && (
          <div className="border p-8 space-y-8" style={{borderColor: 'var(--border)', backgroundColor: 'var(--background-secondary)'}}>
             <section>
                <label className="text-[10px] font-black opacity-50 block mb-4 tracking-[0.3em]">PLANO BASE</label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                   {['PREVIEW', 'ESSENCIAL', 'AVANCADO', 'ENTERPRISE'].map(p => (
                      <button key={p} onClick={() => setPlano(p)} className={`p-4 border text-left transition-all ${plano === p ? 'bg-primary text-black' : 'opacity-40 hover:opacity-100'}`} style={{borderColor: plano === p ? primary : 'var(--border)'}}>
                        <p className="text-[10px] font-bold">PLANO</p>
                        <h4 className="font-black text-lg">{p}</h4>
                      </button>
                   ))}
                </div>
             </section>
             <section>
                <label className="text-[10px] font-black opacity-50 block mb-4 tracking-[0.3em]">MÓDULOS ATIVOS</label>
                <div className="space-y-2 max-w-md">
                   {TODOS_OS_MODULOS.map(mod => (
                      <div key={mod} onClick={() => toggleModulo(mod)} className={`flex justify-between p-3 border cursor-pointer transition-all ${modulosAtivos.includes(mod) ? 'border-primary bg-primary/5' : 'border-border'}`}>
                         <span className={`text-sm font-bold ${modulosAtivos.includes(mod) ? 'text-primary' : ''}`}>{mod}</span>
                         <input type="checkbox" checked={modulosAtivos.includes(mod)} readOnly className="accent-primary" />
                      </div>
                   ))}
                </div>
             </section>
          </div>
        )}

        {tabAtiva === 'usuarios' && (
          <div className="space-y-6">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <CounterCard label="LICENÇAS EXTRAS" desc={`Custo: R$ 25,00/cada`} val={uExtra} setVal={setUExtra} primary={primary} />
                <CounterCard label="VEÍCULOS EXTRAS" desc={`Custo: R$ 30,00/cada`} val={vExtra} setVal={setVExtra} primary={primary} />
             </div>
             <CompanyUsersManager empresa={empresa} limiteTotal={config.uBase + uExtra} primary={primary} />
          </div>
        )}

        {tabAtiva === 'veiculos' && (
          <CompanyVehiclesManager empresa={empresa} limiteTotal={config.vBase + vExtra} primary={primary} />
        )}

        {tabAtiva === 'pagamentos' && (
           <div className="space-y-6">
             <div className="border overflow-hidden" style={{borderColor: 'var(--border)'}}>
                <table className="w-full text-left border-collapse">
                   <thead className="bg-background-secondary border-b" style={{borderColor: 'var(--border)'}}>
                      <tr>{['REFERÊNCIA', 'TIPO', 'VALOR (R$)', 'STATUS', 'COMPROVANTE', 'AÇÃO'].map(h => <th key={h} className="px-5 py-3 text-[10px] font-black tracking-widest opacity-60">{h}</th>)}</tr>
                   </thead>
                   <tbody>
                      {faturas.map((f, i) => (
                         <tr key={f.id} className="border-b last:border-0 hover:bg-black/5 text-sm" style={{borderColor: 'var(--border)'}}>
                            <td className="px-5 py-4 font-mono font-bold">{f.mes} / {f.ano}</td>
                            <td className="px-5 py-4 text-[10px] font-black uppercase opacity-70">
                               {f.tipo === 'IMPLEMENTACAO' ? 'TAXA DE CONFIGURAÇÃO' : f.tipo}
                            </td>
                            
                            {/* VALOR EDITÁVEL SE TIVER PENDENTE */}
                            <td className="px-5 py-4 font-mono text-xs font-black">
                               {plano === 'PREVIEW' ? (
                                 <span className="text-blue-500 font-bold">GRÁTIS</span>
                               ) : f.status === 'pendente' ? (
                                 <div className="flex items-center gap-1 border border-border bg-background px-2 py-1 max-w-[130px]">
                                   <span className="opacity-40 text-[10px]">R$</span>
                                   <input 
                                     type="number" 
                                     value={f.valor} 
                                     onChange={(e) => handleEditValorFatura(f.id, e.target.value)}
                                     className="bg-transparent w-full font-bold outline-none text-xs"
                                   />
                                 </div>
                               ) : (
                                 `R$ ${Number(f.valor).toFixed(2)}`
                               )}
                            </td>

                            <td className="px-5 py-4">
                               <span className={`text-[9px] px-2 py-1 border font-black uppercase ${
                                  f.status === 'pago' ? 'text-green-500 border-green-500/20 bg-green-500/5' : 'text-red-500 border-red-500/20 bg-red-500/5 animate-pulse'
                                }`}>
                                  {f.status}
                               </span>
                            </td>

                            {/* COLUNA DE COMPROVANTE ATUALIZADA */}
                            <td className="px-5 py-4">
                               {f.status === 'pago' ? (
                                  <a 
                                    href="#ver-comprovante" 
                                    onClick={(e) => { e.preventDefault(); alert('Resgatando documento temporário no Supabase Storage...'); }}
                                    className="text-[10px] font-black tracking-wider text-primary border-b border-primary/30 hover:border-primary transition-colors uppercase"
                                  >
                                    📄 Ver Arquivo
                                  </a>
                               ) : (
                                  <label className="text-[10px] font-black opacity-40 hover:opacity-100 cursor-pointer transition-opacity uppercase flex items-center gap-1">
                                     📎 Anexar PDF
                                     <input type="file" accept="application/pdf,image/*" className="hidden" onChange={() => alert('Mock: Upload direcionado para o Bucket Supabase!')} />
                                  </label>
                               )}
                            </td>

                            <td className="px-5 py-4">
                               {f.status === 'pendente' ? (
                                 <button 
                                   onClick={() => setFaturas(faturas.map(fat => fat.id === f.id ? {...fat, status: 'pago'} : fat))} 
                                   className="px-3 py-1.5 text-[10px] font-black border hover:border-green-500 hover:text-green-500 transition-all"
                                   style={{ borderColor: 'var(--border)' }}
                                 >
                                   DAR BAIXA
                                 </button>
                               ) : (
                                 <span className="text-[10px] font-bold text-green-500/60 flex items-center gap-1">✓ CONFERIDO</span>
                               )}
                            </td>
                         </tr>
                      ))}
                   </tbody>
                </table>
             </div>
           </div>
        )}
      </div>

      {/* BOTÃO FIXO SALVAR */}
      <div className="flex justify-end pt-6 border-t mt-4" style={{borderColor: 'var(--border)'}}>
         <button className="bg-primary text-black px-8 py-3 font-black text-xs hover:scale-105 transition-transform" style={{backgroundColor: primary}}>SALVAR ALTERAÇÕES</button>
      </div>
    </div>
  );
}

function StatCard({ label, val, sub, primary, className = '' }) {
  return (
    <div className="p-5 border bg-background-secondary" style={{borderColor: 'var(--border)'}}>
      <p className="text-[9px] font-black opacity-50 tracking-widest mb-2">{label}</p>
      <h3 className={`text-2xl font-black font-rajdhani ${className}`}>{val}</h3>
      <p className="text-[10px] opacity-40 mt-1">{sub}</p>
    </div>
  );
}

function CounterCard({ label, desc, val, setVal, primary }) {
  return (
    <div className="p-6 border bg-background-secondary" style={{borderColor: 'var(--border)'}}>
      <h4 className="text-[10px] font-black mb-1">{label}</h4>
      <p className="text-[10px] opacity-40 mb-4">{desc}</p>
      <div className="flex items-center gap-4">
        <button onClick={() => setVal(Math.max(0, val - 1))} className="p-2 border" style={{borderColor: 'var(--border)'}}><Minus size={14}/></button>
        <span className="text-2xl font-black font-mono w-10 text-center">{val}</span>
        <button onClick={() => setVal(val + 1)} className="p-2 border" style={{borderColor: 'var(--border)'}}><Plus size={14}/></button>
      </div>
    </div>
  );
}
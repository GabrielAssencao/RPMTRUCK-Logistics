// src/app/admin/modules/dashboard/DashboardModule.jsx
'use client'
import { useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import DashboardStats from './DashboardStats';
import DashboardChart from './DashboardChart';
import { useAdminData } from '../../hooks/useAdminData';
import { useTheme } from '@/contexts/ThemeContext';

export default function DashboardModule() {
  const { primary } = useTheme();
  const { empresas, loading } = useAdminData();
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  
  if (loading) {
    return <div className="h-64 flex items-center justify-center font-bold animate-pulse tracking-widest">CARREGANDO ENGINE...</div>;
  }

  const listaEmpresas = Array.isArray(empresas) ? empresas : [];

  const inadimplentes = listaEmpresas.filter(c => c.status === 'inadimplente');
  const solicitacoes = listaEmpresas.filter(c => c.status === 'aguardando_aprovacao');
  const receitaTotal = listaEmpresas.reduce((acc, c) => acc + (c.mensalidade || 0), 0);

  const processarDadosGrafico = () => {
    const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const contagem = Array(12).fill(0);
    
    listaEmpresas.forEach(c => {
      if (c.criado_em) {
        const data = new Date(c.criado_em);
        if (data.getFullYear() === selectedYear) {
          const mes = data.getMonth();
          if (mes >= 0 && mes < 12) contagem[mes]++;
        }
      }
    });

    return meses.map((nome, i) => ({ mes: nome, total: contagem[i] }));
  };

  const distribuicaoPlanos = [
    { name: 'Essencial', value: listaEmpresas.filter(c => c.plano === 'ESSENCIAL').length || 1 },
    { name: 'Avançado', value: listaEmpresas.filter(c => c.plano === 'AVANCADO').length || 0 },
    { name: 'Enterprise', value: listaEmpresas.filter(c => c.plano === 'ENTERPRISE').length || 0 },
    { name: 'Preview', value: listaEmpresas.filter(c => c.plano === 'PREVIEW').length || 0 },
  ];

  const receitaMensal = [
    { mes: 'Jan', receita: 18000 },
    { mes: 'Fev', receita: 24000 },
    { mes: 'Mar', receita: 22000 },
    { mes: 'Abr', receita: 31000 },
    { mes: 'Mai', receita: 28000 },
    { mes: 'Jun', receita: 36000 },
  ];

  return (
    <div className="space-y-6 max-w-full overflow-hidden pb-10">
      <div>
        <p className="text-primary font-bold tracking-[0.3em] text-[10px] mb-1">VISÃO GERAL</p>
        <h1 className="text-3xl font-black" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
          PAINEL <span className="text-primary">ADMINISTRATIVO</span>
        </h1>
      </div>

      <DashboardStats empresas={listaEmpresas} solicitacoes={solicitacoes} receita={receitaTotal} />

      {inadimplentes.length > 0 && (
        <div className="border p-4 flex items-center gap-3 bg-red-500/10 border-red-500/30">
          <AlertCircle className="text-red-500" size={20} />
          <p className="text-sm font-bold text-red-500">
            {inadimplentes.length} empresa(s) inadimplente(s) — verifique a seção Empresas.
          </p>
        </div>
      )}

      <DashboardChart 
        data={processarDadosGrafico()} 
        selectedYear={selectedYear} 
        onYearChange={setSelectedYear} 
      />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="border rounded-2xl p-5" style={{ backgroundColor: 'var(--background-secondary)', borderColor: 'var(--border)' }}>
          <div className="flex items-center justify-between mb-5">
            <div>
              <p className="text-[10px] uppercase tracking-[0.22em] opacity-65">Receita</p>
              <h3 className="text-sm font-black tracking-widest mt-1">MENSAL</h3>
            </div>
            <div className="px-2.5 py-1.5 rounded-lg border" style={{ borderColor: 'var(--border)' }}>
              <span className="text-[10px] uppercase tracking-[0.18em] opacity-70">6M</span>
            </div>
          </div>

          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={receitaMensal} margin={{ top: 12, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="4 6" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="mes" stroke="var(--foreground-muted)" tickLine={false} axisLine={false} fontSize={11} />
                <YAxis stroke="var(--foreground-muted)" tickLine={false} axisLine={false} fontSize={11} />
                <Tooltip
                  formatter={(value) => [`R$ ${Number(value).toLocaleString('pt-BR')}`, 'Receita']}
                  contentStyle={{ backgroundColor: 'var(--background)', borderColor: 'var(--border)', borderRadius: '12px' }}
                />
                <Bar dataKey="receita" radius={[8, 8, 0, 0]} fill="var(--primary)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="border rounded-2xl p-5" style={{ backgroundColor: 'var(--background-secondary)', borderColor: 'var(--border)' }}>
          <div className="flex items-center justify-between mb-5">
            <div>
              <p className="text-[10px] uppercase tracking-[0.22em] opacity-65">Mix</p>
              <h3 className="text-sm font-black tracking-widest mt-1">PLANOS</h3>
            </div>
            <div className="px-2.5 py-1.5 rounded-lg border" style={{ borderColor: 'var(--border)' }}>
              <span className="text-[10px] uppercase tracking-[0.18em] opacity-70">Clientes</span>
            </div>
          </div>

          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={distribuicaoPlanos} dataKey="value" nameKey="name" innerRadius={52} outerRadius={80} paddingAngle={4} stroke="var(--background-secondary)" strokeWidth={3}>
                  {distribuicaoPlanos.map((entry, index) => (
                    <Cell
                      key={entry.name}
                      fill={['#6d7cff', '#22c55e', '#f59e0b', '#f87171'][index % 4]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) => [`${value} empresas`, 'Quantidade']}
                  contentStyle={{ backgroundColor: 'var(--background)', borderColor: 'var(--border)', borderRadius: '12px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 text-[10px] uppercase tracking-[0.12em]">
            {distribuicaoPlanos.map((item, index) => (
              <div key={item.name} className="flex items-center gap-2 opacity-80">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: ['#6d7cff', '#22c55e', '#f59e0b', '#f87171'][index % 4] }} />
                <span>{item.name}</span>
                <span className="ml-auto font-bold">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="border p-6 space-y-4" style={{ backgroundColor: 'var(--background-secondary)', borderColor: 'var(--border)' }}>
        <div>
          <p className="text-primary font-bold tracking-[0.3em] text-[10px] mb-1">MÓDULO DE ENTRADAS</p>
          <h3 className="text-xl font-black tracking-tight">ASSINATURAS RECENTES</h3>
        </div>

        <div className="w-full border overflow-y-auto max-h-72 custom-scrollbar" style={{ borderColor: 'var(--border)' }}>
          <table className="w-full text-left border-collapse relative">
            <thead className="sticky top-0 bg-[var(--background-secondary)] z-10 shadow-[0_1px_0_0_var(--border)]">
              <tr className="border-b" style={{ borderColor: 'var(--border)' }}>
                {['EMPRESA', 'PLANO', 'MENSALIDADE', 'STATUS FINANCEIRO'].map(h => (
                  <th key={h} className="px-4 py-3 text-[10px] font-black tracking-widest opacity-60 bg-[var(--background-secondary)]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {listaEmpresas.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-xs font-mono opacity-50">Nenhuma empresa mapeada na base de dados.</td>
                </tr>
              ) : (
                listaEmpresas.slice(0, 10).map((empresa, idx) => (
                  <motion.tr 
                    key={empresa.id || idx}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="border-b last:border-0 hover:bg-black/5 transition-colors text-sm font-bold"
                    style={{ borderColor: 'var(--border)' }}
                  >
                    <td className="px-4 py-4 uppercase tracking-wide">{empresa.nome}</td>
                    <td className="px-4 py-4">
                      <span className="text-[10px] font-mono px-2 py-0.5 border" style={{ color: primary, borderColor: `${primary}30`, backgroundColor: `${primary}08` }}>
                        {empresa.plano || 'PREVIEW'}
                      </span>
                    </td>
                    <td className="px-4 py-4 font-mono text-xs">
                      {empresa.plano === 'PREVIEW' ? 'GRÁTIS' : `R$ ${Number(empresa.mensalidade).toFixed(2)}`}
                    </td>
                    <td className="px-4 py-4">
                      {(() => {
                        if (empresa.plano === 'PREVIEW') {
                          return <span className="text-[10px] px-2 py-1 uppercase font-mono border font-black bg-blue-500/10 text-blue-400 border-blue-500/20 tracking-wider">✦ PREVIEW</span>;
                        }
                        if (empresa.status === 'aguardando_aprovacao') {
                          return <span className="text-[10px] px-2 py-1 uppercase font-mono border font-black bg-yellow-500/10 text-yellow-500 border-yellow-500/20 tracking-wider animate-pulse">⏳ AGUARDANDO</span>;
                        }
                        if (empresa.status === 'inadimplente' || !empresa.status_pago) {
                          return <span className="text-[10px] px-2 py-1 uppercase font-mono border font-black bg-red-500/10 text-red-500 border-red-500/20 tracking-wider">⚠️ INADIMPLENTE</span>;
                        }
                        return <span className="text-[10px] px-2 py-1 uppercase font-mono border font-black bg-green-500/10 text-green-500 border-green-500/20 tracking-wider">✓ PAGO</span>;
                      })()}
                    </td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
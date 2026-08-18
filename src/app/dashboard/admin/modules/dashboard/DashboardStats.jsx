// src/app/admin/modules/dashboard/DashboardStats.jsx
import { Building2, Truck, FileText, DollarSign } from 'lucide-react';
import { motion } from 'framer-motion';

export default function DashboardStats({ empresas, solicitacoes, receita }) {
  const ativas = empresas.filter(c => c.status === 'ativo').length;

  const stats = [
    {
      label: 'TOTAL EMPRESAS',
      value: empresas.length,
      icon: Building2,
      color: 'var(--primary)',
      bg: 'rgba(255, 255, 255, 0.02)',
    },
    {
      label: 'ATIVAS',
      value: ativas,
      icon: Truck,
      color: '#22c55e',
      bg: 'rgba(34, 197, 94, 0.12)',
    },
    {
      label: 'PENDENTES',
      value: solicitacoes.length,
      icon: FileText,
      color: '#f59e0b',
      bg: 'rgba(245, 158, 11, 0.12)',
    },
    {
      label: 'RECEITA TOTAL',
      value: `R$ ${receita.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      icon: DollarSign,
      color: '#38bdf8',
      bg: 'rgba(56, 189, 248, 0.12)',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {stats.map((s, i) => (
        <motion.div
          key={s.label}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.08 }}
          className="border p-5 rounded-xl"
          style={{
            backgroundColor: 'var(--background-secondary)',
            borderColor: 'var(--border)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
          }}
        >
          <div className="flex items-center justify-between mb-4">
            <span className="text-[10px] font-bold tracking-[0.22em] opacity-60">{s.label}</span>
            <div className="p-2 rounded-lg" style={{ backgroundColor: s.bg }}>
              <s.icon size={16} style={{ color: s.color }} />
            </div>
          </div>
          <div className="font-black text-xl tracking-tight" style={{ color: 'var(--foreground)' }}>
            {s.value}
          </div>
        </motion.div>
      ))}
    </div>
  );
}
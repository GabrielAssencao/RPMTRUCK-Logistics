// src/app/admin/modules/companies/AdminCompanyDetail.jsx
'use client'
import { useState, useEffect } from 'react';
import { ArrowLeft, Truck, Users, DollarSign, Settings, CheckCircle } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';

export default function AdminCompanyDetail({ id, onBack }) {
  const { primary } = useTheme();
  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('overview');

  useEffect(() => {
    fetch(`/api/empresas/${id}`)
      .then(res => res.json())
      .then(data => { setCompany(data); setLoading(false); });
  }, [id]);

  if (loading) return <div className="p-10 text-center animate-pulse">CARREGANDO...</div>;

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-start gap-4">
        <button onClick={onBack} className="mt-1 opacity-60 hover:opacity-100"><ArrowLeft size={20} /></button>
        <div>
          <p className="text-[10px] font-bold tracking-[0.3em] opacity-50">EMPRESA</p>
          <h2 className="text-2xl font-black uppercase">{company.nome}</h2>
          <p className="text-sm opacity-60">{company.email} • {company.telefone}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-6 border-b" style={{ borderColor: 'var(--border)' }}>
        {['overview', 'modulos', 'veiculos', 'financeiro'].map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`pb-3 text-xs font-bold tracking-widest uppercase border-b-2 ${tab === t ? 'border-primary' : 'border-transparent opacity-50'}`}>
            {t === 'overview' ? 'Visão Geral' : t === 'modulos' ? 'Planos & Módulos' : t}
          </button>
        ))}
      </div>

      {/* Aba Visão Geral */}
      {tab === 'overview' && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Veículos" value={company.veiculos?.length || 0} icon={Truck} />
          <StatCard label="Motoristas" value={company.motoristas?.length || 0} icon={Users} />
          <StatCard label="Status" value={company.status.replace('_', ' ')} icon={CheckCircle} />
          <StatCard label="Plano" value={company.plano.toUpperCase()} icon={Settings} />
        </div>
      )}

      {/* Aba Módulos */}
      {tab === 'modulos' && (
        <div className="border p-6" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background-secondary)' }}>
          <h3 className="font-bold text-sm mb-4">MÓDULOS HABILITADOS</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {['frota', 'controle_gestao', 'relatorios'].map(m => (
              <div key={m} className="flex items-center gap-3 p-3 border" style={{ borderColor: 'var(--border)' }}>
                <input type="checkbox" checked={company.modulos.includes(m)} className="accent-primary" readOnly />
                <span className="capitalize text-sm font-bold">{m.replace('_', ' ')}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, icon: Icon }) {
  return (
    <div className="border p-5" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background-secondary)' }}>
      <div className="flex justify-between items-center mb-2">
        <span className="text-[10px] font-bold opacity-50">{label}</span>
        <Icon size={16} className="text-primary" />
      </div>
      <div className="font-black text-xl">{value}</div>
    </div>
  );
}
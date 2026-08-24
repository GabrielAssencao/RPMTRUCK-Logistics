// src/app/admin/modules/companies/AdminCompanyUsers.jsx
'use client'
import { useState, useEffect } from 'react';
import { Users, ShieldCheck, Eye, Trash2 } from 'lucide-react';
import { motion } from 'framer-motion';

// Ajuste os limites conforme sua regra de negócio
const LIMITES_PLANOS = { basico: 5, profissional: 10, premium: 25 };

export default function AdminCompanyUsers({ company, onUpdateCompany }) {
  const [usuariosEmpresa, setUsuariosEmpresa] = useState([]);
  const [extras, setExtras] = useState({ usuarios: company?.extra_user_limit || 0, veiculos: company?.extra_vehicle_limit || 0 });
  const [salvando, setSalvando] = useState(false);

  const limiteBase = LIMITES_PLANOS[company?.plano?.toLowerCase()] || 5;
  const limiteTotal = limiteBase + (company?.extra_user_limit || 0);

  const loadUsuarios = async () => {
    if (!company?.id) return;
    // Aqui você fará um fetch para buscar usuários vinculados a esta empresa
    const res = await fetch(`/api/empresas/${company.id}/usuarios`);
    const data = await res.json();
    setUsuariosEmpresa(data);
  };

  useEffect(() => { queueMicrotask(() => void loadUsuarios()); }, [company?.id]);

  const handleSalvarLimites = async () => {
    setSalvando(true);
    await onUpdateCompany({
      extra_user_limit: parseInt(extras.usuarios) || 0,
      extra_vehicle_limit: parseInt(extras.veiculos) || 0,
    });
    setSalvando(false);
  };

  const handleToggleStatus = async (usuario) => {
    const novoStatus = usuario.status === 'ativo' ? 'inativo' : 'ativo';
    await fetch(`/api/usuarios/${usuario.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: novoStatus })
    });
    loadUsuarios();
  };

  return (
    <div className="space-y-6">
      {/* Configuração de Limites */}
      <div className="border p-6" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background-secondary)' }}>
        <h3 className="font-black text-sm tracking-widest mb-4">LIMITES DO PLANO — {company?.plano?.toUpperCase()}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-5">
          {/* Card Usuários */}
          <div className="p-4 border" style={{ borderColor: 'var(--border)' }}>
            <p className="text-[10px] font-bold opacity-50 mb-1">USUÁRIOS</p>
            <div className="flex items-end gap-3 mb-3">
              <div>
                <span className="text-2xl font-black text-primary">{usuariosEmpresa.length}</span>
                <span className="text-sm opacity-60"> / {limiteTotal}</span>
              </div>
            </div>
            <label className="text-[10px] font-bold opacity-50 block mb-1.5">USUÁRIOS EXTRAS</label>
            <input type="number" value={extras.usuarios} onChange={e => setExtras({...extras, usuarios: e.target.value})}
              className="w-full bg-transparent border p-2 text-sm focus:border-primary outline-none" style={{ borderColor: 'var(--border)' }} />
          </div>
        </div>
        <button onClick={handleSalvarLimites} disabled={salvando}
          className="px-6 py-2.5 font-bold text-xs" style={{ backgroundColor: 'var(--primary)', color: '#000' }}>
          {salvando ? 'SALVANDO...' : 'SALVAR LIMITES'}
        </button>
      </div>

      {/* Lista de Usuários */}
      <div className="space-y-3">
        <h3 className="font-bold text-sm tracking-widest uppercase">
          Usuários ({usuariosEmpresa.length}/{limiteTotal})
        </h3>
        {usuariosEmpresa.map((u, i) => (
          <motion.div key={u.id} className="border p-4 flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
            <div className="flex items-center gap-4">
              <div className="w-9 h-9 flex items-center justify-center bg-primary/10">
                {u.cargo === 'GESTOR_EMPRESA' ? <ShieldCheck size={16} /> : <Users size={16} />}
              </div>
              <div>
                <p className="font-bold text-sm">{u.nome}</p>
                <p className="text-xs opacity-60">{u.email}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => handleToggleStatus(u)} className="px-3 py-1.5 border text-[10px] font-bold" style={{ borderColor: 'var(--border)' }}>
                {u.status === 'ativo' ? 'DESATIVAR' : 'ATIVAR'}
              </button>
              <button className="p-2 text-red-500 hover:bg-red-500/10"><Trash2 size={16} /></button>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

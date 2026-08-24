'use client'
import { useEffect, useState } from 'react';
import { UserPlus, Shield, Edit, Trash2, X, Check, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function CompanyUsersManager({ empresa, limiteTotal, primary }) {
  const [usuarios, setUsuarios] = useState([]);
  const [feedback, setFeedback] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  
  // Estado do Formulário
  const [formData, setFormData] = useState({ nome: '', email: '', cargo: 'OPERADOR', status: 'ativo', senha: '' });

  useEffect(() => {
    fetch(`/api/empresas/${empresa.id}/usuarios`, { cache: 'no-store' }).then(async response => { const data = await response.json(); if (!response.ok) throw new Error(data.erro); setUsuarios(data.map(usuario => ({ ...usuario, cargo: usuario.role, status: 'ativo' }))); }).catch(error => setFeedback(error.message || 'Falha ao carregar usuários.'));
  }, [empresa.id]);

  const vagasDisponiveis = limiteTotal - usuarios.length;
  const limiteExcedido = vagasDisponiveis <= 0;

  const handleOpenModal = (user = null) => {
    if (user) {
      setEditingUser(user);
      setFormData({ nome: user.nome, email: user.email, cargo: user.cargo, status: user.status, senha: '' });
    } else {
      if (limiteExcedido) return; // Trava de segurança
      setEditingUser(null);
      setFormData({ nome: '', email: '', cargo: 'OPERADOR', status: 'ativo', senha: '' });
    }
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    setFeedback('');
    if (editingUser) {
      const response = await fetch(`/api/usuarios/${editingUser.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nome: formData.nome, email: formData.email, role: formData.cargo }) });
      const data = await response.json(); if (!response.ok) return setFeedback(data.erro || 'Falha ao atualizar usuário.');
      setUsuarios(usuarios.map(u => u.id === editingUser.id ? { ...u, ...data, cargo: data.role } : u));
    } else {
      const response = await fetch(`/api/empresas/${empresa.id}/usuarios`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nome: formData.nome, email: formData.email, senha: formData.senha, role: formData.cargo }) });
      const data = await response.json(); if (!response.ok) return setFeedback(data.erro || 'Falha ao criar usuário.');
      setUsuarios([...usuarios, { ...data, cargo: data.role, status: 'ativo' }]);
    }
    setFeedback('Usuário salvo com sucesso.');
    setIsModalOpen(false);
  };

  const handleDelete = async (id) => {
    if(confirm('Tem certeza que deseja excluir este usuário permanentemente?')) {
      const response = await fetch(`/api/usuarios/${id}`, { method: 'DELETE' });
      const data = await response.json(); if (!response.ok) return setFeedback(data.erro || 'Falha ao excluir usuário.');
      setUsuarios(usuarios.filter(u => u.id !== id));
    }
  };

  return (
    <div className="space-y-6">
      {feedback && <div role="status" className="border p-3 text-xs" style={{ borderColor: primary, color: primary }}>{feedback}</div>}
      
      {/* HEADER DO GERENCIADOR E TRAVA DE LIMITES */}
      <div className="flex items-center justify-between p-4 border bg-background-secondary" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 flex items-center justify-center border bg-black/5" style={{ borderColor: 'var(--border)', color: primary }}>
            <Shield size={20} />
          </div>
          <div>
            <h3 className="font-black tracking-widest text-sm uppercase">Controle de Acessos</h3>
            <p className="text-[10px] font-mono opacity-50 uppercase tracking-widest mt-0.5">
              USO: {usuarios.length} DE {limiteTotal} LICENÇAS
            </p>
          </div>
        </div>
        
        <button 
          onClick={() => handleOpenModal()}
          disabled={limiteExcedido}
          className="flex items-center gap-2 px-4 py-2 text-[10px] font-black tracking-widest transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          style={{ 
            backgroundColor: primary, 
            color: '#000',
            clipPath: 'polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 6px 100%, 0 calc(100% - 6px))'
          }}
        >
          <UserPlus size={14} /> 
          {limiteExcedido ? 'LIMITE ATINGIDO' : 'NOVO USUÁRIO'}
        </button>
      </div>

      {/* TABELA DE USUÁRIOS */}
      <div className="border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
        <table className="w-full text-left border-collapse">
          <thead className="bg-background-secondary border-b" style={{ borderColor: 'var(--border)' }}>
            <tr>
              {['COLABORADOR', 'NÍVEL DE ACESSO', 'STATUS', 'AÇÕES'].map(h => (
                <th key={h} className="px-5 py-3 text-[10px] font-black tracking-widest opacity-60">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {usuarios.map((u, i) => (
              <motion.tr 
                initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                key={u.id} className="border-b last:border-0 hover:bg-black/5 transition-colors text-sm" style={{ borderColor: 'var(--border)' }}
              >
                <td className="px-5 py-4">
                  <div className="font-bold tracking-wide uppercase" style={{ fontFamily: 'Rajdhani, sans-serif' }}>{u.nome}</div>
                  <div className="text-[10px] opacity-50 font-mono">{u.email}</div>
                </td>
                <td className="px-5 py-4">
                  <span className="text-[9px] font-mono px-2 py-1 border font-black tracking-widest" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background-secondary)' }}>
                    {u.cargo.replace('_', ' ')}
                  </span>
                </td>
                <td className="px-5 py-4">
                  <span className={`text-[9px] font-mono px-2 py-1 border font-black tracking-widest uppercase ${
                    u.status === 'ativo' ? 'bg-green-500/10 text-green-500 border-green-500/30' : 'bg-red-500/10 text-red-500 border-red-500/30'
                  }`}>
                    {u.status}
                  </span>
                </td>
                <td className="px-5 py-4">
                  <div className="flex gap-2">
                    <button onClick={() => handleOpenModal(u)} className="p-1.5 border opacity-60 hover:opacity-100 hover:text-primary transition-all" style={{ borderColor: 'var(--border)' }} title="Editar Perfil">
                      <Edit size={14} />
                    </button>
                    <button onClick={() => handleDelete(u.id)} className="p-1.5 border opacity-60 hover:opacity-100 hover:text-red-500 transition-all" style={{ borderColor: 'var(--border)' }} title="Revogar Acesso">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* MODAL DE EDIÇÃO/CRIAÇÃO DE PERFIL */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md border bg-background flex flex-col shadow-2xl"
              style={{ borderColor: primary }}
            >
              {/* Modal Header */}
              <div className="flex justify-between items-center p-4 border-b bg-background-secondary" style={{ borderColor: 'var(--border)' }}>
                <h3 className="font-black tracking-widest text-sm uppercase" style={{ color: primary }}>
                  {editingUser ? 'Atualizar Credencial' : 'Novo Colaborador'}
                </h3>
                <button onClick={() => setIsModalOpen(false)} className="opacity-50 hover:opacity-100"><X size={16} /></button>
              </div>

              {/* Modal Body */}
              <div className="p-6 space-y-4">
                <InputGroup label="NOME COMPLETO" val={formData.nome} onChange={e => setFormData({...formData, nome: e.target.value})} primary={primary} />
                <InputGroup label="E-MAIL CORPORATIVO" val={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} primary={primary} />
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[9px] font-black opacity-50 block mb-1 tracking-widest uppercase">Nível de Acesso</label>
                    <select 
                      value={formData.cargo} onChange={e => setFormData({...formData, cargo: e.target.value})}
                      className="w-full bg-background border p-2.5 text-xs font-bold outline-none uppercase font-mono tracking-wider"
                      style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
                    >
                      <option value="GESTOR_EMPRESA">Gestor (Total)</option>
                      <option value="OPERADOR">Operador</option>
                      <option value="VISUALIZADOR">Visualizador</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[9px] font-black opacity-50 block mb-1 tracking-widest uppercase">Situação</label>
                    <select 
                      value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})}
                      className="w-full bg-background border p-2.5 text-xs font-bold outline-none uppercase font-mono tracking-wider"
                      style={{ borderColor: 'var(--border)', color: formData.status === 'ativo' ? '#22c55e' : '#ef4444' }}
                    >
                      <option value="ativo">ATIVO</option>
                      <option value="inativo">INATIVO</option>
                    </select>
                  </div>
                </div>

                {!editingUser && (
                  <div className="pt-2">
                    <div className="p-3 border text-[10px] flex gap-2 font-mono" style={{ borderColor: `${primary}30`, backgroundColor: `${primary}05`, color: primary }}>
                      <AlertTriangle size={14} className="shrink-0" />
                      A senha padrão gerada será “RPM-123456”. O usuário será forçado a alterar no primeiro login.
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-4 border-t flex justify-end gap-3 bg-background-secondary" style={{ borderColor: 'var(--border)' }}>
                <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-[10px] font-black tracking-widest opacity-60 hover:opacity-100">CANCELAR</button>
                <button 
                  onClick={handleSave} 
                  disabled={!formData.nome || !formData.email}
                  className="px-6 py-2 text-[10px] font-black tracking-widest flex items-center gap-2 disabled:opacity-40"
                  style={{ backgroundColor: primary, color: '#000', clipPath: 'polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 6px 100%, 0 calc(100% - 6px))' }}
                >
                  <Check size={14} /> SALVAR PERFIL
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}

function InputGroup({ label, val, onChange, primary }) {
  return (
    <div>
      <label className="text-[9px] font-black opacity-50 block mb-1 tracking-widest uppercase">{label}</label>
      <input 
        type="text" value={val} onChange={onChange} 
        className="w-full bg-background border p-2.5 text-sm outline-none transition-colors font-mono"
        style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
        onFocus={e => e.target.style.borderColor = primary}
        onBlur={e => e.target.style.borderColor = 'var(--border)'}
      />
    </div>
  );
}

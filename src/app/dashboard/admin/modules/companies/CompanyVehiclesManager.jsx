// src/app/admin/modules/companies/CompanyVehiclesManager.jsx
'use client'
import { useState } from 'react';
import { Truck, Plus, Trash2, AlertCircle, X, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function CompanyVehiclesManager({ empresa, limiteTotal, primary }) {
  // Simulação de veículos (No futuro vira um fetch da API conectada ao Prisma)
  const [veiculos, setVeiculos] = useState([
    { id: 'v1', modelo: 'Scania R450', placa: 'ABC-1234', tipo: 'Cavalo Mecânico' },
    { id: 'v2', modelo: 'Volvo FH 540', placa: 'XYZ-9876', tipo: 'Bitrem' },
  ]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({ modelo: '', placa: '', tipo: 'Cavalo Mecânico' });

  const vagasDisponiveis = limiteTotal - veiculos.length;

  const handleOpenModal = () => {
    if (vagasDisponiveis <= 0) return; // Trava de segurança no front
    setFormData({ modelo: '', placa: '', tipo: 'Cavalo Mecânico' });
    setIsModalOpen(true);
  };

  const handleSave = () => {
    if (!formData.modelo || !formData.placa) return;

    const novoVeiculo = {
      id: `v-${Math.random().toString(36).substr(2, 9)}`,
      ...formData,
      placa: formData.placa.toUpperCase()
    };

    setVeiculos([...veiculos, novoVeiculo]);
    setIsModalOpen(false);
  };

  const handleDelete = (id, modelo) => {
    if (confirm(`Remover o veículo ${modelo} permanentemente da frota desta empresa?`)) {
      setVeiculos(veiculos.filter(v => v.id !== id));
    }
  };

  return (
    <div className="space-y-4">
      {/* HEADER DO GERENCIADOR DE FROTA */}
      <div className="flex items-center justify-between p-4 border bg-background-secondary" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 flex items-center justify-center border bg-black/5" style={{ borderColor: 'var(--border)', color: primary }}>
            <Truck size={20} />
          </div>
          <div>
            <h3 className="font-black tracking-widest text-sm uppercase">Frota Vinculada</h3>
            <p className="text-[10px] font-mono opacity-50 uppercase tracking-widest mt-0.5">
              CAPACIDADE: {veiculos.length} / {limiteTotal} VEÍCULOS
            </p>
          </div>
        </div>
        <button 
          onClick={handleOpenModal}
          disabled={vagasDisponiveis <= 0}
          className="flex items-center gap-2 px-4 py-2 text-[10px] font-black tracking-widest transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          style={{ 
            backgroundColor: primary, 
            color: '#000', 
            clipPath: 'polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 6px 100%, 0 calc(100% - 6px))' 
          }}
        >
          <Plus size={14} /> ADICIONAR VEÍCULO
        </button>
      </div>

      {/* TABELA DE VEÍCULOS */}
      <div className="border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
        <table className="w-full text-left border-collapse">
          <thead className="bg-background-secondary border-b" style={{ borderColor: 'var(--border)' }}>
            <tr>
              {['VEÍCULO / MODELO', 'PLACA', 'TIPO DE COMPOSIÇÃO', 'AÇÕES'].map(h => (
                <th key={h} className="px-5 py-3 text-[10px] font-black tracking-widest opacity-60">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {veiculos.length === 0 ? (
              <tr>
                <td colSpan={4} className="p-8 text-center text-xs font-mono opacity-40">Nenhum veículo cadastrado na frota ativa desta empresa.</td>
              </tr>
            ) : (
              veiculos.map((v, i) => (
                <motion.tr 
                  key={v.id}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="border-b last:border-0 hover:bg-black/5 text-sm font-bold" 
                  style={{ borderColor: 'var(--border)' }}
                >
                  <td className="px-5 py-4 uppercase tracking-wide" style={{ fontFamily: 'Rajdhani, sans-serif' }}>{v.modelo}</td>
                  <td className="px-5 py-4 font-mono text-xs text-primary" style={{ color: primary }}>{v.placa}</td>
                  <td className="px-5 py-4 text-xs opacity-70 uppercase font-mono">{v.tipo}</td>
                  <td className="px-5 py-4">
                    <button 
                      onClick={() => handleDelete(v.id, v.modelo)}
                      className="p-2 border opacity-50 hover:opacity-100 hover:text-red-500 transition-all bg-background-secondary" 
                      style={{ borderColor: 'var(--border)' }}
                    >
                      <Trash2 size={14}/>
                    </button>
                  </td>
                </motion.tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      
      {vagasDisponiveis <= 0 && (
         <div className="p-3 border border-red-500/20 bg-red-500/5 flex items-center gap-2 text-red-500 text-[10px] font-black uppercase tracking-widest font-mono">
            <AlertCircle size={14} /> Atingiu o limite de frota contratado. Atualize as cotas ou o plano para expandir.
         </div>
      )}

      {/* MODAL DE CADASTRO DE VEÍCULO */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} 
              animate={{ opacity: 1, scale: 1 }} 
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md border bg-background flex flex-col shadow-2xl"
              style={{ borderColor: primary }}
            >
              {/* Header */}
              <div className="flex justify-between items-center p-4 border-b bg-background-secondary" style={{ borderColor: 'var(--border)' }}>
                <h3 className="font-black tracking-widest text-sm uppercase" style={{ color: primary }}>
                  Inserir Ativo na Frota
                </h3>
                <button onClick={() => setIsModalOpen(false)} className="opacity-50 hover:opacity-100"><X size={16} /></button>
              </div>

              {/* Body */}
              <div className="p-6 space-y-4">
                <InputField label="Modelo / Marca" placeholder="Ex: Scania R450 ou Mercedes Axor" val={formData.modelo} onChange={e => setFormData({...formData, modelo: e.target.value})} primary={primary} />
                <InputField label="Placa do Veículo" placeholder="Ex: BRA2E19 ou ABC-1234" val={formData.placa} onChange={e => setFormData({...formData, placa: e.target.value})} primary={primary} />
                
                <div>
                  <label className="text-[9px] font-black opacity-50 block mb-1 tracking-widest uppercase font-mono">Tipo de Veículo</label>
                  <select 
                    value={formData.tipo} 
                    onChange={e => setFormData({...formData, tipo: e.target.value})}
                    className="w-full bg-background border p-2.5 text-xs font-bold outline-none uppercase font-mono tracking-wider"
                    style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
                  >
                    <option value="Cavalo Mecânico">Cavalo Mecânico</option>
                    <option value="Bitrem">Bitrem</option>
                    <option value="Rodotrem">Rodotrem</option>
                    <option value="Caminhão Toco">Caminhão Toco</option>
                    <option value="Caminhão Truck">Caminhão Truck</option>
                    <option value="Sider">Sider / Baú</option>
                  </select>
                </div>
              </div>

              {/* Footer */}
              <div className="p-4 border-t flex justify-end gap-3 bg-background-secondary" style={{ borderColor: 'var(--border)' }}>
                <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-[10px] font-black tracking-widest opacity-60 hover:opacity-100">CANCELAR</button>
                <button 
                  onClick={handleSave} 
                  disabled={!formData.modelo || !formData.placa}
                  className="px-6 py-2 text-[10px] font-black tracking-widest flex items-center gap-2 disabled:opacity-40"
                  style={{ backgroundColor: primary, color: '#000', clipPath: 'polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 6px 100%, 0 calc(100% - 6px))' }}
                >
                  <Check size={14} /> VINCULAR ATIVO
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function InputField({ label, placeholder, val, onChange, primary }) {
  return (
    <div>
      <label className="text-[9px] font-black opacity-50 block mb-1 tracking-widest uppercase font-mono">{label}</label>
      <input 
        type="text" 
        placeholder={placeholder}
        value={val} 
        onChange={onChange} 
        className="w-full bg-background border p-2.5 text-sm outline-none transition-colors uppercase font-mono placeholder:lowercase placeholder:text-xs placeholder:opacity-30"
        style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
        onFocus={e => e.target.style.borderColor = primary}
        onBlur={e => e.target.style.borderColor = 'var(--border)'}
      />
    </div>
  );
}
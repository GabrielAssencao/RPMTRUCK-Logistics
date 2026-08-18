// src/app/admin/modules/companies/CompanyForm.jsx
'use client'
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Save, X, Building2, CheckCircle } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';

const MODULES = [
  { value: 'frota', label: 'Frota' },
  { value: 'controle_gestao', label: 'Controle & Gestão' },
  { value: 'relatorios', label: 'Relatórios' }
];

const EMPTY_FORM = {
  nome: '',
  nome_contato: '',
  email: '',
  telefone: '',
  plano: 'PREVIEW',
  status: 'aguardando_aprovacao',
  modulos: ['frota'],
  cnpj: '',
  notas: ''
};

export default function CompanyForm({ onClose, onRefresh }) {
  const { primary } = useTheme();
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const handleChange = (key, value) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const toggleModule = (mod) => {
    setForm(prev => ({
      ...prev,
      modulos: prev.modulos.includes(mod) 
        ? prev.modulos.filter(m => m !== mod) 
        : [...prev.modulos, mod]
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      const res = await fetch('/api/empresas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });

      if (res.ok) {
        alert('Empresa cadastrada com sucesso!');
        onRefresh(); // Atualiza a lista de empresas
        onClose();   // Fecha o formulário
      } else {
        const error = await res.json();
        alert(`Erro: ${error.erro}`);
      }
    } catch (err) {
      alert('Erro ao conectar com o servidor.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: -10 }} 
      animate={{ opacity: 1, y: 0 }}
      className="border p-8 space-y-8" 
      style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background-secondary)' }}
    >
      <div className="flex items-center justify-between border-b pb-4" style={{ borderColor: 'var(--border)' }}>
        <h3 className="font-black text-lg tracking-widest" style={{ fontFamily: 'Rajdhani' }}>CADASTRAR NOVA EMPRESA</h3>
        <button onClick={onClose} className="opacity-50 hover:opacity-100 transition-opacity">
          <X size={20} />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Grid de Inputs Principais */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <InputGroup label="NOME DA EMPRESA" value={form.nome} onChange={v => handleChange('nome', v)} required />
          <InputGroup label="CNPJ" value={form.cnpj} onChange={v => handleChange('cnpj', v)} placeholder="00.000.000/0001-00" />
          <InputGroup label="EMAIL" type="email" value={form.email} onChange={v => handleChange('email', v)} required />
          <InputGroup label="RESPONSÁVEL" value={form.nome_contato} onChange={v => handleChange('nome_contato', v)} />
          <InputGroup label="TELEFONE" value={form.telefone} onChange={v => handleChange('telefone', v)} />
          
          <div>
            <label className="text-[10px] font-bold tracking-widest opacity-50 mb-2 block">PLANO</label>
            <select 
              value={form.plano} 
              onChange={e => handleChange('plano', e.target.value)}
              className="w-full bg-transparent border p-2.5 text-sm outline-none focus:border-primary"
              style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
            >
              <option value="PREVIEW">PREVIEW</option>
              <option value="PROFISSIONAL">PROFISSIONAL</option>
              <option value="PREMIUM">PREMIUM</option>
            </select>
          </div>
        </div>

        {/* Módulos Habilitados */}
        <div>
          <label className="text-[10px] font-bold tracking-widest opacity-50 mb-4 block">MÓDULOS HABILITADOS</label>
          <div className="flex gap-6 flex-wrap">
            {MODULES.map(m => {
              const isActive = form.modulos.includes(m.value);
              return (
                <label key={m.value} className="flex items-center gap-2 cursor-pointer group">
                  <div 
                    onClick={() => toggleModule(m.value)}
                    className="w-5 h-5 border flex items-center justify-center transition-all"
                    style={{ 
                      borderColor: isActive ? primary : 'var(--border)',
                      backgroundColor: isActive ? primary : 'transparent'
                    }}
                  >
                    {isActive && <CheckCircle size={14} color="#000" />}
                  </div>
                  <span className={`text-xs font-bold transition-opacity ${isActive ? 'opacity-100' : 'opacity-40'}`}>
                    {m.label.toUpperCase()}
                  </span>
                </label>
              );
            })}
          </div>
        </div>

        {/* Notas */}
        <div>
          <label className="text-[10px] font-bold tracking-widest opacity-50 mb-2 block">OBSERVAÇÕES INTERNAS</label>
          <textarea 
            rows={3}
            value={form.notas}
            onChange={e => handleChange('notas', e.target.value)}
            className="w-full bg-transparent border p-3 text-sm outline-none focus:border-primary resize-none"
            style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
          />
        </div>

        {/* Botões de Ação */}
        <div className="flex gap-4 pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
          <button 
            type="submit" 
            disabled={saving}
            className="flex items-center gap-2 px-8 py-3 text-xs font-bold tracking-widest transition-transform hover:scale-105 disabled:opacity-50"
            style={{ backgroundColor: primary, color: '#000' }}
          >
            {saving ? 'SALVANDO...' : <><Save size={16} /> FINALIZAR CADASTRO</>}
          </button>
          <button 
            type="button" 
            onClick={onClose}
            className="px-8 py-3 text-xs font-bold tracking-widest border transition-opacity hover:opacity-70"
            style={{ borderColor: 'var(--border)' }}
          >
            CANCELAR
          </button>
        </div>
      </form>
    </motion.div>
  );
}

// Componente de Input Auxiliar para manter o código limpo
function InputGroup({ label, value, onChange, type = "text", required = false, placeholder = "" }) {
  return (
    <div>
      <label className="text-[10px] font-bold tracking-widest opacity-50 mb-2 block">{label}</label>
      <input 
        type={type} 
        value={value} 
        onChange={e => onChange(e.target.value)} 
        required={required}
        placeholder={placeholder}
        className="w-full bg-transparent border p-2.5 text-sm outline-none focus:border-primary transition-colors placeholder:opacity-20"
        style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
      />
    </div>
  );
}
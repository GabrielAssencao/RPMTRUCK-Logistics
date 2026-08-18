'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTheme } from '@/contexts/ThemeContext'
import { 
  UserSquare2, 
  UserPlus, 
  ShieldCheck, 
  Trash2, 
  Lock,
  Search,
  CheckCircle2,
  Eye,
  User,
  Loader2
} from 'lucide-react'
import GenericDrawer, { FieldConfig } from '@/components/dashboard/GenericDrawer'

interface UsuarioLocal {
  id: string
  nome: string
  email: string
  role: 'GESTOR_EMPRESA' | 'OPERADOR' | 'VISUALIZADOR'
  status: 'ATIVO' | 'INATIVO'
  criadoEm: string
}

const CAMPOS_USUARIO: FieldConfig[] = [
  { 
    name: 'nome', 
    label: 'Nome Completo do Operador', 
    type: 'text', 
    placeholder: 'Ex: João da Silva', 
    required: true 
  },
  { 
    name: 'email', 
    label: 'E-mail Corporativo', 
    type: 'text', 
    placeholder: 'exemplo@transportadora.com', 
    required: true 
  },
  { 
    name: 'senha', 
    label: 'Senha Inicial de Acesso', 
    type: 'text', 
    placeholder: 'Mínimo de 6 caracteres', 
    required: true 
  },
  { 
    name: 'role', 
    label: 'Nível de Permissão / Cargo', 
    type: 'select', 
    required: true,
    options: [
      { label: 'OPERADOR (Lança Frota, Motoristas e Custos)', value: 'OPERADOR' },
      { label: 'VISUALIZADOR (Apenas Leitura / Relatórios)', value: 'VISUALIZADOR' }
    ]
  }
]

export default function UsuariosPage() {
  const { primary } = useTheme()
  const [montado, setMontado] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [busca, setBusca] = useState('')
  const [loading, setLoading] = useState(true)

  const [usuarios, setUsuarios] = useState<UsuarioLocal[]>([])
  
  // TODO: No futuro, este estado virá do contexto de Autenticação/Sessão real
  const [perfilLogado] = useState<'GESTOR_EMPRESA' | 'OPERADOR'>('GESTOR_EMPRESA')

  // Carrega os usuários salvos no Supabase ao carregar a página
  useEffect(() => {
    setMontado(true)
    carregarUsuarios()
  }, [])

  const carregarUsuarios = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/empresa/usuarios')
      if (res.ok) {
        const data = await res.json()
        const formatados = data.map((u: any) => ({
          id: u.id,
          nome: u.nome,
          email: u.email,
          role: u.role,
          status: 'ATIVO',
          criadoEm: new Date(u.criado_em).toISOString().split('T')[0]
        }))
        setUsuarios(formatados)
      }
    } catch (err) {
      console.error('Erro ao carregar usuários:', err)
    } finally {
      setLoading(false)
    }
  }

  if (!montado) return null

  // 🛡️ Regra de Proteção Front-end
  const eGestor = perfilLogado === 'GESTOR_EMPRESA'

  if (!eGestor) {
    return (
      <div className="flex flex-col items-center justify-center h-[65vh] text-center p-6 border border-dashed" style={{ borderColor: 'var(--border)' }}>
        <div className="p-4 rounded-full bg-red-500/10 text-red-500 mb-4">
          <ShieldCheck size={40} />
        </div>
        <h2 className="text-xl font-black font-rajdhani uppercase tracking-wide" style={{ color: 'var(--foreground)' }}>
          Acesso Restrito ao Gestor
        </h2>
        <p className="text-xs font-mono mt-1 max-w-md" style={{ color: 'var(--foreground-muted)' }}>
          Seu perfil atual de Operador não possui privilégios para criar ou modificar credenciais de acesso da empresa.
        </p>
      </div>
    )
  }

  const usuariosFiltrados = usuarios.filter(u => 
    u.nome.toLowerCase().includes(busca.toLowerCase()) || 
    u.email.toLowerCase().includes(busca.toLowerCase())
  )

  // Envia os dados do Drawer diretamente para a API Backend
  const handleCriarUsuario = async (formData: Record<string, any>) => {
    try {
      const res = await fetch('/api/empresa/usuarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      if (!res.ok) {
        const errData = await res.json()
        alert(errData.error || 'Erro ao criar usuário')
        return
      }

      // Recarrega a lista do banco após salvar
      await carregarUsuarios()
    } catch (err) {
      console.error('Erro ao salvar:', err)
      alert('Erro de conexão ao salvar usuário')
    }
  }

  const handleExcluirUsuario = async (id: string) => {
    if (confirm('Deseja realmente remover o acesso deste operador?')) {
      // Atualização otimista na tela
      setUsuarios((prev) => prev.filter(u => u.id !== id))
    }
  }

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      
      {/* ─── CABEÇALHO DA PÁGINA ─── */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-2">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tight font-rajdhani" style={{ color: 'var(--foreground)' }}>
            Gestão de <span style={{ color: primary }}>Operadores & Sub-Admins</span>
          </h1>
          <p className="text-sm font-mono mt-1" style={{ color: 'var(--foreground-muted)' }}>
            Controle quem tem acesso ao painel da sua transportadora e defina permissões.
          </p>
        </div>

        <motion.button 
          whileHover={{ scale: 1.02 }} 
          whileTap={{ scale: 0.98 }}
          onClick={() => setDrawerOpen(true)}
          className="flex items-center gap-2 px-6 py-3 text-xs font-mono font-bold uppercase tracking-widest transition-all"
          style={{ 
            backgroundColor: primary, 
            color: '#000',
            clipPath: 'polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px))'
          }}
        >
          <UserPlus size={16} /> Registar Novo Operador
        </motion.button>
      </div>

      {/* ─── BARRA DE PESQUISA ─── */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none" style={{ color: 'var(--foreground-muted)' }}>
          <Search size={16} />
        </div>
        <input 
          type="text" 
          placeholder="Procurar operador por nome ou e-mail..." 
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="w-full pl-11 pr-4 py-3 text-sm outline-none border transition-colors font-mono"
          style={{ 
            backgroundColor: 'var(--background-secondary)', 
            borderColor: 'var(--border)', 
            color: 'var(--foreground)' 
          }}
          onFocus={(e) => e.target.style.borderColor = primary}
          onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
        />
      </div>

      {/* ─── TABELA DE USUÁRIOS ─── */}
      <motion.div 
        initial={{ opacity: 0, y: 15 }} 
        animate={{ opacity: 1, y: 0 }}
        className="border overflow-hidden relative"
        style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background-secondary)' }}
      >
        <div className="absolute top-0 left-0 w-full h-1 opacity-20" style={{ backgroundColor: primary }} />

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap font-mono">
            <thead style={{ backgroundColor: 'var(--background)', color: 'var(--foreground-muted)' }}>
              <tr className="text-[10px] uppercase tracking-widest border-b" style={{ borderColor: 'var(--border)' }}>
                <th className="px-6 py-4 font-medium">Usuário / Operador</th>
                <th className="px-6 py-4 font-medium">Nível de Permissão</th>
                <th className="px-6 py-4 font-medium">Status do Acesso</th>
                <th className="px-6 py-4 font-medium">Data de Cadastro</th>
                <th className="px-6 py-4 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y [&>tr]:border-[var(--border)]" style={{ color: 'var(--foreground)' }}>
              <AnimatePresence>
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-sm font-mono text-foreground-muted">
                      <div className="flex items-center justify-center gap-2">
                        <Loader2 size={16} className="animate-spin" style={{ color: primary }} />
                        <span>A carregar operadores...</span>
                      </div>
                    </td>
                  </tr>
                ) : usuariosFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-sm font-mono text-foreground-muted">
                      Nenhum operador encontrado na lista.
                    </td>
                  </tr>
                ) : (
                  usuariosFiltrados.map((u) => (
                    <motion.tr 
                      key={u.id}
                      initial={{ opacity: 0 }} 
                      animate={{ opacity: 1 }} 
                      exit={{ opacity: 0 }}
                      className="hover:bg-white/5 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full border flex items-center justify-center shrink-0" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background)', color: primary }}>
                            <User size={14} />
                          </div>
                          <div>
                            <div className="font-bold font-sans text-sm">{u.nome}</div>
                            <div className="text-[11px] text-foreground-muted">{u.email}</div>
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <BadgeRole role={u.role} primary={primary} />
                      </td>

                      <td className="px-6 py-4">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-sm text-[10px] font-bold tracking-widest bg-green-500/10 text-green-500 border border-green-500/20">
                          <CheckCircle2 size={10} /> {u.status}
                        </span>
                      </td>

                      <td className="px-6 py-4 text-xs text-foreground-muted">
                        {u.criadoEm}
                      </td>

                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button 
                            title="Redefinir Senha"
                            className="p-2 text-foreground-muted hover:text-foreground transition-colors rounded hover:bg-white/5"
                          >
                            <Lock size={14} />
                          </button>
                          <button 
                            title="Remover Operador"
                            onClick={() => handleExcluirUsuario(u.id)}
                            className="p-2 text-red-400 hover:text-red-500 transition-colors rounded hover:bg-red-500/10"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  ))
                )}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* ─── DRAWER LATERAL PARA REGISTAR NOVO OPERADOR ─── */}
      <GenericDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        titulo="CRIAR NOVO OPERADOR"
        subtitulo="Cadastre um funcionário e escolha seu nível de controle."
        campos={CAMPOS_USUARIO}
        onSubmit={handleCriarUsuario}
      />

    </div>
  )
}

function BadgeRole({ role, primary }: { role: string, primary: string }) {
  if (role === 'GESTOR_EMPRESA') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-sm text-[10px] font-bold tracking-widest border"
        style={{ backgroundColor: `${primary}15`, borderColor: primary, color: primary }}>
        <ShieldCheck size={12} /> GESTOR MASTER
      </span>
    )
  }
  if (role === 'OPERADOR') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-sm text-[10px] font-bold tracking-widest border bg-blue-500/10 text-blue-400 border-blue-500/20">
        <UserSquare2 size={12} /> OPERADOR
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-sm text-[10px] font-bold tracking-widest border bg-zinc-500/10 text-zinc-400 border-zinc-500/20">
      <Eye size={12} /> VISUALIZADOR
    </span>
  )
}

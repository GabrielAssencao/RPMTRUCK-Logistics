'use client'

import { useCallback, useState, useEffect, useMemo } from 'react'
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
  Loader2,
  ArrowUpDown,
  Copy,
  X,
} from 'lucide-react'
import GenericDrawer, { FieldConfig } from '@/components/dashboard/GenericDrawer'

interface UsuarioLocal {
  id: string
  nome: string
  email: string
  role: 'GESTOR_EMPRESA' | 'OPERADOR' | 'VISUALIZADOR'
  acessoDashboardGeral: boolean
  status: 'ATIVO' | 'INATIVO'
  criadoEm: string
}

type OrdenacaoOperadores = 'HIERARQUIA' | 'NOME_ASC' | 'NOME_DESC' | 'CADASTRO_RECENTE' | 'CADASTRO_ANTIGO'
type FiltroFuncao = 'TODOS' | UsuarioLocal['role']

interface CredencialTemporaria {
  nome: string
  email: string
  senha: string
  expiraEm: string
}

const PESO_HIERARQUIA: Record<UsuarioLocal['role'], number> = {
  GESTOR_EMPRESA: 3,
  OPERADOR: 2,
  VISUALIZADOR: 1,
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
    type: 'email',
    placeholder: 'exemplo@transportadora.com', 
    required: true,
  },
  { 
    name: 'senha', 
    label: 'Senha Inicial (troca obrigatória no primeiro acesso)',
    type: 'password',
    placeholder: 'Mínimo de 8 caracteres',
    required: true,
    minLength: 8,
    maxLength: 128,
  },
  { 
    name: 'role', 
    label: 'Nível de Permissão / Cargo', 
    type: 'select', 
    required: true,
    options: [
      { label: 'OPERADOR (Frota, Containers, Custos e Tarefas)', value: 'OPERADOR' },
      { label: 'VISUALIZADOR (Leitura operacional)', value: 'VISUALIZADOR' }
    ]
  },
  {
    name: 'acessoDashboardGeral',
    label: 'Acesso à visão geral da empresa',
    type: 'select',
    required: true,
    options: [
      { label: 'NÃO — somente módulos operacionais', value: 'false' },
      { label: 'SIM — permitir a visão geral', value: 'true' },
    ],
  }
]

export default function UsuariosPage() {
  const { primary, isLight } = useTheme()
  const [montado, setMontado] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [busca, setBusca] = useState('')
  const [ordenacao, setOrdenacao] = useState<OrdenacaoOperadores>('HIERARQUIA')
  const [filtroFuncao, setFiltroFuncao] = useState<FiltroFuncao>('TODOS')
  const [loading, setLoading] = useState(true)

  const [usuarios, setUsuarios] = useState<UsuarioLocal[]>([])
  const [usuarioLogadoId, setUsuarioLogadoId] = useState('')
  const [salvandoPermissaoId, setSalvandoPermissaoId] = useState<string | null>(null)
  const [redefinindoId, setRedefinindoId] = useState<string | null>(null)
  const [credencialTemporaria, setCredencialTemporaria] = useState<CredencialTemporaria | null>(null)
  
  const [perfilLogado, setPerfilLogado] = useState<'GESTOR_EMPRESA' | 'OPERADOR' | 'VISUALIZADOR'>('VISUALIZADOR')

  const carregarUsuarios = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/empresa/usuarios')
      if (res.ok) {
        const data = await res.json()
        const formatados = data.map((u: UsuarioApi) => ({
          id: u.id,
          nome: u.nome,
          email: u.email,
          role: u.role,
          acessoDashboardGeral: Boolean(u.acessoDashboardGeral),
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
  }, [])

  useEffect(() => {
    queueMicrotask(() => setMontado(true))
    fetch('/api/empresa/perfil', { cache: 'no-store' }).then(async response => {
      const data = await response.json()
      if (response.ok) {
        setPerfilLogado(data.usuario.role)
        setUsuarioLogadoId(data.usuario.id)
        if (data.usuario.role === 'GESTOR_EMPRESA' || data.usuario.role === 'GESTOR') await carregarUsuarios()
      } else setLoading(false)
    }).catch(() => setLoading(false))
  }, [carregarUsuarios])

  const usuariosFiltrados = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase('pt-BR')
    const filtrados = usuarios.filter((usuario) => (
      filtroFuncao === 'TODOS' || usuario.role === filtroFuncao
    ) && (
      usuario.nome.toLocaleLowerCase('pt-BR').includes(termo) ||
      usuario.email.toLocaleLowerCase('pt-BR').includes(termo)
    ))

    return [...filtrados].sort((a, b) => {
      if (ordenacao === 'NOME_ASC') return a.nome.localeCompare(b.nome, 'pt-BR')
      if (ordenacao === 'NOME_DESC') return b.nome.localeCompare(a.nome, 'pt-BR')
      if (ordenacao === 'CADASTRO_RECENTE') return b.criadoEm.localeCompare(a.criadoEm) || a.nome.localeCompare(b.nome, 'pt-BR')
      if (ordenacao === 'CADASTRO_ANTIGO') return a.criadoEm.localeCompare(b.criadoEm) || a.nome.localeCompare(b.nome, 'pt-BR')
      return PESO_HIERARQUIA[b.role] - PESO_HIERARQUIA[a.role] || a.nome.localeCompare(b.nome, 'pt-BR')
    })
  }, [busca, filtroFuncao, ordenacao, usuarios])

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

  // Envia os dados do Drawer diretamente para a API Backend
  const handleCriarUsuario = async (formData: Record<string, unknown>) => {
    try {
      const res = await fetch('/api/empresa/usuarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: formData.nome,
          email: formData.email,
          senha: formData.senha,
          role: formData.role,
          acessoDashboardGeral: formData.acessoDashboardGeral === 'true',
        })
      })

      if (!res.ok) {
        const errData = await res.json()
        alert(errData.error || 'Erro ao criar usuário')
        return false
      }

      // Recarrega a lista do banco após salvar
      await carregarUsuarios()
      return true
    } catch (err) {
      console.error('Erro ao salvar:', err)
      alert('Erro de conexão ao salvar usuário')
      return false
    }
  }

  const handleExcluirUsuario = async (id: string) => {
    if (confirm('Deseja realmente remover o acesso deste operador?')) {
      const response = await fetch(`/api/empresa/usuarios/${id}`, { method: 'DELETE' })
      const data = await response.json()
      if (!response.ok) return alert(data.erro || 'Não foi possível remover o usuário.')
      setUsuarios((prev) => prev.filter(u => u.id !== id))
    }
  }

  const handleAlternarDashboard = async (usuario: UsuarioLocal) => {
    setSalvandoPermissaoId(usuario.id)
    try {
      const response = await fetch(`/api/empresa/usuarios/${usuario.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acessoDashboardGeral: !usuario.acessoDashboardGeral }),
      })
      const data = await response.json()
      if (!response.ok) return alert(data.erro || 'Não foi possível alterar a permissão.')
      setUsuarios(prev => prev.map(item => item.id === usuario.id
        ? { ...item, acessoDashboardGeral: data.acessoDashboardGeral }
        : item))
    } catch {
      alert('Erro de conexão ao alterar a permissão.')
    } finally {
      setSalvandoPermissaoId(null)
    }
  }

  const redefinirAcesso = async (usuario: UsuarioLocal) => {
    if (usuario.id === usuarioLogadoId || usuario.role === 'GESTOR_EMPRESA') {
      alert('A senha do gestor só pode ser alterada em Configurações > Segurança.')
      return
    }
    if (!window.confirm(`Gerar uma nova senha temporária para ${usuario.nome}? As sessões atuais serão encerradas.`)) return

    setRedefinindoId(usuario.id)
    try {
      const response = await fetch(`/api/empresa/usuarios/${usuario.id}/redefinir-senha`, {
        method: 'POST',
      })
      const data = await response.json()
      if (!response.ok) return alert(data.erro || 'Não foi possível redefinir o acesso.')
      setCredencialTemporaria(data.credencialTemporaria)
    } catch {
      alert('Erro de conexão ao redefinir o acesso.')
    } finally {
      setRedefinindoId(null)
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
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_14rem_18rem]">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none" style={{ color: 'var(--foreground-muted)' }}>
            <Search size={16} />
          </div>
          <input
            type="search"
            aria-label="Procurar operador"
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
        <label className="relative flex items-center border" style={{ backgroundColor: 'var(--background-secondary)', borderColor: 'var(--border)' }}>
          <ShieldCheck size={15} className="pointer-events-none absolute left-3" style={{ color: primary }} />
          <span className="sr-only">Filtrar por função</span>
          <select
            value={filtroFuncao}
            onChange={(event) => setFiltroFuncao(event.target.value as FiltroFuncao)}
            className="min-h-11 w-full appearance-none bg-transparent py-3 pl-10 pr-4 text-xs font-bold uppercase tracking-wider outline-none"
            style={{ color: 'var(--foreground)', colorScheme: isLight ? 'light' : 'dark' }}
          >
            <option value="TODOS" style={OPTION_STYLE}>Todas as funções</option>
            <option value="GESTOR_EMPRESA" style={OPTION_STYLE}>Gestor</option>
            <option value="OPERADOR" style={OPTION_STYLE}>Operador</option>
            <option value="VISUALIZADOR" style={OPTION_STYLE}>Visualizador</option>
          </select>
        </label>
        <label className="relative flex items-center border" style={{ backgroundColor: 'var(--background-secondary)', borderColor: 'var(--border)' }}>
          <ArrowUpDown size={15} className="pointer-events-none absolute left-3" style={{ color: primary }} />
          <span className="sr-only">Ordenar operadores</span>
          <select
            value={ordenacao}
            onChange={(event) => setOrdenacao(event.target.value as OrdenacaoOperadores)}
            className="min-h-11 w-full appearance-none bg-transparent py-3 pl-10 pr-4 text-xs font-bold uppercase tracking-wider outline-none"
            style={{ color: 'var(--foreground)', colorScheme: isLight ? 'light' : 'dark' }}
          >
            <option value="HIERARQUIA" style={OPTION_STYLE}>Hierarquia (maior primeiro)</option>
            <option value="NOME_ASC" style={OPTION_STYLE}>Nome (A–Z)</option>
            <option value="NOME_DESC" style={OPTION_STYLE}>Nome (Z–A)</option>
            <option value="CADASTRO_RECENTE" style={OPTION_STYLE}>Cadastro (mais recente)</option>
            <option value="CADASTRO_ANTIGO" style={OPTION_STYLE}>Cadastro (mais antigo)</option>
          </select>
        </label>
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
                <th className="px-6 py-4 font-medium">Visão Geral</th>
                <th className="px-6 py-4 font-medium">Status do Acesso</th>
                <th className="px-6 py-4 font-medium">Data de Cadastro</th>
                <th className="px-6 py-4 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y [&>tr]:border-[var(--border)]" style={{ color: 'var(--foreground)' }}>
              <AnimatePresence>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-sm font-mono text-foreground-muted">
                      <div className="flex items-center justify-center gap-2">
                        <Loader2 size={16} className="animate-spin" style={{ color: primary }} />
                        <span>A carregar operadores...</span>
                      </div>
                    </td>
                  </tr>
                ) : usuariosFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-sm font-mono text-foreground-muted">
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
                        {u.role === 'GESTOR_EMPRESA' ? (
                          <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: primary }}>Acesso integral</span>
                        ) : (
                          <button
                            type="button"
                            aria-pressed={u.acessoDashboardGeral}
                            disabled={salvandoPermissaoId === u.id}
                            onClick={() => void handleAlternarDashboard(u)}
                            className="inline-flex min-w-24 items-center justify-center gap-2 border px-3 py-2 text-[10px] font-bold uppercase tracking-wider disabled:opacity-50"
                            style={{
                              borderColor: u.acessoDashboardGeral ? primary : 'var(--border)',
                              color: u.acessoDashboardGeral ? primary : 'var(--foreground-muted)',
                            }}
                          >
                            {salvandoPermissaoId === u.id ? <Loader2 size={12} className="animate-spin" /> : <Eye size={12} />}
                            {u.acessoDashboardGeral ? 'Permitida' : 'Bloqueada'}
                          </button>
                        )}
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
                          {u.id !== usuarioLogadoId && u.role !== 'GESTOR_EMPRESA' && (
                            <button
                              type="button"
                              title="Gerar senha temporária"
                              aria-label={`Redefinir acesso de ${u.nome}`}
                              disabled={redefinindoId === u.id}
                              onClick={() => void redefinirAcesso(u)}
                              className="p-2 text-foreground-muted hover:text-foreground transition-colors rounded hover:bg-white/5 disabled:opacity-50"
                            >
                              {redefinindoId === u.id ? <Loader2 size={14} className="animate-spin" /> : <Lock size={14} />}
                            </button>
                          )}
                          {u.id !== usuarioLogadoId && u.role !== 'GESTOR_EMPRESA' && (
                            <button
                              title="Remover Operador"
                              onClick={() => handleExcluirUsuario(u.id)}
                              className="p-2 text-red-400 hover:text-red-500 transition-colors rounded hover:bg-red-500/10"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
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

      {credencialTemporaria && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4" role="presentation">
          <div role="dialog" aria-modal="true" aria-labelledby="titulo-credencial-temporaria" className="w-full max-w-lg border p-5" style={{ backgroundColor: 'var(--background)', borderColor: primary }}>
            <div className="flex items-start justify-between gap-4 border-b pb-3" style={{ borderColor: 'var(--border)' }}>
              <div>
                <h2 id="titulo-credencial-temporaria" className="text-base font-black uppercase">Senha temporária gerada</h2>
                <p className="mt-1 text-xs text-foreground-muted">Copie agora. Por segurança, ela não será exibida novamente.</p>
              </div>
              <button type="button" aria-label="Fechar" onClick={() => setCredencialTemporaria(null)} className="p-2 text-foreground-muted hover:text-foreground"><X size={16} /></button>
            </div>
            <dl className="mt-4 space-y-3 text-sm">
              <div><dt className="text-[10px] font-bold uppercase text-foreground-muted">Operador</dt><dd>{credencialTemporaria.nome} · {credencialTemporaria.email}</dd></div>
              <div>
                <dt className="text-[10px] font-bold uppercase text-foreground-muted">Senha temporária</dt>
                <dd className="mt-1 flex items-center justify-between gap-3 border p-3 font-mono" style={{ borderColor: 'var(--border)' }}>
                  <span className="break-all">{credencialTemporaria.senha}</span>
                  <button type="button" aria-label="Copiar senha temporária" onClick={() => void navigator.clipboard.writeText(credencialTemporaria.senha)} className="shrink-0 p-2" style={{ color: primary }}><Copy size={16} /></button>
                </dd>
              </div>
              <div><dt className="text-[10px] font-bold uppercase text-foreground-muted">Validade</dt><dd>{new Date(credencialTemporaria.expiraEm).toLocaleString('pt-BR')}</dd></div>
            </dl>
            <p className="mt-4 border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-400">No próximo acesso, o operador deverá criar uma senha pessoal. As sessões anteriores já foram encerradas.</p>
          </div>
        </div>
      )}

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

interface UsuarioApi {
  id: string
  nome: string
  email: string
  role: UsuarioLocal['role']
  acessoDashboardGeral: boolean
  criado_em: string
}

const OPTION_STYLE = { backgroundColor: 'var(--background)', color: 'var(--foreground)' }

'use client'

import { useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, ArrowLeft, Download, Loader2, ShieldCheck, Trash2 } from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'

const CONFIRMACAO = 'EXCLUIR MINHA EMPRESA'

export default function ExclusaoContaPage() {
  const { primary } = useTheme()
  const [backupToken, setBackupToken] = useState('')
  const [backupConfirmado, setBackupConfirmado] = useState(false)
  const [confirmacao, setConfirmacao] = useState('')
  const [senha, setSenha] = useState('')
  const [processando, setProcessando] = useState<'BACKUP' | 'EXCLUSAO' | null>(null)
  const [feedback, setFeedback] = useState('')

  const baixarBackup = async () => {
    setProcessando('BACKUP')
    setFeedback('')
    setBackupToken('')
    setBackupConfirmado(false)
    try {
      const response = await fetch('/api/empresa/exclusao-conta/exportar', { method: 'POST' })
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.erro || 'Não foi possível gerar o backup.')
      }
      const token = response.headers.get('X-RPMTruck-Backup-Token')
      if (!token) throw new Error('O backup foi gerado sem o comprovante de segurança. Tente novamente.')
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `rpmtruck-backup-${new Date().toISOString().slice(0, 10)}.xlsx`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
      setBackupToken(token)
      setFeedback('Backup gerado. Confirme abaixo somente depois de localizar e abrir o arquivo Excel.')
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Não foi possível gerar o backup.')
    } finally {
      setProcessando(null)
    }
  }

  const excluirConta = async () => {
    if (!backupToken || !backupConfirmado || confirmacao !== CONFIRMACAO || !senha) return
    if (!window.confirm('Última confirmação: excluir permanentemente a empresa e encerrar todas as sessões?')) return
    setProcessando('EXCLUSAO')
    setFeedback('')
    try {
      const response = await fetch('/api/empresa/exclusao-conta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ senha, confirmacao, backupToken, backupConfirmado }),
      })
      const data = await response.json()
      if (!response.ok && response.status !== 202) throw new Error(data.erro || 'Não foi possível excluir a conta.')
      localStorage.removeItem('@rpmtruck:user')
      window.location.replace(`/auth/login?contaExcluida=1`)
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Não foi possível excluir a conta.')
      setProcessando(null)
    }
  }

  const liberado = Boolean(backupToken && backupConfirmado && confirmacao === CONFIRMACAO && senha)

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href="/dashboard/empresa/configuracoes" className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-foreground-muted hover:text-foreground"><ArrowLeft size={14} /> Voltar às configurações</Link>
      <header>
        <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-red-500">Privacidade e encerramento</p>
        <h1 className="mt-2 font-rajdhani text-3xl font-black uppercase">Exclusão de conta</h1>
        <p className="mt-2 text-sm text-foreground-muted">Fluxo exclusivo do gestor para exportar e excluir os dados da transportadora.</p>
      </header>

      {feedback && <p role="status" className="border p-3 text-sm" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background-secondary)' }}>{feedback}</p>}

      <section className="border p-5 sm:p-6" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background-secondary)' }}>
        <div className="flex items-start gap-3"><Download size={20} style={{ color: primary }} /><div><h2 className="font-bold uppercase">1. Backup obrigatório em Excel</h2><p className="mt-1 text-xs leading-relaxed text-foreground-muted">O arquivo reúne os dados vinculados à empresa em planilhas separadas. Senhas e segredos de autenticação não são exportados.</p></div></div>
        <button type="button" disabled={Boolean(processando)} onClick={() => void baixarBackup()} className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 border text-xs font-black uppercase disabled:opacity-50" style={{ borderColor: primary, color: primary }}>{processando === 'BACKUP' ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />} Gerar e baixar backup .xlsx</button>
        {backupToken && <label className="mt-4 flex items-start gap-3 border border-green-500/30 bg-green-500/5 p-3 text-xs"><input type="checkbox" checked={backupConfirmado} onChange={(event) => setBackupConfirmado(event.target.checked)} className="mt-0.5 h-4 w-4" /><span>Localizei e consegui abrir o arquivo Excel gerado. Estou ciente de que esse é o backup anterior ao expurgo.</span></label>}
      </section>

      <section className="border border-red-500/30 bg-red-500/5 p-5 sm:p-6">
        <div className="flex items-start gap-3 text-red-500"><AlertTriangle size={20} /><div><h2 className="font-bold uppercase">2. Confirmação definitiva</h2><p className="mt-1 text-xs leading-relaxed">A operação encerra sessões e remove dados operacionais e arquivos privados. Ela não pode ser desfeita pelo painel.</p></div></div>
        <div className="mt-5 space-y-4">
          <label className="block"><span className="mb-2 block text-[10px] font-bold uppercase tracking-wider">Digite {CONFIRMACAO}</span><input value={confirmacao} onChange={(event) => setConfirmacao(event.target.value)} autoComplete="off" className="input-financeiro" /></label>
          <label className="block"><span className="mb-2 block text-[10px] font-bold uppercase tracking-wider">Senha atual do gestor</span><input type="password" value={senha} onChange={(event) => setSenha(event.target.value)} autoComplete="current-password" maxLength={128} className="input-financeiro" /></label>
          <button type="button" disabled={!liberado || Boolean(processando)} onClick={() => void excluirConta()} className="flex min-h-12 w-full items-center justify-center gap-2 bg-red-600 text-xs font-black uppercase text-white disabled:cursor-not-allowed disabled:opacity-40">{processando === 'EXCLUSAO' ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />} Excluir empresa permanentemente</button>
        </div>
      </section>

      <aside className="flex gap-3 border p-4 text-xs text-foreground-muted" style={{ borderColor: 'var(--border)' }}><ShieldCheck size={18} className="shrink-0" style={{ color: primary }} /><p>A eliminação prevista pela LGPD admite hipóteses legais de conservação. A empresa deve validar obrigações fiscais, trabalhistas, contratuais ou regulatórias antes do expurgo.</p></aside>
    </div>
  )
}

// src/components/dashboard/NotificacoesPanel.tsx
// Painel de notificações com bell icon e dropdown

'use client'

import { useEffect, useState } from 'react'
import { useTheme } from '@/contexts/ThemeContext'
import { useNotificacoes } from '@/hooks/useNotificacoes'
import { motion, AnimatePresence } from 'framer-motion'
import { Bell, Trash2, Check, CheckCheck } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ActionFeedback } from '@/components/motion/DashboardMotion'
import { ActionConfirmDialog } from '@/components/dashboard/ActionConfirmDialog'

type ConfirmacaoNotificacao =
  | { tipo: 'LIMPAR_LIDAS' }
  | { tipo: 'EXCLUIR'; id: string; titulo: string }

interface NotificacoesPanelProps {
  onPendenciasChange?: (pendencias: Record<string, number>) => void
  centralHref?: string | null
  onOpenCentral?: () => void
}

export default function NotificacoesPanel({
  onPendenciasChange,
  centralHref = '/dashboard/empresa/notificacoes',
  onOpenCentral,
}: NotificacoesPanelProps) {
  const { primary, semanticColors } = useTheme()
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [processando, setProcessando] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<{ mensagem: string; erro: boolean } | null>(null)
  const [confirmacao, setConfirmacao] = useState<ConfirmacaoNotificacao | null>(null)
  const { notificacoes, naoLidas, loading, error, pendenciasPorModulo, marcarComoLida, marcarTodasComoLidas, limparLidas, deletarNotificacao, recarregar } =
    useNotificacoes()
  const temLidas = notificacoes.some(notificacao => notificacao.lida)

  const executarAcao = async (chave: string, acao: () => Promise<unknown>, sucesso: string) => {
    if (processando) return
    setProcessando(chave)
    setFeedback(null)
    try {
      await acao()
      setFeedback({ mensagem: sucesso, erro: false })
    } catch (cause) {
      setFeedback({ mensagem: cause instanceof Error ? cause.message : 'Não foi possível concluir a ação.', erro: true })
    } finally {
      setProcessando(null)
    }
  }

  const confirmarAcao = async () => {
    if (!confirmacao || processando) return
    const acao = confirmacao
    if (acao.tipo === 'LIMPAR_LIDAS') {
      await executarAcao('limpar', async () => {
        const removidas = await limparLidas()
        setFeedback({ mensagem: `${removidas} notificação(ões) lida(s) removida(s).`, erro: false })
      }, 'Notificações lidas removidas.')
    } else {
      await executarAcao(acao.id, () => deletarNotificacao(acao.id), 'Notificação excluída.')
    }
    setConfirmacao(null)
  }

  const abrirTicket = async (notificacaoId: string, ticketId: string) => {
    try {
      await marcarComoLida(notificacaoId)
    } catch (cause) {
      setFeedback({ mensagem: cause instanceof Error ? cause.message : 'Não foi possível atualizar a notificação.', erro: true })
    }
    setIsOpen(false)
    const params = new URLSearchParams({ ticket: ticketId })
    if (centralHref === null) params.set('tab', 'chat')
    window.dispatchEvent(new CustomEvent('rpmtruck:abrir-ticket-suporte', { detail: { ticketId } }))
    router.push(`${centralHref === null ? '/dashboard/admin' : '/dashboard/empresa/chat'}?${params.toString()}`)
  }

  const alternarPainel = () => {
    const proximoEstado = !isOpen
    setIsOpen(proximoEstado)
    if (proximoEstado) void recarregar()
  }

  useEffect(() => {
    onPendenciasChange?.(pendenciasPorModulo)
  }, [onPendenciasChange, pendenciasPorModulo])

  const moduloCorMap: Record<string, string> = {
    FROTA: '#f59e0b',
    MOTORISTAS: '#3b82f6',
    CUSTOS: '#10b981',
    CHAT: '#8b5cf6',
    SEGURANÇA: semanticColors.danger,
    GERAL: primary
  }

  return (
    <div className="relative">
      {/* Bell Icon */}
      <button
        onClick={alternarPainel}
        aria-label={naoLidas > 0 ? `Abrir notificações, ${naoLidas} não lidas` : 'Abrir notificações'}
        className="relative p-2 rounded-lg hover:opacity-70 transition-all"
        style={{ backgroundColor: `${primary}10` }}
      >
        <Bell size={20} style={{ color: primary }} />

        {/* Badge de notificações não lidas */}
        {naoLidas > 0 && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white"
            style={{ backgroundColor: semanticColors.warning, color: '#071018' }}
          >
            {naoLidas > 9 ? '9+' : naoLidas}
          </motion.div>
        )}
      </button>

      {/* Dropdown Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            role="dialog"
            aria-modal="true"
            aria-label="Central de notificações"
            className="fixed left-3 right-3 top-16 z-[70] max-h-[calc(100dvh-5rem)] overflow-hidden rounded-lg border shadow-xl sm:absolute sm:left-auto sm:right-0 sm:top-12 sm:w-96"
            style={{
              backgroundColor: 'var(--background-secondary)',
              borderColor: 'var(--border)'
            }}
          >
            {/* Header */}
            <div
              className="px-4 py-3 border-b flex items-center justify-between"
              style={{ borderColor: 'var(--border)' }}
            >
              <h3 className="font-bold text-sm">
                Notificações {naoLidas > 0 && `(${naoLidas})`}
              </h3>
              <button
                onClick={() => setIsOpen(false)}
                className="text-xs font-bold uppercase tracking-widest opacity-50 hover:opacity-100 transition-all"
              >
                ✕
              </button>
            </div>

            {(naoLidas > 0 || temLidas) && (
              <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2" style={{ borderColor: 'var(--border)' }}>
                {naoLidas > 0 && <button type="button" disabled={Boolean(processando)} onClick={() => void executarAcao('todas', marcarTodasComoLidas, 'Todas as notificações foram marcadas como lidas.')} className="flex items-center gap-2 text-xs font-bold hover:underline disabled:opacity-50" style={{ color: primary }}>
                  <CheckCheck size={14} /> Marcar todas como lidas
                </button>}
                {temLidas && <button type="button" disabled={Boolean(processando)} onClick={() => setConfirmacao({ tipo: 'LIMPAR_LIDAS' })} className="ml-auto flex items-center gap-2 text-xs font-bold hover:underline disabled:opacity-50" style={{ color: semanticColors.danger }}>
                  <Trash2 size={14} /> Limpar lidas
                </button>}
              </div>
            )}

            {feedback && <ActionFeedback message={feedback.mensagem} tone={feedback.erro ? 'error' : 'success'} className="m-3 text-xs" />}

            {/* Lista de Notificações */}
            <div className="max-h-96 overflow-y-auto">
              {loading ? (
                <div className="p-8 text-center text-foreground-muted text-sm">Carregando notificações...</div>
              ) : error ? (
                <div className="p-8 text-center text-sm" style={{ color: semanticColors.danger }}>{error}</div>
              ) : notificacoes.length === 0 ? (
                <div className="p-8 text-center text-foreground-muted text-sm">
                  Nenhuma notificação
                </div>
              ) : (
                <AnimatePresence>
                  {notificacoes.map((notif) => (
                    <motion.div
                      key={notif.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 10 }}
                      className="px-4 py-3 border-b hover:bg-black/5 transition-colors group"
                      style={{
                        borderColor: 'var(--border)',
                        backgroundColor: notif.lida ? 'transparent' : `${primary}08`
                      }}
                    >
                      {/* Módulo badge */}
                      <div className="flex items-start gap-3">
                        <div
                          className="w-2 h-2 rounded-full mt-1 flex-shrink-0"
                          style={{
                            backgroundColor:
                              moduloCorMap[notif.modulo] || primary
                          }}
                        />

                        <div className="flex-1 min-w-0">
                          {/* Título */}
                          <p className="font-bold text-sm break-words">
                            {notif.titulo}
                          </p>

                          {/* Mensagem */}
                          <p className="text-xs text-foreground-muted mt-1 break-words">
                            {notif.mensagem}
                          </p>

                          {notif.ticketSuporteId && (
                            <button
                              type="button"
                              onClick={() => void abrirTicket(notif.id, notif.ticketSuporteId!)}
                              className="mt-2 text-[10px] font-black uppercase tracking-wider hover:underline"
                              style={{ color: primary }}
                            >
                              Abrir ticket {notif.ticketSuporte?.protocolo ? `· ${notif.ticketSuporte.protocolo}` : ''}
                            </button>
                          )}

                          {/* Veículo (se relacionado) */}
                          {notif.veiculo && (
                            <p className="text-xs font-mono text-foreground-muted mt-1">
                              🚛 {notif.veiculo.placa} - {notif.veiculo.modelo}
                            </p>
                          )}

                          {/* Data */}
                          <p className="text-xs text-foreground-muted/50 mt-1">
                            {new Date(notif.criado_em).toLocaleDateString(
                              'pt-BR'
                            )}{' '}
                            às{' '}
                            {new Date(notif.criado_em).toLocaleTimeString(
                              'pt-BR',
                              { hour: '2-digit', minute: '2-digit' }
                            )}
                          </p>
                        </div>

                        {/* Ações */}
                        {!notif.lida && (
                          <div className="flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity flex-shrink-0">
                            <button
                              disabled={Boolean(processando)}
                              onClick={() => void executarAcao(notif.id, () => marcarComoLida(notif.id), 'Notificação marcada como lida.')}
                              className="p-1 hover:opacity-70 transition-opacity"
                              title="Marcar como lida"
                            >
                              <Check size={14} style={{ color: primary }} />
                            </button>
                            <button
                              disabled={Boolean(processando)}
                              onClick={() => setConfirmacao({ tipo: 'EXCLUIR', id: notif.id, titulo: notif.titulo })}
                              className="p-1 hover:opacity-70 transition-opacity"
                              style={{ color: semanticColors.danger }}
                              title="Deletar"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              )}
            </div>

            {/* Footer */}
            {(centralHref || onOpenCentral) && (
              <div
                className="px-4 py-3 border-t text-center"
                style={{ borderColor: 'var(--border)' }}
              >
                {centralHref ? (
                  <Link href={centralHref} onClick={() => setIsOpen(false)} className="text-xs font-bold uppercase tracking-widest transition-all hover:underline" style={{ color: primary }}>
                    Abrir central de notificações
                  </Link>
                ) : (
                  <button type="button" onClick={() => { setIsOpen(false); onOpenCentral?.() }} className="text-xs font-bold uppercase tracking-widest transition-all hover:underline" style={{ color: primary }}>
                    Abrir central de notificações
                  </button>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Fechar ao clicar fora */}
      {isOpen && (
        <div
          className="fixed inset-0 z-[60] bg-black/20 sm:bg-transparent"
          onClick={() => setIsOpen(false)}
        />
      )}

      <ActionConfirmDialog
        open={Boolean(confirmacao)}
        title={confirmacao?.tipo === 'LIMPAR_LIDAS' ? 'Limpar notificações lidas' : 'Excluir notificação'}
        description={confirmacao?.tipo === 'LIMPAR_LIDAS'
          ? 'As notificações já lidas serão removidas permanentemente. As não lidas serão preservadas.'
          : `A notificação “${confirmacao?.tipo === 'EXCLUIR' ? confirmacao.titulo : ''}” será removida permanentemente.`}
        confirmLabel={confirmacao?.tipo === 'LIMPAR_LIDAS' ? 'Limpar lidas' : 'Excluir notificação'}
        cancelLabel="Manter notificações"
        loading={Boolean(processando)}
        onClose={() => { if (!processando) setConfirmacao(null) }}
        onConfirm={() => void confirmarAcao()}
      />
    </div>
  )
}

// src/components/dashboard/NotificacoesPanel.tsx
// Painel de notificações com bell icon e dropdown

'use client'

import { useEffect, useState } from 'react'
import { useTheme } from '@/contexts/ThemeContext'
import { useNotificacoes } from '@/hooks/useNotificacoes'
import { motion, AnimatePresence } from 'framer-motion'
import { Bell, Trash2, Check, CheckCheck } from 'lucide-react'

interface NotificacoesPanelProps {
  onPendenciasChange?: (pendencias: Record<string, number>) => void
}

export default function NotificacoesPanel({ onPendenciasChange }: NotificacoesPanelProps) {
  const { primary } = useTheme()
  const [isOpen, setIsOpen] = useState(false)
  const { notificacoes, naoLidas, loading, error, pendenciasPorModulo, marcarComoLida, marcarTodasComoLidas, deletarNotificacao, recarregar } =
    useNotificacoes()

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
    SEGURANÇA: '#ef4444',
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
            style={{ backgroundColor: '#ef4444' }}
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
            className="absolute top-12 right-0 w-96 rounded-lg border shadow-xl z-50"
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

            {naoLidas > 0 && (
              <div className="px-4 py-2 border-b" style={{ borderColor: 'var(--border)' }}>
                <button onClick={marcarTodasComoLidas} className="flex items-center gap-2 text-xs font-bold hover:underline" style={{ color: primary }}>
                  <CheckCheck size={14} /> Marcar todas como lidas
                </button>
              </div>
            )}

            {/* Lista de Notificações */}
            <div className="max-h-96 overflow-y-auto">
              {loading ? (
                <div className="p-8 text-center text-foreground-muted text-sm">Carregando notificações...</div>
              ) : error ? (
                <div className="p-8 text-center text-red-500 text-sm">{error}</div>
              ) : notificacoes.length === 0 ? (
                <div className="p-8 text-center text-foreground-muted text-sm">
                  Nenhuma notificação
                </div>
              ) : (
                <AnimatePresence>
                  {notificacoes.map((notif, idx) => (
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
                              onClick={() => marcarComoLida(notif.id)}
                              className="p-1 hover:opacity-70 transition-opacity"
                              title="Marcar como lida"
                            >
                              <Check size={14} style={{ color: primary }} />
                            </button>
                            <button
                              onClick={() => deletarNotificacao(notif.id)}
                              className="p-1 hover:opacity-70 transition-opacity text-red-500"
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
            {notificacoes.length > 0 && (
              <div
                className="px-4 py-3 border-t text-center"
                style={{ borderColor: 'var(--border)' }}
              >
                <button
                  className="text-xs font-bold uppercase tracking-widest opacity-50 hover:opacity-100 transition-all"
                  onClick={() => setIsOpen(false)}
                >
                  Fechar
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Fechar ao clicar fora */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  )
}

'use client'

import { Check, FileSpreadsheet, Printer, TriangleAlert, X } from 'lucide-react'
import styles from './OperationalFeedback.module.css'

export type PrinterStage = 'preparing' | 'generating' | 'saving' | 'complete' | 'error'

const PRINTER_COPY: Record<PrinterStage, { label: string; description: string; progress: number }> = {
  preparing: {
    label: 'Preparando dados',
    description: 'Validando o período e organizando as informações do relatório.',
    progress: 15,
  },
  generating: {
    label: 'Gerando Excel',
    description: 'Montando as planilhas e calculando os indicadores operacionais.',
    progress: 55,
  },
  saving: {
    label: 'Protegendo arquivo',
    description: 'Sincronizando o ciclo de arquivos com o armazenamento privado.',
    progress: 85,
  },
  complete: {
    label: 'Arquivo concluído',
    description: 'O Excel já está disponível no ciclo de arquivos.',
    progress: 100,
  },
  error: {
    label: 'Não foi possível gerar',
    description: 'Revise a mensagem apresentada e tente novamente.',
    progress: 0,
  },
}

interface DominoLoaderProps {
  label?: string
  compact?: boolean
  className?: string
}

export function DominoLoader({
  label = 'Carregando informações',
  compact = false,
  className = '',
}: DominoLoaderProps) {
  return (
    <div
      className={`${styles.loaderContainer} ${compact ? styles.loaderCompact : ''} ${className}`}
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <span className={styles.domino} aria-hidden="true">
        {Array.from({ length: 8 }, (_, index) => <span key={index} />)}
      </span>
      <span className={styles.loaderLabel}>{label}</span>
    </div>
  )
}

interface PrinterProgressProps {
  stage: PrinterStage
  errorMessage?: string
  onDismiss?: () => void
  className?: string
}

export function PrinterProgress({ stage, errorMessage, onDismiss, className = '' }: PrinterProgressProps) {
  const copy = PRINTER_COPY[stage]
  const isTerminal = stage === 'complete' || stage === 'error'
  const statusColor = stage === 'error' ? 'var(--status-danger)' : stage === 'complete' ? 'var(--status-success)' : 'var(--primary)'

  return (
    <section
      className={`${styles.printerProgress} ${className}`}
      data-printer-stage={stage}
      role={stage === 'error' ? 'alert' : 'status'}
      aria-live={stage === 'error' ? 'assertive' : 'polite'}
      aria-atomic="true"
      style={{ '--printer-status': statusColor } as React.CSSProperties}
    >
      <div className={styles.printerVisual} aria-hidden="true">
        <div className={styles.inputPaper}>
          <FileSpreadsheet size={13} />
          <span /><span /><span />
        </div>
        <div className={styles.printerBody}>
          <Printer size={21} />
          <i />
        </div>
        <div className={styles.outputPaper}><Check size={13} /></div>
        {stage === 'error' && <TriangleAlert className={styles.errorIcon} size={17} />}
      </div>

      <div className={styles.printerContent}>
        <div className={styles.printerHeading}>
          <div>
            <span className={styles.eyebrow}>Exportação operacional</span>
            <strong>{copy.label}</strong>
          </div>
          {isTerminal && onDismiss && (
            <button type="button" onClick={onDismiss} className={styles.dismissButton} aria-label="Fechar status da exportação">
              <X size={15} />
            </button>
          )}
        </div>
        <p>{stage === 'error' && errorMessage ? errorMessage : copy.description}</p>
        <div
          className={styles.progressTrack}
          role="progressbar"
          aria-label="Progresso da geração do Excel"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={copy.progress}
        >
          <span style={{ width: `${copy.progress}%` }} />
        </div>
        <div className={styles.stageList} aria-hidden="true">
          <span className={stage !== 'error' ? styles.stageActive : ''}>Preparar</span>
          <span className={['generating', 'saving', 'complete'].includes(stage) ? styles.stageActive : ''}>Gerar</span>
          <span className={['saving', 'complete'].includes(stage) ? styles.stageActive : ''}>Salvar</span>
          <span className={stage === 'complete' ? styles.stageActive : ''}>Concluir</span>
        </div>
      </div>
    </section>
  )
}

export function ProfileSkeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`${styles.profileSkeleton} ${className}`} role="status" aria-live="polite" aria-label="Carregando perfil da empresa" aria-busy="true">
      <div className={styles.skeletonHeader}>
        <span className={styles.skeletonAvatar} />
        <div><span /><span /></div>
      </div>
      <div className={styles.skeletonDivider} />
      <div className={styles.skeletonGrid}>
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index}><span /><span /></div>
        ))}
      </div>
      <span className={styles.srOnly}>Carregando perfil da empresa…</span>
    </div>
  )
}

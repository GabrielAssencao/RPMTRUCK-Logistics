import { DominoLoader } from '@/components/motion/OperationalFeedback'

export default function EmpresaDashboardLoading() {
  return (
    <div
      className="flex min-h-[45vh] items-center justify-center border"
      style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background-secondary)' }}
    >
      <DominoLoader label="Carregando módulo da empresa" />
    </div>
  )
}

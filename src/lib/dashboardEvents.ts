export const DASHBOARD_EMPRESA_ATUALIZADA_EVENT = 'rpmtruck:dashboard-empresa-atualizada'

export function sinalizarAtualizacaoDashboardEmpresa() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(DASHBOARD_EMPRESA_ATUALIZADA_EVENT))
}

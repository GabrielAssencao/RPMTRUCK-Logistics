export const ADMIN_SECURITY_SHORTCUT_KEY = '@rpmtruck:admin-security-shortcut-visible'
export const ADMIN_SIDEBAR_UPDATED_EVENT = 'rpmtruck:admin-sidebar-updated'

function chavePreferencia() {
  try {
    const usuario = JSON.parse(localStorage.getItem('@rpmtruck:user') || '{}')
    return `${ADMIN_SECURITY_SHORTCUT_KEY}:${usuario.id || 'local'}`
  } catch {
    return `${ADMIN_SECURITY_SHORTCUT_KEY}:local`
  }
}

export function lerAtalhoSegurancaVisivel() {
  try {
    return localStorage.getItem(chavePreferencia()) !== 'false'
  } catch {
    return true
  }
}

export function salvarAtalhoSegurancaVisivel(visivel: boolean) {
  try {
    localStorage.setItem(chavePreferencia(), String(visivel))
  } catch {
    // A preferência permanece apenas na sessão quando o storage está indisponível.
  }
  window.dispatchEvent(new CustomEvent(ADMIN_SIDEBAR_UPDATED_EVENT, { detail: { visivel } }))
}

const STORAGE_KEY = '@rpmtruck:experience3d'
const CHANGE_EVENT = 'rpmtruck:experience3d'

function readPreference(): string | null {
  try { return window.sessionStorage.getItem(STORAGE_KEY) } catch { return null }
}

function writePreference(value: 'requested' | 'ready') {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, value)
    window.dispatchEvent(new Event(CHANGE_EVENT))
  } catch { /* Sem storage, o login mantém a apresentação com a marca. */ }
}

export function requestExperience3DDownload() { writePreference('requested') }

export function confirmExperience3DLoaded() {
  if (readPreference() === 'requested') writePreference('ready')
}

export function getExperience3DReady() { return readPreference() === 'ready' }
export function getServerExperience3DReady() { return false }

export function subscribeExperience3D(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange)
  window.addEventListener('storage', onChange)
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange)
    window.removeEventListener('storage', onChange)
  }
}

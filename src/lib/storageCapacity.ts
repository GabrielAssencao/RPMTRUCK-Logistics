import 'server-only'

// Limite operacional interno. Pode ser ajustado conforme o plano contratado
// sem atrelar a aplicação a uma cota específica do provedor.
const DEFAULT_DATABASE_SOFT_LIMIT_BYTES = 500 * 1024 * 1024

export function getDatabaseSoftLimitBytes() {
  const configured = Number(process.env.DATABASE_STORAGE_SOFT_LIMIT_BYTES)
  return Number.isSafeInteger(configured) && configured > 0
    ? configured
    : DEFAULT_DATABASE_SOFT_LIMIT_BYTES
}

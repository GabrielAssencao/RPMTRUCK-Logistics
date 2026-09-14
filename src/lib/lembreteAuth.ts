import type { NextRequest } from 'next/server'
import { isAdminRole, requireAuth } from '@/lib/auth'
import { requireEmpresaAuth } from '@/lib/empresaAuth'

export async function requireLembreteAuth(request: NextRequest, escrita = false) {
  const auth = await requireAuth(request)
  if (auth.error || !auth.session) return auth
  if (isAdminRole(auth.session.role)) return auth
  return requireEmpresaAuth(request, { modulo: 'TAREFAS', acao: escrita ? 'ESCRITA' : 'LEITURA' })
}

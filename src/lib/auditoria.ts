import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

interface ContextoAuditoria {
  usuarioId?: string | null
  origem?: 'API' | 'SUPERADMIN' | 'PASSWORD_RESET' | 'PUBLIC_API'
}

interface OpcoesTransacao {
  isolationLevel?: Prisma.TransactionIsolationLevel
}

/**
 * Associa a identidade confiável da sessão à conexão da transação.
 * Os triggers do PostgreSQL leem essas variáveis com escopo apenas transacional.
 */
export function executarComAuditoria<T>(
  contexto: ContextoAuditoria,
  operacao: (tx: Prisma.TransactionClient) => Promise<T>,
  opcoes?: OpcoesTransacao,
) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`
      SELECT
        set_config('rpm.usuario_id', ${contexto.usuarioId ?? ''}, true),
        set_config('rpm.origem', ${contexto.origem ?? 'API'}, true)
    `
    return operacao(tx)
  }, opcoes)
}

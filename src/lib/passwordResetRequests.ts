import type { Prisma } from '@prisma/client'

export async function criarSolicitacaoRedefinicaoSenha(
  tx: Prisma.TransactionClient,
  email: string,
): Promise<boolean> {
  const emailNormalizado = email.trim().toLowerCase()
  const [usuarioExistente, ativa] = await Promise.all([
    tx.usuario.findUnique({ where: { email: emailNormalizado }, select: { id: true } }),
    tx.resetSenha.findFirst({
      where: { email: emailNormalizado, status: { in: ['PENDENTE', 'APROVADO'] } },
      select: { id: true, status: true, token_expira_em: true },
      orderBy: { atualizado_em: 'desc' },
    }),
  ])

  if (!usuarioExistente || ativa?.status === 'PENDENTE') return false
  if (ativa?.status === 'APROVADO' && ativa.token_expira_em && ativa.token_expira_em > new Date()) {
    return false
  }

  await tx.resetSenha.updateMany({
    where: { email: emailNormalizado, status: { in: ['PENDENTE', 'APROVADO'] } },
    data: { status: 'REJEITADO', token_hash: null, token_expira_em: null },
  })
  await tx.resetSenha.create({ data: { email: emailNormalizado, status: 'PENDENTE' } })
  return true
}

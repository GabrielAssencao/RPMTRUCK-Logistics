import bcrypt from 'bcrypt'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { applyRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rateLimit'
import { tokenResetConfere } from '@/lib/resetToken'
import { executarComAuditoria } from '@/lib/auditoria'

const schema = z.object({
  email: z.string().trim().email().max(254).toLowerCase(),
  token: z.string().trim().min(20).max(64),
  novaSenha: z.string()
    .min(10, 'A nova senha deve possuir pelo menos 10 caracteres.')
    .max(128)
    .regex(/[a-z]/, 'Inclua uma letra minúscula.')
    .regex(/[A-Z]/, 'Inclua uma letra maiúscula.')
    .regex(/[0-9]/, 'Inclua um número.'),
}).strict()

export async function POST(request: NextRequest) {
  const bloqueio = await applyRateLimit(
    request,
    `reset-confirm:${getClientIp(request)}`,
    RATE_LIMITS.PASSWORD_RESET.limit,
    RATE_LIMITS.PASSWORD_RESET.windowMs,
  )
  if (bloqueio) return bloqueio

  const parsed = schema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json(
      { erro: parsed.error.issues[0]?.message ?? 'Dados de redefinição inválidos.' },
      { status: 400 },
    )
  }

  const bloqueioConta = await applyRateLimit(
    request,
    `reset-confirm-account:${parsed.data.email}`,
    RATE_LIMITS.PASSWORD_RESET.limit,
    RATE_LIMITS.PASSWORD_RESET.windowMs,
  )
  if (bloqueioConta) return bloqueioConta

  const reset = await prisma.resetSenha.findFirst({
    where: { email: parsed.data.email, status: 'APROVADO' },
    select: { id: true, token_hash: true, token_expira_em: true },
    orderBy: { atualizado_em: 'desc' },
  })

  const agora = new Date()
  if (
    !reset?.token_hash ||
    !reset.token_expira_em ||
    reset.token_expira_em <= agora ||
    !tokenResetConfere(parsed.data.token, reset.token_hash)
  ) {
    return NextResponse.json({ erro: 'Código inválido, expirado ou já utilizado.' }, { status: 400 })
  }

  const senhaHash = await bcrypt.hash(parsed.data.novaSenha, 12)
  const usuario = await prisma.usuario.findUnique({
    where: { email: parsed.data.email },
    select: { id: true },
  })
  if (!usuario) {
    return NextResponse.json({ erro: 'Código inválido, expirado ou já utilizado.' }, { status: 400 })
  }

  try {
    await executarComAuditoria({ usuarioId: usuario.id, origem: 'PASSWORD_RESET' }, async (tx) => {
      const consumido = await tx.resetSenha.updateMany({
        where: {
          id: reset.id,
          status: 'APROVADO',
          token_hash: reset.token_hash,
          token_expira_em: { gt: agora },
        },
        data: {
          status: 'CONCLUIDO',
          token_hash: null,
          token_usado_em: agora,
          chave: null,
        },
      })
      if (consumido.count !== 1) throw new Error('TOKEN_JA_UTILIZADO')

      await tx.usuario.update({
        where: { email: parsed.data.email },
        data: {
          senha_hash: senhaHash,
          sessaoVersao: { increment: 1 },
        },
      })

      await tx.resetSenha.updateMany({
        where: {
          email: parsed.data.email,
          id: { not: reset.id },
          status: { in: ['PENDENTE', 'APROVADO'] },
        },
        data: {
          status: 'REJEITADO',
          token_hash: null,
          token_expira_em: null,
        },
      })
    })

    const response = NextResponse.json({
      sucesso: true,
      mensagem: 'Senha redefinida. Entre novamente com a nova credencial.',
    })
    response.cookies.delete('rpmtruck_session')
    return response
  } catch (error) {
    if (error instanceof Error && error.message === 'TOKEN_JA_UTILIZADO') {
      return NextResponse.json({ erro: 'Código inválido, expirado ou já utilizado.' }, { status: 409 })
    }
    console.error('Erro ao concluir redefinição de senha:', error)
    return NextResponse.json({ erro: 'Não foi possível redefinir a senha.' }, { status: 500 })
  }
}

import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { executarComAuditoria } from '@/lib/auditoria'
import { applyRateLimit, RATE_LIMITS } from '@/lib/rateLimit'
import {
  gerarTokenReset,
  hashTokenReset,
  RESET_TOKEN_TTL_MS,
} from '@/lib/resetToken'

export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const auth = await requireAdminAuth(request)
  if (auth.error || !auth.session) {
    return NextResponse.json({ erro: auth.error }, { status: auth.status })
  }
  const limited = await applyRateLimit(request, `admin-mutation:${auth.session.userId}`, RATE_LIMITS.ADMIN_MUTATION.limit, RATE_LIMITS.ADMIN_MUTATION.windowMs)
  if (limited) return limited

  const token = gerarTokenReset()
  const tokenHash = hashTokenReset(token)
  const expiraEm = new Date(Date.now() + RESET_TOKEN_TTL_MS)

  try {
    const reset = await prisma.resetSenha.findUnique({
      where: { id: params.id },
      select: { id: true, email: true, status: true },
    })
    if (!reset) {
      return NextResponse.json({ erro: 'Solicitação de segurança não encontrada.' }, { status: 404 })
    }
    if (reset.status !== 'PENDENTE') {
      return NextResponse.json({ erro: 'Esta solicitação já foi processada ou revogada.' }, { status: 409 })
    }

    await executarComAuditoria({ usuarioId: auth.session.userId, origem: 'SUPERADMIN' }, async (tx) => {
      const atualizado = await tx.resetSenha.updateMany({
        where: { id: reset.id, status: 'PENDENTE' },
        data: {
          status: 'APROVADO',
          chave: null,
          token_hash: tokenHash,
          token_expira_em: expiraEm,
          token_usado_em: null,
        },
      })
      if (atualizado.count !== 1) throw new Error('RESET_JA_PROCESSADO')

      const usuario = await tx.usuario.findUnique({
        where: { email: reset.email },
        select: { id: true, empresaId: true },
      })
      if (!usuario) throw new Error('USUARIO_RESET_NAO_ENCONTRADO')

      await tx.notificacao.create({
        data: {
          titulo: 'Redefinição de senha aprovada',
          mensagem: 'Um código de uso único foi liberado. Ele expira em 30 minutos.',
          modulo: 'GERAL',
          empresaId: usuario.empresaId,
          usuarioId: usuario.id,
        },
      })
    })

    return NextResponse.json({
      sucesso: true,
      token,
      expiraEm: expiraEm.toISOString(),
      mensagem: 'Código de uso único liberado. Ele não será armazenado nem exibido novamente.',
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'RESET_JA_PROCESSADO') {
      return NextResponse.json({ erro: 'Esta solicitação já foi processada.' }, { status: 409 })
    }
    console.error('Erro ao aprovar redefinição de senha:', error)
    return NextResponse.json({ erro: 'Não foi possível aprovar a redefinição.' }, { status: 500 })
  }
}

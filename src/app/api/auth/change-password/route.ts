import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth'
import { executarComAuditoria } from '@/lib/auditoria'
import { hashPassword, verifyPassword } from '@/lib/password'
import { applyRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rateLimit'
import { senhaForteSchema } from '@/lib/validation'
import { prisma } from '@/lib/prisma'

const schema = z.object({
  senhaAtual: z.string().min(1).max(128),
  novaSenha: senhaForteSchema,
}).strict()

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request)
  if (auth.error || !auth.session) {
    return NextResponse.json({ erro: auth.error }, { status: auth.status })
  }

  const bloqueioIp = await applyRateLimit(
    request,
    `password-change:${getClientIp(request)}`,
    RATE_LIMITS.PASSWORD_RESET_IP.limit,
    RATE_LIMITS.PASSWORD_RESET_IP.windowMs,
  )
  if (bloqueioIp) return bloqueioIp

  const bloqueioConta = await applyRateLimit(
    request,
    `password-change-account:${auth.session.userId}`,
    RATE_LIMITS.PASSWORD_RESET_ACCOUNT.limit,
    RATE_LIMITS.PASSWORD_RESET_ACCOUNT.windowMs,
  )
  if (bloqueioConta) return bloqueioConta

  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { erro: parsed.error.issues[0]?.message ?? 'Dados de alteração inválidos.' },
      { status: 400 },
    )
  }

  const usuario = await prisma.usuario.findUnique({
    where: { id: auth.session.userId },
    select: { id: true, senha_hash: true },
  })
  if (!usuario || !(await verifyPassword(parsed.data.senhaAtual, usuario.senha_hash))) {
    return NextResponse.json({ erro: 'A senha atual está incorreta.' }, { status: 400 })
  }
  if (parsed.data.novaSenha === parsed.data.senhaAtual) {
    return NextResponse.json({ erro: 'A nova senha deve ser diferente da senha atual.' }, { status: 400 })
  }

  const novoHash = await hashPassword(parsed.data.novaSenha)
  const agora = new Date()
  const alterada = await executarComAuditoria({ usuarioId: usuario.id }, async (tx) => {
    const resultado = await tx.usuario.updateMany({
      where: { id: usuario.id, senha_hash: usuario.senha_hash },
      data: {
        senha_hash: novoHash,
        exigeTrocaSenha: false,
        senhaTemporariaExpiraEm: null,
        sessaoVersao: { increment: 1 },
      },
    })
    if (resultado.count !== 1) return false
    await tx.sessaoUsuario.updateMany({
      where: { usuarioId: usuario.id, revogadaEm: null },
      data: { revogadaEm: agora },
    })
    return true
  })

  if (!alterada) {
    return NextResponse.json(
      { erro: 'A senha foi alterada em outra sessão. Entre novamente.' },
      { status: 409 },
    )
  }

  const response = NextResponse.json({
    sucesso: true,
    mensagem: 'Senha alterada. Entre novamente com a nova senha.',
  })
  response.cookies.delete('rpmtruck_session')
  return response
}

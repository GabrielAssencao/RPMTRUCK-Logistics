import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { executarComAuditoria } from '@/lib/auditoria'
import { requireEmpresaAuth } from '@/lib/empresaAuth'
import { hashPassword } from '@/lib/password'
import { prisma } from '@/lib/prisma'
import { applyRateLimit, RATE_LIMITS } from '@/lib/rateLimit'
import { gerarSenhaTemporaria, TEMPORARY_PASSWORD_TTL_MS } from '@/lib/temporaryPassword'

export async function POST(request: NextRequest, context: RouteContext<'/api/empresa/usuarios/[id]/redefinir-senha'>) {
  const auth = await requireEmpresaAuth(request)
  if (auth.error || !auth.session?.empresaId) {
    return NextResponse.json({ erro: auth.error }, { status: auth.status })
  }
  if (!['GESTOR_EMPRESA', 'GESTOR'].includes(auth.session.role)) {
    return NextResponse.json({ erro: 'Apenas o gestor pode redefinir o acesso dos operadores.' }, { status: 403 })
  }

  const { id } = await context.params
  if (id === auth.session.userId) {
    return NextResponse.json({ erro: 'Altere a senha do gestor em Configurações > Segurança.' }, { status: 400 })
  }

  const limited = await applyRateLimit(
    request,
    `operator-password-reset:${auth.session.userId}`,
    RATE_LIMITS.OPERATOR_PASSWORD_RESET.limit,
    RATE_LIMITS.OPERATOR_PASSWORD_RESET.windowMs,
  )
  if (limited) return limited
  const targetLimited = await applyRateLimit(
    request,
    `operator-password-reset-target:${auth.session.empresaId}:${id}`,
    RATE_LIMITS.PASSWORD_RESET_ACCOUNT.limit,
    RATE_LIMITS.PASSWORD_RESET_ACCOUNT.windowMs,
  )
  if (targetLimited) return targetLimited

  const usuario = await prisma.usuario.findFirst({
    where: { id, empresaId: auth.session.empresaId },
    select: { id: true, nome: true, email: true, role: true },
  })
  if (!usuario) return NextResponse.json({ erro: 'Operador não encontrado.' }, { status: 404 })
  if (usuario.role === 'GESTOR_EMPRESA' || usuario.role === 'ADMIN_RPM') {
    return NextResponse.json({ erro: 'A senha do gestor só pode ser alterada pelo próprio gestor em Configurações.' }, { status: 403 })
  }

  const senhaTemporaria = gerarSenhaTemporaria()
  const senhaHash = await hashPassword(senhaTemporaria)
  const expiraEm = new Date(Date.now() + TEMPORARY_PASSWORD_TTL_MS)
  const agora = new Date()

  try {
    await executarComAuditoria({ usuarioId: auth.session.userId }, async (tx) => {
      await tx.usuario.update({
        where: { id: usuario.id },
        data: {
          senha_hash: senhaHash,
          exigeTrocaSenha: true,
          senhaTemporariaExpiraEm: expiraEm,
          senhaAlteradaEm: agora,
          sessaoVersao: { increment: 1 },
        },
      })
      await tx.sessaoUsuario.updateMany({
        where: { usuarioId: usuario.id, revogadaEm: null },
        data: { revogadaEm: agora },
      })
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })

    return NextResponse.json({
      sucesso: true,
      mensagem: 'Acesso redefinido. Copie a senha temporária agora; ela não será exibida novamente.',
      credencialTemporaria: {
        nome: usuario.nome,
        email: usuario.email,
        senha: senhaTemporaria,
        expiraEm: expiraEm.toISOString(),
      },
    }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('Erro ao redefinir senha de operador:', error)
    return NextResponse.json({ erro: 'Não foi possível redefinir o acesso do operador.' }, { status: 500 })
  }
}

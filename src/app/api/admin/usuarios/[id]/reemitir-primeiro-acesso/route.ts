import { Prisma } from '@prisma/client'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { executarComAuditoria } from '@/lib/auditoria'
import { requireAdminAuth } from '@/lib/auth'
import { hashPassword } from '@/lib/password'
import { prisma } from '@/lib/prisma'
import { applyRateLimit, RATE_LIMITS } from '@/lib/rateLimit'
import { gerarSenhaTemporaria, TEMPORARY_PASSWORD_TTL_MS } from '@/lib/temporaryPassword'

class CredencialAlteradaConcorrentementeError extends Error {}

export async function POST(request: NextRequest, context: RouteContext<'/api/admin/usuarios/[id]/reemitir-primeiro-acesso'>) {
  const auth = await requireAdminAuth(request)
  if (auth.error || !auth.session) {
    return NextResponse.json({ erro: auth.error }, { status: auth.status })
  }

  const { id } = await context.params
  const limited = await applyRateLimit(
    request,
    `admin-first-access:${auth.session.userId}`,
    RATE_LIMITS.ADMIN_MUTATION.limit,
    RATE_LIMITS.ADMIN_MUTATION.windowMs,
  )
  if (limited) return limited
  const targetLimited = await applyRateLimit(
    request,
    `admin-first-access-target:${id}`,
    RATE_LIMITS.PASSWORD_RESET_ACCOUNT.limit,
    RATE_LIMITS.PASSWORD_RESET_ACCOUNT.windowMs,
  )
  if (targetLimited) return targetLimited

  const usuario = await prisma.usuario.findFirst({
    where: { id, empresaId: { not: null }, excluidoEm: null },
    select: {
      id: true,
      nome: true,
      email: true,
      ativo: true,
      exigeTrocaSenha: true,
      senha_hash: true,
      empresa: { select: { id: true, nome: true, excluidoEm: true } },
    },
  })
  if (!usuario || !usuario.empresa || usuario.empresa.excluidoEm) {
    return NextResponse.json({ erro: 'Usuário empresarial não encontrado.' }, { status: 404 })
  }
  if (!usuario.ativo) {
    return NextResponse.json({ erro: 'Ative a conta antes de reemitir a credencial.' }, { status: 409 })
  }
  if (!usuario.exigeTrocaSenha) {
    return NextResponse.json({ erro: 'O primeiro acesso já foi concluído. Use o fluxo de redefinição de senha.' }, { status: 409 })
  }
  const empresaId = usuario.empresa.id

  const senhaTemporaria = gerarSenhaTemporaria()
  const senhaHash = await hashPassword(senhaTemporaria)
  const agora = new Date()
  const expiraEm = new Date(agora.getTime() + TEMPORARY_PASSWORD_TTL_MS)

  try {
    await executarComAuditoria({ usuarioId: auth.session.userId, origem: 'SUPERADMIN' }, async (tx) => {
      const atualizado = await tx.usuario.updateMany({
        where: {
          id: usuario.id,
          empresaId,
          excluidoEm: null,
          ativo: true,
          exigeTrocaSenha: true,
          senha_hash: usuario.senha_hash,
        },
        data: {
          senha_hash: senhaHash,
          senhaTemporariaExpiraEm: expiraEm,
          senhaAlteradaEm: agora,
          sessaoVersao: { increment: 1 },
        },
      })
      if (atualizado.count !== 1) throw new CredencialAlteradaConcorrentementeError()
      await tx.sessaoUsuario.updateMany({
        where: { usuarioId: usuario.id, revogadaEm: null },
        data: { revogadaEm: agora },
      })
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })

    return NextResponse.json({
      sucesso: true,
      mensagem: 'Nova credencial emitida. A anterior foi invalidada.',
      credencialTemporaria: {
        nome: usuario.nome,
        email: usuario.email,
        senha: senhaTemporaria,
        expiraEm: expiraEm.toISOString(),
      },
    }, { headers: { 'Cache-Control': 'private, no-store, max-age=0' } })
  } catch (error) {
    if (error instanceof CredencialAlteradaConcorrentementeError) {
      return NextResponse.json({ erro: 'A credencial foi alterada em outra operação. Atualize a lista antes de tentar novamente.' }, { status: 409 })
    }
    console.error('Erro ao reemitir credencial de primeiro acesso:', error)
    return NextResponse.json({ erro: 'Não foi possível reemitir a credencial de primeiro acesso.' }, { status: 500 })
  }
}

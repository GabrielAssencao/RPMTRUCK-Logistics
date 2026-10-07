import { NextRequest, NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { encryptSensitive, encryptionConfigured } from '@/lib/fieldEncryption'
import { novoSegredoTotp } from '@/lib/totp'
import { applyRateLimit } from '@/lib/rateLimit'
import { recordSecurityEvent } from '@/lib/securityEvents'

export async function DELETE(request: NextRequest, context: RouteContext<'/api/admin/usuarios/[id]/mfa'>) {
  const auth = await requireAdminAuth(request)
  if (auth.error || !auth.session) return NextResponse.json({ erro: auth.error }, { status: auth.status })
  const limited = await applyRateLimit(request, `admin-mfa-reset:${auth.session.userId}`, 20, 15 * 60_000)
  if (limited) return limited
  if (!encryptionConfigured()) return NextResponse.json({ erro: 'A criptografia do MFA não está configurada.' }, { status: 503 })
  const { id } = await context.params
  const usuario = await prisma.usuario.findFirst({ where: { id, empresaId: { not: null }, excluidoEm: null }, select: { id: true, empresaId: true } })
  if (!usuario) return NextResponse.json({ erro: 'Usuário de empresa não encontrado.' }, { status: 404 })
  const agora = new Date()
  await prisma.$transaction(async tx => {
    await tx.mfaAdmin.upsert({
      where: { usuarioId: usuario.id },
      create: { usuarioId: usuario.id, segredo: encryptSensitive(novoSegredoTotp(), usuario.id, 'mfa.segredo')!, obrigatorio: true, redefinidoEm: agora },
      update: { segredo: encryptSensitive(novoSegredoTotp(), usuario.id, 'mfa.segredo')!, ativadoEm: null, ultimoContador: -1, recuperacao: [], desafioHash: null, desafioExpiraEm: null, obrigatorio: true, redefinidoEm: agora },
    })
    await tx.dispositivoConfiavel.deleteMany({ where: { usuarioId: usuario.id } })
    await tx.sessaoUsuario.updateMany({ where: { usuarioId: usuario.id, revogadaEm: null }, data: { revogadaEm: agora } })
    await tx.usuario.update({ where: { id: usuario.id }, data: { sessaoVersao: { increment: 1 } } })
  })
  await recordSecurityEvent({ tipo: 'SESSAO_REVOGADA', request, usuarioId: usuario.id, empresaId: usuario.empresaId, contexto: { motivo: 'MFA_REDEFINIDO_SUPERADMIN', administradorId: auth.session.userId } })
  return NextResponse.json({ sucesso: true, mensagem: 'MFA redefinido. O usuário configurará um novo autenticador no próximo login.' })
}

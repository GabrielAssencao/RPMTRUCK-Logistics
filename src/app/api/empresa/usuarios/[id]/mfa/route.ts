import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireEmpresaAuth } from '@/lib/empresaAuth'
import { prisma } from '@/lib/prisma'
import { encryptSensitive, encryptionConfigured } from '@/lib/fieldEncryption'
import { novoSegredoTotp } from '@/lib/totp'
import { applyRateLimit } from '@/lib/rateLimit'

const schema = z.object({ obrigatorio: z.boolean() }).strict()

export async function PATCH(request: NextRequest, context: RouteContext<'/api/empresa/usuarios/[id]/mfa'>) {
  const auth = await requireEmpresaAuth(request, { acao: 'GESTAO' })
  if (auth.error || !auth.session?.empresaId || (auth.session.role !== 'GESTOR_EMPRESA' && auth.session.role !== 'GESTOR')) {
    return NextResponse.json({ erro: auth.error || 'Apenas o gestor pode definir o MFA da equipe.' }, { status: auth.error ? auth.status : 403 })
  }
  const limited = await applyRateLimit(request, `team-mfa:${auth.session.userId}`, 20, 15 * 60_000)
  if (limited) return limited
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ erro: 'Configuração inválida.' }, { status: 400 })
  const { id } = await context.params
  const alvo = await prisma.usuario.findFirst({ where: { id, empresaId: auth.session.empresaId, excluidoEm: null, role: { in: ['OPERADOR', 'VISUALIZADOR'] } }, select: { id: true, mfaAdmin: { select: { ativadoEm: true } } } })
  if (!alvo) return NextResponse.json({ erro: 'Usuário não encontrado nesta empresa.' }, { status: 404 })
  if (parsed.data.obrigatorio) {
    if (!encryptionConfigured()) return NextResponse.json({ erro: 'A proteção criptográfica do MFA não está configurada.' }, { status: 503 })
    await prisma.mfaAdmin.upsert({
      where: { usuarioId: alvo.id },
      create: { usuarioId: alvo.id, segredo: encryptSensitive(novoSegredoTotp(), alvo.id, 'mfa.segredo')!, obrigatorio: true },
      update: { obrigatorio: true },
    })
  } else {
    await prisma.$transaction(async tx => {
      await tx.mfaAdmin.deleteMany({ where: { usuarioId: alvo.id } })
      await tx.dispositivoConfiavel.deleteMany({ where: { usuarioId: alvo.id } })
      await tx.sessaoUsuario.updateMany({ where: { usuarioId: alvo.id, revogadaEm: null }, data: { revogadaEm: new Date() } })
      await tx.usuario.update({ where: { id: alvo.id }, data: { sessaoVersao: { increment: 1 } } })
    })
  }
  return NextResponse.json({ obrigatorio: parsed.data.obrigatorio, ativo: parsed.data.obrigatorio && Boolean(alvo.mfaAdmin?.ativadoEm) })
}

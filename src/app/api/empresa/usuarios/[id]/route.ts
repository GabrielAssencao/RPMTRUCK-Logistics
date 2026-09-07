import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireEmpresaAuth } from '@/lib/empresaAuth'
import { prisma } from '@/lib/prisma'
import { executarComAuditoria } from '@/lib/auditoria'
import { hashPassword } from '@/lib/password'
import { applyRateLimit, RATE_LIMITS } from '@/lib/rateLimit'
import { MODULOS, normalizarModulos } from '@/utils/planos'

const atualizarPermissoesSchema = z.object({
  acessoDashboardGeral: z.boolean().optional(),
  ativo: z.boolean().optional(),
  role: z.enum(['OPERADOR', 'VISUALIZADOR']).optional(),
  modulosAcesso: z.array(z.enum(MODULOS)).max(MODULOS.length).optional(),
}).strict().refine((dados) => Object.keys(dados).length > 0)

async function autorizarGestao(request: NextRequest) {
  const auth = await requireEmpresaAuth(request, { acao: 'GESTAO' })
  if (auth.error || !auth.session?.empresaId || !auth.empresa) {
    return { auth: null, response: NextResponse.json({ erro: auth.error }, { status: auth.status }) }
  }
  const limited = await applyRateLimit(
    request,
    `company-user-mutation:${auth.session.empresaId}:${auth.session.userId}`,
    RATE_LIMITS.ADMIN_MUTATION.limit,
    RATE_LIMITS.ADMIN_MUTATION.windowMs,
  )
  return { auth, response: limited }
}

export async function PATCH(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const { auth, response } = await autorizarGestao(request)
  if (response) return response
  if (!auth) return NextResponse.json({ erro: 'Acesso não autorizado.' }, { status: 403 })
  if (params.id === auth.session.userId) {
    return NextResponse.json({ erro: 'Use as configurações da conta para alterar o próprio acesso.' }, { status: 400 })
  }

  const parsed = atualizarPermissoesSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ erro: 'Permissões inválidas.' }, { status: 400 })

  const usuario = await prisma.usuario.findFirst({
    where: { id: params.id, empresaId: auth.session.empresaId, excluidoEm: null },
    select: { id: true, role: true },
  })
  if (!usuario) return NextResponse.json({ erro: 'Usuário não encontrado.' }, { status: 404 })
  if (usuario.role === 'GESTOR_EMPRESA' || usuario.role === 'ADMIN_RPM') {
    return NextResponse.json({ erro: 'O acesso do gestor principal não pode ser alterado por esta tela.' }, { status: 400 })
  }

  const modulosEmpresa = normalizarModulos(auth.empresa.modulosContratados)
  const modulosSolicitados = parsed.data.modulosAcesso
    ? normalizarModulos(parsed.data.modulosAcesso)
    : undefined
  if (modulosSolicitados?.some((modulo) => !modulosEmpresa.includes(modulo))) {
    return NextResponse.json({ erro: 'Não é permitido conceder módulos fora do plano da empresa.' }, { status: 403 })
  }
  const modulosAcesso = modulosSolicitados
    ? modulosEmpresa.filter((modulo) => modulo === 'NOTIFICACOES' || modulosSolicitados.includes(modulo))
    : undefined

  const agora = new Date()
  const atualizado = await executarComAuditoria({ usuarioId: auth.session.userId }, async (tx) => {
    const resultado = await tx.usuario.update({
      where: { id: usuario.id },
      data: {
        ...parsed.data,
        ...(modulosAcesso ? { modulosAcesso } : {}),
        sessaoVersao: { increment: 1 },
      },
      select: {
        id: true,
        role: true,
        acessoDashboardGeral: true,
        ativo: true,
        modulosAcesso: true,
      },
    })
    await tx.sessaoUsuario.updateMany({
      where: { usuarioId: usuario.id, revogadaEm: null },
      data: { revogadaEm: agora },
    })
    return resultado
  })
  return NextResponse.json(atualizado)
}

export async function DELETE(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const { auth, response } = await autorizarGestao(request)
  if (response) return response
  if (!auth) return NextResponse.json({ erro: 'Acesso não autorizado.' }, { status: 403 })
  if (params.id === auth.session.userId) {
    return NextResponse.json({ erro: 'Você não pode remover a própria conta.' }, { status: 400 })
  }

  const usuario = await prisma.usuario.findFirst({
    where: { id: params.id, empresaId: auth.session.empresaId, excluidoEm: null },
    select: { id: true, role: true },
  })
  if (!usuario) return NextResponse.json({ erro: 'Usuário não encontrado.' }, { status: 404 })
  if (usuario.role === 'GESTOR_EMPRESA' || usuario.role === 'ADMIN_RPM') {
    return NextResponse.json({ erro: 'O gestor principal não pode ser removido por esta tela.' }, { status: 400 })
  }

  const agora = new Date()
  const emailAnonimo = `removido+${usuario.id}@usuarios.invalid`
  const senhaInutilizavel = await hashPassword(randomUUID())

  await executarComAuditoria({ usuarioId: auth.session.userId }, async (tx) => {
    await tx.sessaoUsuario.deleteMany({ where: { usuarioId: usuario.id } })
    await tx.notificacao.deleteMany({ where: { usuarioId: usuario.id } })
    await tx.alertaSistema.deleteMany({ where: { destinatarioId: usuario.id } })
    await tx.usuario.update({
      where: { id: usuario.id },
      data: {
        nome: 'Usuário removido',
        email: emailAnonimo,
        senha_hash: senhaInutilizavel,
        ativo: false,
        excluidoEm: agora,
        acessoDashboardGeral: false,
        modulosAcesso: [],
        exigeTrocaSenha: false,
        senhaTemporariaExpiraEm: null,
        sessaoVersao: { increment: 1 },
      },
    })
  })

  return NextResponse.json({ sucesso: true })
}

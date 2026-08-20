import type { Prisma } from '@prisma/client'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { isAdminRole, requireAuth } from '@/lib/auth'
import { requireEmpresaAuth } from '@/lib/empresaAuth'
import { criarNotificacao, escopoNotificacoes, notificarUsuariosDaEmpresa } from '@/lib/notificacoes'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const criarSchema = z.object({
  titulo: z.string().trim().min(3).max(120),
  mensagem: z.string().trim().min(3).max(1000),
  modulo: z.string().trim().min(2).max(40),
  usuarioId: z.string().uuid().optional(),
  veiculoId: z.string().uuid().optional(),
})

type ContagemPorModulo = Array<{
  modulo: string
  _count?: true | { _all?: number }
}>

function resumirPendencias(contagens: ContagemPorModulo) {
  const pendenciasPorModulo = contagens.reduce<Record<string, number>>((totais, item) => {
    totais[item.modulo] = typeof item._count === 'object' ? item._count._all ?? 0 : 0
    return totais
  }, {})

  return {
    naoLidas: Object.values(pendenciasPorModulo).reduce((total, quantidade) => total + quantidade, 0),
    pendenciasPorModulo,
  }
}

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request)
  if (auth.error || !auth.session) return NextResponse.json({ erro: auth.error }, { status: auth.status })

  if (!isAdminRole(auth.session.role)) {
    const empresaAuth = await requireEmpresaAuth(request)
    if (empresaAuth.error) return NextResponse.json({ erro: empresaAuth.error }, { status: empresaAuth.status })
  }

  const lidas = request.nextUrl.searchParams.get('lidas')
  const where: Prisma.NotificacaoWhereInput = {
    ...escopoNotificacoes(auth.session),
    ...(lidas === null ? {} : { lida: lidas === 'true' }),
  }

  const whereNaoLidas: Prisma.NotificacaoWhereInput = {
    ...escopoNotificacoes(auth.session),
    lida: false,
  }

  if (request.nextUrl.searchParams.get('resumo') === 'true') {
    const contagens = await prisma.notificacao.groupBy({
      by: ['modulo'],
      where: whereNaoLidas,
      orderBy: { modulo: 'asc' },
      _count: { _all: true },
    })

    return NextResponse.json(resumirPendencias(contagens))
  }

  const [notificacoes, contagens] = await prisma.$transaction([
    prisma.notificacao.findMany({
      where,
      include: {
        veiculo: { select: { id: true, modelo: true, placa: true } },
        tarefa: { select: { id: true, status: true, prioridade: true, prazo: true } },
      },
      orderBy: { criado_em: 'desc' },
      take: 50,
    }),
    prisma.notificacao.groupBy({
      by: ['modulo'],
      where: whereNaoLidas,
      orderBy: { modulo: 'asc' },
      _count: { _all: true },
    }),
  ])

  return NextResponse.json({ notificacoes, ...resumirPendencias(contagens), total: notificacoes.length })
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAuth(request)
  if (auth.error || !auth.session) return NextResponse.json({ erro: auth.error }, { status: auth.status })

  await prisma.notificacao.updateMany({
    where: { ...escopoNotificacoes(auth.session), lida: false },
    data: { lida: true },
  })
  return NextResponse.json({ sucesso: true })
}

export async function POST(request: NextRequest) {
  const empresaAuth = await requireEmpresaAuth(request)
  if (empresaAuth.error || !empresaAuth.session?.empresaId) {
    return NextResponse.json({ erro: empresaAuth.error }, { status: empresaAuth.status })
  }
  if (!['GESTOR_EMPRESA', 'GESTOR'].includes(empresaAuth.session.role)) {
    return NextResponse.json({ erro: 'Apenas gestores podem enviar notificações.' }, { status: 403 })
  }

  const parsed = criarSchema.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ erro: 'Dados da notificação inválidos.' }, { status: 400 })

  const { usuarioId, veiculoId, ...dados } = parsed.data
  if (usuarioId) {
    const destinatario = await prisma.usuario.findFirst({
      where: { id: usuarioId, empresaId: empresaAuth.session.empresaId },
      select: { id: true },
    })
    if (!destinatario) return NextResponse.json({ erro: 'Destinatário inválido.' }, { status: 400 })
  }
  if (veiculoId) {
    const veiculo = await prisma.veiculo.findFirst({
      where: { id: veiculoId, empresaId: empresaAuth.session.empresaId },
      select: { id: true },
    })
    if (!veiculo) return NextResponse.json({ erro: 'Veículo inválido.' }, { status: 400 })
  }

  if (!usuarioId) {
    const resultado = await notificarUsuariosDaEmpresa(empresaAuth.session.empresaId, {
      ...dados,
      veiculoId: veiculoId ?? null,
    })
    return NextResponse.json(resultado, { status: 201 })
  }

  const notificacao = await criarNotificacao({
    ...dados,
    empresaId: empresaAuth.session.empresaId,
    usuarioId,
    veiculoId: veiculoId ?? null,
  })
  return NextResponse.json(notificacao, { status: 201 })
}

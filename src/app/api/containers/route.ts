import { Prisma } from '@prisma/client'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireEmpresaAuth } from '@/lib/empresaAuth'
import { criarNotificacao } from '@/lib/notificacoes'
import { prisma } from '@/lib/prisma'

const schema = z.object({
  data: z.string().min(10),
  codigo: z.string().trim().min(4).max(30).transform((valor) => valor.toUpperCase()),
  tipo: z.string().trim().min(2).max(30),
  terminalInicio: z.string().trim().min(2).max(160),
  terminalFim: z.string().trim().min(2).max(160),
  veiculoId: z.string().uuid(),
  motoristaId: z.string().uuid().optional().nullable(),
  frete: z.coerce.number().min(0),
  comissao: z.coerce.number().min(0),
  status: z.enum(['AGENDADO', 'EM_TRANSITO', 'ENTREGUE', 'CANCELADO']),
  observacoes: z.string().trim().max(2000).optional().nullable(),
  itensConteudo: z.array(z.object({
    nome: z.string().trim().min(1).max(100),
    porcentagem: z.coerce.number().min(0).max(100),
  })).max(50).optional(),
})

function serializar(container: any) {
  return {
    id: container.id,
    data: container.data.toISOString().slice(0, 10),
    codigo: container.codigo,
    tipo: container.tipo,
    terminalInicio: container.terminal_inicio,
    terminalFim: container.terminal_fim,
    duplaId: container.veiculoId,
    veiculoId: container.veiculoId,
    motoristaId: container.motoristaId,
    frete: container.frete,
    comissao: container.comissao,
    status: container.status,
    observacoes: container.observacoes || undefined,
    itensConteudo: container.itens_conteudo || [],
  }
}
export async function GET(request: NextRequest) {
  const auth = await requireEmpresaAuth(request, { modulo: 'FROTA' })
  if (auth.error || !auth.session?.empresaId) {
    return NextResponse.json({ erro: auth.error }, { status: auth.status })
  }

  const [containers, veiculos] = await prisma.$transaction([
    prisma.container.findMany({
      where: { empresaId: auth.session.empresaId },
      orderBy: { data: 'desc' },
    }),
    prisma.veiculo.findMany({
      where: { empresaId: auth.session.empresaId },
      include: { motoristas: { select: { id: true, nome: true } } },
      orderBy: { placa: 'asc' },
    }),
  ])

  return NextResponse.json({
    containers: containers.map(serializar),
    duplas: veiculos.map((veiculo) => ({
      id: veiculo.id,
      veiculoId: veiculo.id,
      veiculoPlaca: veiculo.placa,
      veiculoModelo: veiculo.modelo,
      motoristaId: veiculo.motoristas[0]?.id || null,
      motoristaNome: veiculo.motoristas[0]?.nome || 'Sem motorista vinculado',
    })),
  })
}

export async function POST(request: NextRequest) {
  const auth = await requireEmpresaAuth(request, { modulo: 'FROTA' })
  if (auth.error || !auth.session?.empresaId) {
    return NextResponse.json({ erro: auth.error }, { status: auth.status })
  }

  const parsed = schema.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ erro: 'Dados do container inválidos.' }, { status: 400 })

  const veiculo = await prisma.veiculo.findFirst({
    where: { id: parsed.data.veiculoId, empresaId: auth.session.empresaId },
    select: { id: true },
  })
  if (!veiculo) return NextResponse.json({ erro: 'Veículo inválido.' }, { status: 400 })

  if (parsed.data.motoristaId) {
    const motorista = await prisma.motorista.findFirst({
      where: { id: parsed.data.motoristaId, empresaId: auth.session.empresaId },
      select: { id: true },
    })
    if (!motorista) return NextResponse.json({ erro: 'Motorista inválido.' }, { status: 400 })
  }

  try {
    const dataOperacao = new Date(`${parsed.data.data}T12:00:00`)
    const container = await prisma.$transaction(async (tx) => {
      const criado = await tx.container.create({
        data: {
          data: dataOperacao,
          codigo: parsed.data.codigo,
          tipo: parsed.data.tipo,
          terminal_inicio: parsed.data.terminalInicio,
          terminal_fim: parsed.data.terminalFim,
          frete: parsed.data.frete,
          comissao: parsed.data.comissao,
          status: parsed.data.status,
          observacoes: parsed.data.observacoes || null,
          itens_conteudo: parsed.data.itensConteudo || [],
          empresaId: auth.session!.empresaId!,
          veiculoId: parsed.data.veiculoId,
          motoristaId: parsed.data.motoristaId || null,
        },
      })
      await tx.movimentacaoContainerPermanente.create({
        data: {
          container_origem_id: criado.id,
          codigo_container: criado.codigo,
          terminal_origem: criado.terminal_inicio,
          terminal_destino: criado.terminal_fim,
          data_operacao: criado.data,
          empresaId: criado.empresaId,
        },
      })
      return criado
    })

    await criarNotificacao({
      titulo: 'Container registrado',
      mensagem: `${container.codigo}: ${container.terminal_inicio} → ${container.terminal_fim}.`,
      modulo: 'CONTAINERS',
      empresaId: auth.session.empresaId,
      usuarioId: auth.session.userId,
    }).catch((error) => console.error('Falha ao notificar container:', error))

    return NextResponse.json(serializar(container), { status: 201 })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json({ erro: 'Este container já possui uma operação cadastrada na mesma data.' }, { status: 409 })
    }
    console.error('Erro ao registrar container:', error)
    return NextResponse.json({ erro: 'Não foi possível registrar o container.' }, { status: 500 })
  }
}

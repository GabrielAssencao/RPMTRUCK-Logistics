import { Prisma } from '@prisma/client'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { executarComAuditoria } from '@/lib/auditoria'
import { requireEmpresaAuth } from '@/lib/empresaAuth'
import { criarOcorrenciaVeiculoSchema, dataOperacional } from '@/lib/ocorrenciaVeiculoValidation'
import { prisma } from '@/lib/prisma'
import { applyRateLimit, RATE_LIMITS } from '@/lib/rateLimit'

function serializar(ocorrencia: {
  id: string; tipo: string; titulo: string; descricao: string | null; data: Date; local: string | null
  valor: Prisma.Decimal | null; pontosCnh: number | null; status: string; criado_em: Date; atualizado_em: Date
  veiculo: { id: string; modelo: string; placa: string }; motorista: { id: string; nome: string } | null
  contaPagar: { id: string; descricao: string; valor: Prisma.Decimal; status: string } | null
  custo: { id: string } | null
}) {
  return {
    ...ocorrencia,
    data: ocorrencia.data.toISOString().slice(0, 10),
    valor: ocorrencia.valor === null ? null : Number(ocorrencia.valor),
    valorEfetivo: ocorrencia.contaPagar ? Number(ocorrencia.contaPagar.valor) : Number(ocorrencia.valor ?? 0),
  }
}

const include = {
  veiculo: { select: { id: true, modelo: true, placa: true } },
  motorista: { select: { id: true, nome: true } },
  contaPagar: { select: { id: true, descricao: true, valor: true, status: true } },
  custo: { select: { id: true } },
} satisfies Prisma.OcorrenciaVeiculoInclude

export async function GET(request: NextRequest) {
  const auth = await requireEmpresaAuth(request, { modulo: 'FROTA', acao: 'LEITURA' })
  if (auth.error || !auth.session?.empresaId) return NextResponse.json({ erro: auth.error }, { status: auth.status })
  const limited = await applyRateLimit(request, `vehicle-incidents-read:${auth.session.userId}`, RATE_LIMITS.TASK_READ.limit, RATE_LIMITS.TASK_READ.windowMs)
  if (limited) return limited

  const pagina = Math.max(1, Math.min(10_000, Number(request.nextUrl.searchParams.get('pagina')) || 1))
  const status = request.nextUrl.searchParams.get('status')
  const porPagina = 20
  const where: Prisma.OcorrenciaVeiculoWhereInput = {
    empresaId: auth.session.empresaId,
    ...(status === 'ABERTA' || status === 'EM_ANALISE' || status === 'RESOLVIDA' ? { status } : {}),
  }
  const [ocorrencias, total, veiculos, motoristas, contas] = await prisma.$transaction([
    prisma.ocorrenciaVeiculo.findMany({ where, include, orderBy: [{ data: 'desc' }, { criado_em: 'desc' }], skip: (pagina - 1) * porPagina, take: porPagina }),
    prisma.ocorrenciaVeiculo.count({ where }),
    prisma.veiculo.findMany({ where: { empresaId: auth.session.empresaId }, select: { id: true, modelo: true, placa: true }, orderBy: { modelo: 'asc' }, take: 500 }),
    prisma.motorista.findMany({ where: { empresaId: auth.session.empresaId }, select: { id: true, nome: true }, orderBy: { nome: 'asc' }, take: 500 }),
    prisma.contaPagar.findMany({ where: { empresaId: auth.session.empresaId, ocorrenciaVeiculo: null, status: { not: 'CANCELADO' } }, select: { id: true, descricao: true, valor: true, status: true, veiculoId: true, custo: { select: { id: true } } }, orderBy: { vencimento: 'desc' }, take: 200 }),
  ])
  return NextResponse.json({
    ocorrencias: ocorrencias.map(serializar), total, pagina, porPagina,
    veiculos, motoristas,
    contas: contas.map((conta) => ({ ...conta, valor: Number(conta.valor) })),
  }, { headers: { 'Cache-Control': 'private, no-store' } })
}

export async function POST(request: NextRequest) {
  const auth = await requireEmpresaAuth(request, { modulo: 'FROTA', acao: 'ESCRITA' })
  if (auth.error || !auth.session?.empresaId) return NextResponse.json({ erro: auth.error }, { status: auth.status })
  const limited = await applyRateLimit(request, `vehicle-incidents-write:${auth.session.userId}`, RATE_LIMITS.TASK_MUTATION.limit, RATE_LIMITS.TASK_MUTATION.windowMs)
  if (limited) return limited
  const parsed = criarOcorrenciaVeiculoSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ erro: parsed.error.issues[0]?.message ?? 'Revise os dados da ocorrência.' }, { status: 400 })

  const empresaId = auth.session.empresaId
  const [veiculo, motorista, conta] = await Promise.all([
    prisma.veiculo.findFirst({ where: { id: parsed.data.veiculoId, empresaId }, select: { id: true } }),
    parsed.data.motoristaId ? prisma.motorista.findFirst({ where: { id: parsed.data.motoristaId, empresaId }, select: { id: true } }) : null,
    parsed.data.contaPagarId ? prisma.contaPagar.findFirst({ where: { id: parsed.data.contaPagarId, empresaId, status: { not: 'CANCELADO' } }, select: { id: true, valor: true, status: true, veiculoId: true, custo: { select: { id: true } }, ocorrenciaVeiculo: { select: { id: true } } } }) : null,
  ])
  if (!veiculo) return NextResponse.json({ erro: 'Veículo inválido para esta empresa.' }, { status: 400 })
  if (parsed.data.motoristaId && !motorista) return NextResponse.json({ erro: 'Motorista inválido para esta empresa.' }, { status: 400 })
  if (parsed.data.contaPagarId && !conta) return NextResponse.json({ erro: 'Conta a pagar inválida para esta empresa.' }, { status: 400 })
  if (conta?.ocorrenciaVeiculo) return NextResponse.json({ erro: 'Esta conta já está vinculada a outra ocorrência.' }, { status: 409 })
  if (conta?.veiculoId && conta.veiculoId !== veiculo.id) return NextResponse.json({ erro: 'A conta selecionada pertence a outro veículo.' }, { status: 409 })

  try {
    const data = dataOperacional(parsed.data.data)
    const valorEfetivo = conta ? Number(conta.valor) : Number(parsed.data.valor ?? 0)
    const ocorrencia = await executarComAuditoria({ usuarioId: auth.session.userId }, async (tx) => {
      const criada = await tx.ocorrenciaVeiculo.create({
        data: {
          tipo: parsed.data.tipo, titulo: parsed.data.titulo, descricao: parsed.data.descricao || null,
          data, local: parsed.data.local || null, valor: valorEfetivo || null, pontosCnh: parsed.data.pontosCnh ?? null,
          empresaId, veiculoId: veiculo.id, motoristaId: motorista?.id ?? null,
          contaPagarId: conta?.id ?? null, criadoPorId: auth.session.userId,
        },
      })
      if (valorEfetivo > 0) {
        if (conta?.custo) {
          await tx.custo.update({ where: { id: conta.custo.id }, data: { ocorrenciaVeiculoId: criada.id } })
        } else {
          await tx.custo.create({
            data: {
              data, ano: data.getUTCFullYear(), mesIndex: data.getUTCMonth(),
              semanaIndex: Math.min(4, Math.floor((data.getUTCDate() - 1) / 7) + 1),
              categoria: parsed.data.tipo === 'MULTA' ? 'OUTROS' : 'MANUTENCAO',
              descricao: `Ocorrência: ${parsed.data.titulo}`, valor: valorEfetivo,
              formaPagamento: conta ? 'BOLETO' : 'A DEFINIR', status: conta?.status === 'PAGO' ? 'PAGO' : 'PENDENTE',
              empresaId, veiculoId: veiculo.id, motoristaId: motorista?.id ?? null,
              contaPagarId: conta?.id ?? null, ocorrenciaVeiculoId: criada.id,
            },
          })
        }
      }
      return tx.ocorrenciaVeiculo.findUniqueOrThrow({ where: { id: criada.id }, include })
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
    return NextResponse.json(serializar(ocorrencia), { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message === 'DATA_INVALIDA') return NextResponse.json({ erro: 'Data inválida.' }, { status: 400 })
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return NextResponse.json({ erro: 'A conta selecionada já foi vinculada.' }, { status: 409 })
    console.error('Erro ao registrar ocorrência:', error)
    return NextResponse.json({ erro: 'Não foi possível registrar a ocorrência.' }, { status: 500 })
  }
}

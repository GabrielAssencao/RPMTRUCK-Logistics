import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { executarComAuditoria } from '@/lib/auditoria'
import { conformidadeMotoristaSchema, dataSomenteDia, situacaoConformidade } from '@/lib/conformidadeMotorista'
import { requireEmpresaAuth } from '@/lib/empresaAuth'
import { prisma } from '@/lib/prisma'
import { applyRateLimit, RATE_LIMITS } from '@/lib/rateLimit'

function serializar(item: { emitidoEm: Date | null; validade: Date | null } & Record<string, unknown>) {
  return { ...item, emitidoEm: item.emitidoEm?.toISOString().slice(0, 10) ?? null, validade: item.validade?.toISOString().slice(0, 10) ?? null, situacao: situacaoConformidade(item.validade) }
}

async function autenticarMotorista(request: NextRequest, id: string, escrita = false) {
  const auth = await requireEmpresaAuth(request, { modulo: 'FROTA', acao: escrita ? 'GESTAO' : 'LEITURA' })
  if (auth.error || !auth.session?.empresaId) return { auth, response: NextResponse.json({ erro: auth.error }, { status: auth.status }), motorista: null }
  const limited = await applyRateLimit(request, `driver-compliance:${auth.session.userId}`, escrita ? RATE_LIMITS.TASK_MUTATION.limit : RATE_LIMITS.TASK_READ.limit, escrita ? RATE_LIMITS.TASK_MUTATION.windowMs : RATE_LIMITS.TASK_READ.windowMs)
  if (limited) return { auth, response: limited, motorista: null }
  const motorista = await prisma.motorista.findFirst({ where: { id, empresaId: auth.session.empresaId }, select: { id: true, nome: true } })
  if (!motorista) return { auth, response: NextResponse.json({ erro: 'Motorista não encontrado.' }, { status: 404 }), motorista: null }
  return { auth, response: null, motorista }
}

export async function GET(request: NextRequest, context: RouteContext<'/api/motoristas/[id]/conformidades'>) {
  const { id } = await context.params
  const { auth, response, motorista } = await autenticarMotorista(request, id)
  if (response || !motorista || !auth.session?.empresaId) return response ?? NextResponse.json({ erro: 'Sessão empresarial inválida.' }, { status: 403 })
  const itens = await prisma.conformidadeMotorista.findMany({ where: { motoristaId: motorista.id, empresaId: auth.session.empresaId }, orderBy: [{ validade: 'asc' }, { criado_em: 'desc' }], take: 200 })
  return NextResponse.json({ motorista, conformidades: itens.map(serializar) }, { headers: { 'Cache-Control': 'private, no-store' } })
}

export async function POST(request: NextRequest, context: RouteContext<'/api/motoristas/[id]/conformidades'>) {
  const { id } = await context.params
  const { auth, response, motorista } = await autenticarMotorista(request, id, true)
  if (response || !motorista || !auth.session?.empresaId) return response ?? NextResponse.json({ erro: 'Sessão empresarial inválida.' }, { status: 403 })
  const parsed = conformidadeMotoristaSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ erro: parsed.error.issues[0]?.message ?? 'Revise os dados de conformidade.' }, { status: 400 })
  try {
    const item = await executarComAuditoria({ usuarioId: auth.session.userId }, (tx) => tx.conformidadeMotorista.create({ data: {
      ...parsed.data, numero: parsed.data.numero || null, cargaAplicavel: parsed.data.cargaAplicavel || null,
      veiculoAplicavel: parsed.data.veiculoAplicavel || null, observacoes: parsed.data.observacoes || null,
      emitidoEm: dataSomenteDia(parsed.data.emitidoEm), validade: dataSomenteDia(parsed.data.validade),
      empresaId: auth.session!.empresaId!, motoristaId: motorista.id, criadoPorId: auth.session!.userId,
    } }))
    return NextResponse.json(serializar(item), { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message === 'DATA_INVALIDA') return NextResponse.json({ erro: 'Data inválida.' }, { status: 400 })
    console.error('Erro ao cadastrar conformidade:', error)
    return NextResponse.json({ erro: 'Não foi possível salvar a conformidade.' }, { status: 500 })
  }
}

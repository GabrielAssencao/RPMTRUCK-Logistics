import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireEmpresaAuth } from '@/lib/empresaAuth'
import { notificarUsuariosDaEmpresa } from '@/lib/notificacoes'
import { prisma } from '@/lib/prisma'

const schema = z.object({
  veiculoId: z.string().uuid(), dataAgendada: z.string().min(10), tipo: z.string().trim().min(2).max(80),
  pecas: z.string().trim().min(2).max(1000), custo: z.coerce.number().min(0), kmAtual: z.coerce.number().min(0),
  origem: z.enum(['FUTURA', 'ADMINISTRATIVA']),
})

export async function GET(request: NextRequest) {
  const auth = await requireEmpresaAuth(request, { modulo: 'FROTA' })
  if (auth.error || !auth.session?.empresaId) return NextResponse.json({ erro: auth.error }, { status: auth.status })
  const [veiculos, historico] = await prisma.$transaction([
    prisma.veiculo.findMany({ where: { empresaId: auth.session.empresaId }, orderBy: { modelo: 'asc' } }),
    prisma.historicoVeiculo.findMany({ where: { empresaId: auth.session.empresaId }, include: { veiculo: { select: { placa: true, modelo: true } } }, orderBy: { data_agendada: 'desc' } }),
  ])
  return NextResponse.json({
    veiculos: veiculos.map(v => ({ id: v.id, modelo: v.modelo, placa: v.placa, tipo: v.tipo, kmAtual: v.quilometragem, diasAntecedenciaNotificacao: v.diasAntecedenciaNotif })),
    historico: historico.map(h => ({ id: h.id, veiculoPlaca: h.veiculo.placa, veiculoModelo: h.veiculo.modelo, dataAgendada: h.data_agendada.toISOString().slice(0, 10), tipo: h.tipo, pecas: h.pecas_substituidas || h.descricao || '', custo: h.custo, kmAtual: h.km_atual, status: h.status, origem: h.origem })),
  })
}

export async function POST(request: NextRequest) {
  const auth = await requireEmpresaAuth(request, { modulo: 'FROTA' })
  if (auth.error || !auth.session?.empresaId) return NextResponse.json({ erro: auth.error }, { status: auth.status })
  const parsed = schema.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ erro: 'Dados da manutenção inválidos.' }, { status: 400 })
  const veiculo = await prisma.veiculo.findFirst({ where: { id: parsed.data.veiculoId, empresaId: auth.session.empresaId } })
  if (!veiculo) return NextResponse.json({ erro: 'Veículo inválido.' }, { status: 400 })
  const status = parsed.data.origem === 'FUTURA' ? 'PENDENTE' : 'CONCLUIDA'
  const registro = await prisma.historicoVeiculo.create({ data: { data_agendada: new Date(`${parsed.data.dataAgendada}T12:00:00`), data_conclusao: status === 'CONCLUIDA' ? new Date() : null, tipo: parsed.data.tipo, pecas_substituidas: parsed.data.pecas, custo: parsed.data.custo, km_atual: parsed.data.kmAtual, status, origem: parsed.data.origem, veiculoId: veiculo.id, empresaId: auth.session.empresaId } })
  await notificarUsuariosDaEmpresa(auth.session.empresaId, { titulo: status === 'PENDENTE' ? 'Manutenção agendada' : 'Manutenção registrada', mensagem: `${veiculo.modelo} (${veiculo.placa}) — ${parsed.data.pecas}.`, modulo: 'FROTA', veiculoId: veiculo.id }, ['GESTOR_EMPRESA'])
  return NextResponse.json({ id: registro.id, veiculoPlaca: veiculo.placa, veiculoModelo: veiculo.modelo, dataAgendada: registro.data_agendada.toISOString().slice(0, 10), tipo: registro.tipo, pecas: registro.pecas_substituidas || '', custo: registro.custo, kmAtual: registro.km_atual, status: registro.status, origem: registro.origem }, { status: 201 })
}

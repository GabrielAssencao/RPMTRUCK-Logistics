import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireEmpresaAuth } from '@/lib/empresaAuth'
import { notificarUsuariosDaEmpresa } from '@/lib/notificacoes'
import { prisma } from '@/lib/prisma'
import { dataIsoSchema, quilometragemSchema, textoOperacional, valorMonetarioSchema } from '@/lib/domainValidation'
import { executarComAuditoria } from '@/lib/auditoria'

const schema = z.object({
  veiculoId: z.string().uuid(), dataAgendada: dataIsoSchema, tipo: z.enum(['PREVENTIVA', 'CORRETIVA', 'PNEUS', 'OLEO', 'COMBUSTIVEL']),
  pecas: textoOperacional(2, 1000), custo: valorMonetarioSchema, kmAtual: quilometragemSchema,
  origem: z.enum(['FUTURA', 'ADMINISTRATIVA']),
}).strict()

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
  const auth = await requireEmpresaAuth(request, { modulo: 'FROTA', acao: 'ESCRITA' })
  if (auth.error || !auth.session?.empresaId) return NextResponse.json({ erro: auth.error }, { status: auth.status })
  const parsed = schema.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ erro: 'Dados da manutenção inválidos.' }, { status: 400 })
  const veiculo = await prisma.veiculo.findFirst({ where: { id: parsed.data.veiculoId, empresaId: auth.session.empresaId } })
  if (!veiculo) return NextResponse.json({ erro: 'Veículo inválido.' }, { status: 400 })
  const status = parsed.data.origem === 'FUTURA' ? 'PENDENTE' : 'CONCLUIDA'
  const dataAgendada = new Date(`${parsed.data.dataAgendada}T12:00:00`)
  const registro = await executarComAuditoria({ usuarioId: auth.session.userId }, async (tx) => {
    const historico = await tx.historicoVeiculo.create({ data: { data_agendada: dataAgendada, data_conclusao: status === 'CONCLUIDA' ? new Date() : null, tipo: parsed.data.tipo, pecas_substituidas: parsed.data.pecas, custo: parsed.data.custo, km_atual: parsed.data.kmAtual, status, origem: parsed.data.origem, veiculoId: veiculo.id, empresaId: auth.session!.empresaId! } })
    if (status === 'CONCLUIDA') {
      await tx.leituraQuilometragem.create({ data: { quilometragem: parsed.data.kmAtual, registrada_em: dataAgendada, origem: 'MANUTENCAO', veiculoId: veiculo.id, empresaId: auth.session!.empresaId! } })
      if (parsed.data.kmAtual > veiculo.quilometragem) await tx.veiculo.update({ where: { id: veiculo.id }, data: { quilometragem: parsed.data.kmAtual } })
    }
    return historico
  })
  await notificarUsuariosDaEmpresa(auth.session.empresaId, { titulo: status === 'PENDENTE' ? 'Manutenção agendada' : 'Manutenção registrada', mensagem: `${veiculo.modelo} (${veiculo.placa}) — ${parsed.data.pecas}.`, modulo: 'FROTA', veiculoId: veiculo.id }, ['GESTOR_EMPRESA'])
  return NextResponse.json({ id: registro.id, veiculoPlaca: veiculo.placa, veiculoModelo: veiculo.modelo, dataAgendada: registro.data_agendada.toISOString().slice(0, 10), tipo: registro.tipo, pecas: registro.pecas_substituidas || '', custo: registro.custo, kmAtual: registro.km_atual, status: registro.status, origem: registro.origem }, { status: 201 })
}

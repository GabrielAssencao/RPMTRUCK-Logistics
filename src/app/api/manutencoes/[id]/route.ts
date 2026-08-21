import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireEmpresaAuth } from '@/lib/empresaAuth'
import { prisma } from '@/lib/prisma'
import { executarComAuditoria } from '@/lib/auditoria'

const schema = z.object({ status: z.enum(['PENDENTE', 'CONCLUIDA', 'CANCELADA', 'NAO_REALIZADA']) }).strict()

export async function PATCH(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const auth = await requireEmpresaAuth(request, { modulo: 'FROTA', acao: 'ESCRITA' })
  if (auth.error || !auth.session?.empresaId) return NextResponse.json({ erro: auth.error }, { status: auth.status })
  const atual = await prisma.historicoVeiculo.findFirst({ where: { id: params.id, empresaId: auth.session.empresaId }, include: { veiculo: true } })
  if (!atual) return NextResponse.json({ erro: 'Manutenção não encontrada.' }, { status: 404 })
  if (atual.relatorioArquivoId) return NextResponse.json({ erro: 'Esta manutenção já foi arquivada e não pode mais ser alterada.' }, { status: 409 })
  const parsed = schema.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ erro: 'Status inválido.' }, { status: 400 })
  const h = await executarComAuditoria({ usuarioId: auth.session.userId }, async (tx) => {
    const dataConclusao = parsed.data.status === 'CONCLUIDA' ? new Date() : null
    const historico = await tx.historicoVeiculo.update({ where: { id: atual.id }, data: { status: parsed.data.status, data_conclusao: dataConclusao } })
    if (parsed.data.status === 'CONCLUIDA' && atual.status !== 'CONCLUIDA') {
      await tx.leituraQuilometragem.create({ data: { quilometragem: atual.km_atual, registrada_em: dataConclusao!, origem: 'MANUTENCAO', veiculoId: atual.veiculoId, empresaId: auth.session!.empresaId! } })
      if (atual.km_atual > atual.veiculo.quilometragem) await tx.veiculo.update({ where: { id: atual.veiculoId }, data: { quilometragem: atual.km_atual } })
    }
    return historico
  })
  return NextResponse.json({ id: h.id, veiculoPlaca: atual.veiculo.placa, veiculoModelo: atual.veiculo.modelo, dataAgendada: h.data_agendada.toISOString().slice(0, 10), tipo: h.tipo, pecas: h.pecas_substituidas || h.descricao || '', custo: h.custo, kmAtual: h.km_atual, status: h.status, origem: h.origem })
}

export async function DELETE(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const auth = await requireEmpresaAuth(request, { modulo: 'FROTA', acao: 'ESCRITA' })
  if (auth.error || !auth.session?.empresaId) return NextResponse.json({ erro: auth.error }, { status: auth.status })
  const atual = await prisma.historicoVeiculo.findFirst({ where: { id: params.id, empresaId: auth.session.empresaId }, select: { id: true, relatorioArquivoId: true } })
  if (!atual) return NextResponse.json({ erro: 'Manutenção não encontrada.' }, { status: 404 })
  if (atual.relatorioArquivoId) return NextResponse.json({ erro: 'Esta manutenção já foi arquivada e não pode mais ser excluída.' }, { status: 409 })
  await executarComAuditoria({ usuarioId: auth.session.userId }, (tx) => tx.historicoVeiculo.delete({ where: { id: atual.id } }))
  return NextResponse.json({ sucesso: true })
}

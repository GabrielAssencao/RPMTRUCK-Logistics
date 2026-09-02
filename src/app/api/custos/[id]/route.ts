import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireEmpresaAuth } from '@/lib/empresaAuth'
import { prisma } from '@/lib/prisma'
import { textoOperacional, valorMonetarioSchema } from '@/lib/domainValidation'
import { executarComAuditoria } from '@/lib/auditoria'

const schema = z.object({ status: z.enum(['PAGO', 'PENDENTE']).optional(), descricao: textoOperacional(3, 500).optional(), valor: valorMonetarioSchema.positive().optional() }).strict()

export async function PATCH(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const auth = await requireEmpresaAuth(request, { modulo: 'GESTAO', acao: 'ESCRITA' })
  if (auth.error || !auth.session?.empresaId) return NextResponse.json({ erro: auth.error }, { status: auth.status })
  const atual = await prisma.custo.findFirst({ where: { id: params.id, empresaId: auth.session.empresaId } })
  if (!atual) return NextResponse.json({ erro: 'Custo não encontrado.' }, { status: 404 })
  if (atual.contaPagarId) return NextResponse.json({ erro: 'Esta despesa é controlada pelo boleto de origem em Contas a Pagar.' }, { status: 409 })
  if (atual.containerId) return NextResponse.json({ erro: 'Esta comissão é controlada pelo container de origem.' }, { status: 409 })
  if (atual.relatorioArquivoId) return NextResponse.json({ erro: 'Este custo já foi arquivado e não pode mais ser alterado.' }, { status: 409 })
  const parsed = schema.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ erro: 'Alteração inválida.' }, { status: 400 })
  const custo = await executarComAuditoria({ usuarioId: auth.session.userId }, (tx) => tx.custo.update({ where: { id: atual.id }, data: parsed.data }))
  return NextResponse.json({
    ...custo,
    data: custo.data.toISOString().slice(0, 10),
    duplaId: custo.veiculoId,
    arquivado: Boolean(custo.relatorioArquivoId),
    origemContaPagar: Boolean(custo.contaPagarId),
    origemComissaoContainer: Boolean(custo.containerId),
  })
}

export async function DELETE(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const auth = await requireEmpresaAuth(request, { modulo: 'GESTAO', acao: 'ESCRITA' })
  if (auth.error || !auth.session?.empresaId) return NextResponse.json({ erro: auth.error }, { status: auth.status })
  const atual = await prisma.custo.findFirst({ where: { id: params.id, empresaId: auth.session.empresaId }, select: { id: true, relatorioArquivoId: true, contaPagarId: true, containerId: true } })
  if (!atual) return NextResponse.json({ erro: 'Custo não encontrado.' }, { status: 404 })
  if (atual.contaPagarId) return NextResponse.json({ erro: 'Esta despesa é controlada pelo boleto de origem em Contas a Pagar.' }, { status: 409 })
  if (atual.containerId) return NextResponse.json({ erro: 'Esta comissão é controlada pelo container de origem.' }, { status: 409 })
  if (atual.relatorioArquivoId) return NextResponse.json({ erro: 'Este custo já foi arquivado e não pode mais ser excluído.' }, { status: 409 })
  await executarComAuditoria({ usuarioId: auth.session.userId }, (tx) => tx.custo.delete({ where: { id: atual.id } }))
  return NextResponse.json({ sucesso: true })
}

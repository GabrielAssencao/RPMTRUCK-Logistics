import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireEmpresaAuth } from '@/lib/empresaAuth'
import { prisma } from '@/lib/prisma'

const schema = z.object({
  data: z.string().min(10).optional(),
  codigo: z.string().trim().min(4).max(30).transform((valor) => valor.toUpperCase()).optional(),
  tipo: z.string().trim().min(2).max(30).optional(),
  terminalInicio: z.string().trim().min(2).max(160).optional(),
  terminalFim: z.string().trim().min(2).max(160).optional(),
  veiculoId: z.string().uuid().optional(),
  motoristaId: z.string().uuid().nullable().optional(),
  frete: z.coerce.number().min(0).optional(),
  comissao: z.coerce.number().min(0).optional(),
  status: z.enum(['AGENDADO', 'EM_TRANSITO', 'ENTREGUE', 'CANCELADO']).optional(),
  observacoes: z.string().trim().max(2000).nullable().optional(),
  itensConteudo: z.array(z.object({
    nome: z.string().trim().min(1).max(100),
    porcentagem: z.coerce.number().min(0).max(100),
  })).max(50).optional(),
})

const serializar = (container: any) => ({
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
})

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireEmpresaAuth(request, { modulo: 'FROTA' })
  if (auth.error || !auth.session?.empresaId) {
    return NextResponse.json({ erro: auth.error }, { status: auth.status })
  }

  const atual = await prisma.container.findFirst({
    where: { id: params.id, empresaId: auth.session.empresaId },
  })
  if (!atual) return NextResponse.json({ erro: 'Container não encontrado.' }, { status: 404 })
  if (atual.relatorioArquivoId) {
    return NextResponse.json({ erro: 'Esta operação está bloqueada porque já foi incluída em um arquivo de auditoria.' }, { status: 409 })
  }

  const parsed = schema.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ erro: 'Alteração inválida.' }, { status: 400 })
  const dados = parsed.data

  const container = await prisma.$transaction(async (tx) => {
    const atualizado = await tx.container.update({
      where: { id: atual.id },
      data: {
        data: dados.data ? new Date(`${dados.data}T12:00:00`) : undefined,
        codigo: dados.codigo,
        tipo: dados.tipo,
        terminal_inicio: dados.terminalInicio,
        terminal_fim: dados.terminalFim,
        frete: dados.frete,
        comissao: dados.comissao,
        status: dados.status,
        observacoes: dados.observacoes,
        itens_conteudo: dados.itensConteudo,
        veiculoId: dados.veiculoId,
        motoristaId: dados.motoristaId,
      },
    })
    await tx.movimentacaoContainerPermanente.upsert({
      where: { container_origem_id: atualizado.id },
      create: {
        container_origem_id: atualizado.id,
        codigo_container: atualizado.codigo,
        terminal_origem: atualizado.terminal_inicio,
        terminal_destino: atualizado.terminal_fim,
        data_operacao: atualizado.data,
        empresaId: atualizado.empresaId,
      },
      update: {
        codigo_container: atualizado.codigo,
        terminal_origem: atualizado.terminal_inicio,
        terminal_destino: atualizado.terminal_fim,
        data_operacao: atualizado.data,
      },
    })
    return atualizado
  })

  return NextResponse.json(serializar(container))
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireEmpresaAuth(request, { modulo: 'FROTA' })
  if (auth.error || !auth.session?.empresaId) {
    return NextResponse.json({ erro: auth.error }, { status: auth.status })
  }

  const atual = await prisma.container.findFirst({
    where: { id: params.id, empresaId: auth.session.empresaId },
    select: { id: true, relatorioArquivoId: true },
  })
  if (!atual) return NextResponse.json({ erro: 'Container não encontrado.' }, { status: 404 })
  if (atual.relatorioArquivoId) {
    return NextResponse.json({ erro: 'Esta operação está bloqueada porque já foi incluída em um arquivo de auditoria.' }, { status: 409 })
  }

  // O registro mínimo da movimentação permanece por exigência de auditoria.
  await prisma.container.delete({ where: { id: atual.id } })
  return NextResponse.json({ sucesso: true })
}

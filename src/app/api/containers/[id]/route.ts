import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireEmpresaAuth } from '@/lib/empresaAuth'
import { prisma } from '@/lib/prisma'
import {
  calcularComissao,
  codigoContainerSchema,
  dataIsoSchema,
  nomeOperacional,
  percentualSchema,
  textoOperacional,
  valorMonetarioSchema,
} from '@/lib/domainValidation'

const schema = z.object({
  data: dataIsoSchema.optional(),
  codigo: codigoContainerSchema.optional(),
  tipo: z.enum(['20 PÉS', '40 PÉS', '40 HC', 'REEFER', 'TANQUE', 'OUTRO']).optional(),
  terminalInicio: nomeOperacional(2, 160).optional(),
  terminalFim: nomeOperacional(2, 160).optional(),
  veiculoId: z.string().uuid().optional(),
  motoristaId: z.string().uuid().nullable().optional(),
  frete: valorMonetarioSchema.optional(),
  percentualComissao: percentualSchema.optional(),
  status: z.enum(['AGENDADO', 'EM_TRANSITO', 'ENTREGUE', 'CANCELADO']).optional(),
  observacoes: textoOperacional(1, 2000).nullable().optional(),
  itensConteudo: z.array(z.object({
    nome: nomeOperacional(1, 100),
    porcentagem: percentualSchema,
  }).strict()).max(50).optional(),
}).strict().superRefine((dados, contexto) => {
  const ocupacao = dados.itensConteudo?.reduce((total, item) => total + item.porcentagem, 0) ?? 0
  if (ocupacao > 100) contexto.addIssue({ code: z.ZodIssueCode.custom, path: ['itensConteudo'], message: 'A ocupação total não pode ultrapassar 100%.' })
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
  percentualComissao: container.percentual_comissao,
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
  if (!parsed.success) return NextResponse.json({ erro: parsed.error.issues[0]?.message ?? 'Alteração inválida.' }, { status: 400 })
  const dados = parsed.data
  const terminalInicio = dados.terminalInicio ?? atual.terminal_inicio
  const terminalFim = dados.terminalFim ?? atual.terminal_fim
  if (terminalInicio.toLocaleLowerCase('pt-BR') === terminalFim.toLocaleLowerCase('pt-BR')) {
    return NextResponse.json({ erro: 'Origem e destino devem ser diferentes.' }, { status: 400 })
  }
  const frete = dados.frete ?? atual.frete
  const percentualComissao = dados.percentualComissao ?? atual.percentual_comissao

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
        comissao: dados.frete !== undefined || dados.percentualComissao !== undefined
          ? calcularComissao(frete, percentualComissao)
          : undefined,
        percentual_comissao: dados.percentualComissao,
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

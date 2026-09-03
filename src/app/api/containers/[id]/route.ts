import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireEmpresaAuth } from '@/lib/empresaAuth'
import { prisma } from '@/lib/prisma'
import { executarComAuditoria } from '@/lib/auditoria'
import { Prisma, type Container } from '@prisma/client'
import { sincronizarCustoComissaoContainer } from '@/lib/financeiro/comissoesContainer'
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
  comissaoAtiva: z.boolean().optional(),
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

const serializar = (container: Container) => ({
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
  comissaoAtiva: container.comissao_ativa,
  percentualComissao: container.percentual_comissao,
  status: container.status,
  observacoes: container.observacoes || undefined,
  itensConteudo: container.itens_conteudo || [],
})

export async function PATCH(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const auth = await requireEmpresaAuth(request, { modulo: 'FROTA', acao: 'ESCRITA' })
  if (auth.error || !auth.session?.empresaId) {
    return NextResponse.json({ erro: auth.error }, { status: auth.status })
  }

  const atual = await prisma.container.findFirst({
    where: { id: params.id, empresaId: auth.session.empresaId },
  })
  if (!atual) return NextResponse.json({ erro: 'Container não encontrado.' }, { status: 404 })
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
  const comissaoAtiva = dados.comissaoAtiva ?? atual.comissao_ativa

  try {
    const container = await executarComAuditoria({ usuarioId: auth.session.userId }, async (tx) => {
      const espelhoAtual = await tx.movimentacaoContainerPermanente.findFirst({
        where: { container_origem_id: atual.id, registro_atual: true },
        orderBy: { versao: 'desc' },
      })
      const atualizado = await tx.container.update({
        where: { id: atual.id },
        data: {
          data: dados.data ? new Date(`${dados.data}T12:00:00`) : undefined,
          codigo: dados.codigo,
          tipo: dados.tipo,
          terminal_inicio: dados.terminalInicio,
          terminal_fim: dados.terminalFim,
          frete: dados.frete,
          comissao: comissaoAtiva ? calcularComissao(frete, percentualComissao) : 0,
          comissao_ativa: dados.comissaoAtiva,
          percentual_comissao: dados.percentualComissao,
          status: dados.status,
          observacoes: dados.observacoes,
          itens_conteudo: dados.itensConteudo,
          veiculoId: dados.veiculoId,
          motoristaId: dados.motoristaId,
          // Um relatório é um retrato imutável. A edição inicia uma nova revisão
          // operacional, que volta a ficar elegível para o próximo backup.
          relatorioArquivoId: atual.relatorioArquivoId ? null : undefined,
        },
      })

      const dadosEspelho = {
        codigo_container: atualizado.codigo,
        terminal_origem: atualizado.terminal_inicio,
        terminal_destino: atualizado.terminal_fim,
        data_operacao: atualizado.data,
      }
      if (!espelhoAtual) {
        await tx.movimentacaoContainerPermanente.create({
          data: {
            container_origem_id: atualizado.id,
            versao: 1,
            registro_atual: true,
            ...dadosEspelho,
            empresaId: atualizado.empresaId,
          },
        })
      } else if (!espelhoAtual.relatorioArquivoId) {
        await tx.movimentacaoContainerPermanente.update({
          where: { id: espelhoAtual.id },
          data: dadosEspelho,
        })
      } else {
        await tx.movimentacaoContainerPermanente.update({
          where: { id: espelhoAtual.id },
          data: { registro_atual: false },
        })
        await tx.movimentacaoContainerPermanente.create({
          data: {
            container_origem_id: atualizado.id,
            versao: espelhoAtual.versao + 1,
            registro_atual: true,
            ...dadosEspelho,
            empresaId: atualizado.empresaId,
          },
        })
      }
      await sincronizarCustoComissaoContainer(tx, atualizado)
      return atualizado
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })

    return NextResponse.json(serializar(container))
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && ['P2002', 'P2034'].includes(error.code)) {
      return NextResponse.json({ erro: 'A movimentação foi alterada em outra sessão. Recarregue e tente novamente.' }, { status: 409 })
    }
    console.error('Erro ao atualizar container:', error)
    return NextResponse.json({ erro: 'Não foi possível atualizar a movimentação.' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const auth = await requireEmpresaAuth(request, { modulo: 'FROTA', acao: 'ESCRITA' })
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

  // O registro mínimo da movimentação permanece por exigência de auditoria,
  // mas deixa de ser apresentado como espelho de uma movimentação ativa.
  await executarComAuditoria({ usuarioId: auth.session.userId }, async (tx) => {
    await tx.container.delete({ where: { id: atual.id } })
    await tx.movimentacaoContainerPermanente.updateMany({
      where: { container_origem_id: atual.id, registro_atual: true },
      data: { registro_atual: false },
    })
  })
  return NextResponse.json({ sucesso: true })
}

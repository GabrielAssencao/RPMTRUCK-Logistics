import type { Container, Prisma } from '@prisma/client'

type ContainerComComissao = Pick<
  Container,
  | 'id'
  | 'data'
  | 'codigo'
  | 'comissao'
  | 'comissao_ativa'
  | 'status'
  | 'veiculoId'
  | 'motoristaId'
  | 'empresaId'
>

function periodoCusto(data: Date) {
  return {
    ano: data.getFullYear(),
    mesIndex: data.getMonth(),
    semanaIndex: Math.min(4, Math.floor((data.getDate() - 1) / 7) + 1),
  }
}

export async function sincronizarCustoComissaoContainer(
  tx: Prisma.TransactionClient,
  container: ContainerComComissao,
) {
  let custoAtual = await tx.custo.findUnique({
    where: { containerId: container.id },
    select: { id: true, relatorioArquivoId: true },
  })

  // O arquivo já gerado permanece imutável. Como ocorre com o próprio container,
  // a edição desvincula o registro operacional do relatório para uma nova revisão.
  if (custoAtual?.relatorioArquivoId) {
    await tx.custo.update({
      where: { id: custoAtual.id },
      data: { relatorioArquivoId: null },
    })
    custoAtual = { ...custoAtual, relatorioArquivoId: null }
  }

  const deveGerarCusto = container.comissao_ativa
    && container.comissao > 0
    && container.status !== 'CANCELADO'

  if (!deveGerarCusto) {
    if (custoAtual) await tx.custo.delete({ where: { id: custoAtual.id } })
    return null
  }

  const dados = {
    data: container.data,
    ...periodoCusto(container.data),
    categoria: 'COMISSAO_TRANSPORTE' as const,
    descricao: `Comissão sobre frete — Container ${container.codigo}`,
    valor: container.comissao,
    formaPagamento: 'COMISSÃO AUTOMÁTICA',
    status: container.status === 'ENTREGUE' ? 'PAGO' as const : 'PENDENTE' as const,
    veiculoId: container.veiculoId,
    motoristaId: container.motoristaId,
    empresaId: container.empresaId,
  }

  if (custoAtual) {
    return tx.custo.update({ where: { id: custoAtual.id }, data: dados })
  }

  return tx.custo.create({
    data: { ...dados, containerId: container.id },
  })
}

import type { Prisma } from '@prisma/client'

export async function liquidarFatura(
  tx: Prisma.TransactionClient,
  faturaId: string,
  dados: { pagoEm: Date; pagoPorId?: string | null; gatewayStatus?: string; gatewayNetValue?: number | null },
) {
  const atual = await tx.fatura.findUnique({ where: { id: faturaId } })
  if (!atual) throw new Error('NAO_ENCONTRADA')
  if (atual.status === 'PAGO') return atual
  const alterada = await tx.fatura.updateMany({
    where: { id: faturaId, status: 'PENDENTE' },
    data: {
      status: 'PAGO', pago_em: dados.pagoEm, pago_por_id: dados.pagoPorId ?? null,
      gatewayStatus: dados.gatewayStatus, gatewayNetValue: dados.gatewayNetValue,
      gatewaySincronizadoEm: dados.gatewayStatus ? new Date() : undefined,
      gatewayErro: dados.gatewayStatus ? null : undefined,
    },
  })
  if (alterada.count !== 1) return tx.fatura.findUniqueOrThrow({ where: { id: faturaId } })

  const fatura = await tx.fatura.findUniqueOrThrow({ where: { id: faturaId } })
  if (fatura.tipo === 'MENSALIDADE' && fatura.valor > 0) {
    await tx.empresa.updateMany({
      where: { id: fatura.empresaId, primeiraMensalidadePagaEm: null },
      data: { primeiraMensalidadePagaEm: fatura.pago_em },
    })
  }
  await atualizarTotalPago(tx, fatura.empresaId)
  return fatura
}

export async function registrarEstornoFatura(tx: Prisma.TransactionClient, faturaId: string, gatewayStatus: string) {
  const fatura = await tx.fatura.update({
    where: { id: faturaId },
    data: { status: 'ESTORNADA', pago_em: null, pago_por_id: null, gatewayStatus, gatewayRecebidoEm: null, gatewaySincronizadoEm: new Date() },
  })
  if (fatura.tipo === 'MENSALIDADE') {
    const primeiraMensalidade = await tx.fatura.findFirst({
      where: { empresaId: fatura.empresaId, tipo: 'MENSALIDADE', status: 'PAGO', valor: { gt: 0 } },
      orderBy: { pago_em: 'asc' },
      select: { pago_em: true },
    })
    await tx.empresa.update({
      where: { id: fatura.empresaId },
      data: { primeiraMensalidadePagaEm: primeiraMensalidade?.pago_em ?? null },
    })
  }
  await atualizarTotalPago(tx, fatura.empresaId)
  return fatura
}

async function atualizarTotalPago(tx: Prisma.TransactionClient, empresaId: string) {
  const total = await tx.fatura.aggregate({ where: { empresaId, status: 'PAGO' }, _sum: { valor: true } })
  await tx.empresa.update({
    where: { id: empresaId },
    data: { total_pago_historico: Number(total._sum.valor ?? 0).toFixed(2).replace('.', ',') },
  })
}

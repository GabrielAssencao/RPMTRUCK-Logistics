import 'server-only'
import { prisma } from '@/lib/prisma'
import { atualizarValorAssinaturaAsaas, inativarAssinaturaAsaas } from '@/lib/financeiro/asaas'
import {
  notificarFalhaTransicaoPromocao,
  notificarFimPromocaoRecorrencia,
} from '@/lib/financeiro/notificacoesPagamento'

const DIA_MS = 24 * 60 * 60 * 1000
export const DIAS_AVISO_FIM_PROMOCAO = 60
export const DIAS_ANTECEDENCIA_TRANSICAO = 50

function mensagemErro(error: unknown) {
  return (error instanceof Error ? error.message : 'Falha desconhecida na transição promocional.').slice(0, 500)
}

export async function processarTransicoesPromocionaisRecorrencia(agora = new Date()) {
  const limiteAviso = new Date(agora.getTime() + DIAS_AVISO_FIM_PROMOCAO * DIA_MS)
  const limiteTransicao = new Date(agora.getTime() + DIAS_ANTECEDENCIA_TRANSICAO * DIA_MS)
  const processamentoExpiradoEm = new Date(agora.getTime() - DIA_MS)
  let avisos = 0
  let solicitadas = 0
  let falhas = 0
  let suspensoesReconciliadas = 0
  let falhasSuspensao = 0

  const paraAvisar = await prisma.recorrenciaPagamento.findMany({
    where: {
      status: 'ATIVA', transicaoPromocaoStatus: 'AGENDADA', avisoPromocaoEnviadoEm: null,
      renovacaoEm: { not: null, lte: limiteAviso }, valorRenovacao: { not: null },
    },
    select: { id: true, empresaId: true, renovacaoEm: true, valorRenovacao: true },
    take: 250,
  })
  for (const recorrencia of paraAvisar) {
    if (!recorrencia.renovacaoEm || recorrencia.valorRenovacao === null) continue
    await prisma.$transaction(async tx => {
      const claim = await tx.recorrenciaPagamento.updateMany({
        where: { id: recorrencia.id, status: 'ATIVA', transicaoPromocaoStatus: 'AGENDADA', avisoPromocaoEnviadoEm: null },
        data: { avisoPromocaoEnviadoEm: agora },
      })
      if (claim.count !== 1) return
      await notificarFimPromocaoRecorrencia(tx, recorrencia.empresaId, recorrencia.renovacaoEm!, Number(recorrencia.valorRenovacao))
      avisos += 1
    })
  }

  const paraExecutar = await prisma.recorrenciaPagamento.findMany({
    where: {
      status: 'ATIVA', renovacaoEm: { not: null, lte: limiteTransicao }, valorRenovacao: { not: null },
      OR: [
        { transicaoPromocaoStatus: 'AGENDADA' },
        { transicaoPromocaoStatus: 'PROCESSANDO', transicaoPromocaoSolicitadaEm: { lte: processamentoExpiradoEm } },
      ],
    },
    include: { empresa: { select: { nome: true } } },
    take: 100,
  })
  for (const recorrencia of paraExecutar) {
    const claim = await prisma.recorrenciaPagamento.updateMany({
      where: {
        id: recorrencia.id, status: 'ATIVA',
        OR: [
          { transicaoPromocaoStatus: 'AGENDADA' },
          { transicaoPromocaoStatus: 'PROCESSANDO', transicaoPromocaoSolicitadaEm: { lte: processamentoExpiradoEm } },
        ],
      },
      data: { transicaoPromocaoStatus: 'PROCESSANDO', transicaoPromocaoSolicitadaEm: agora, transicaoPromocaoErro: null },
    })
    if (claim.count !== 1) continue
    try {
      if (!recorrencia.asaasSubscriptionId || !recorrencia.acaoFimPromocao) {
        throw new Error('A assinatura ainda não possui identificador ou ação de transição válidos.')
      }
      if (recorrencia.acaoFimPromocao === 'ATUALIZAR_VALOR') {
        await atualizarValorAssinaturaAsaas(recorrencia.asaasSubscriptionId, Number(recorrencia.valorRenovacao))
      } else {
        await inativarAssinaturaAsaas(recorrencia.asaasSubscriptionId)
      }
      solicitadas += 1
    } catch (error) {
      const erroOriginal = mensagemErro(error)
      let suspensaoConfirmadaPelaApi = false
      if (recorrencia.asaasSubscriptionId) {
        try {
          await inativarAssinaturaAsaas(recorrencia.asaasSubscriptionId)
          suspensaoConfirmadaPelaApi = true
        } catch (suspensaoError) {
          console.error('Falha ao suspender assinatura após erro de transição:', suspensaoError)
        }
      }
      await prisma.$transaction(async tx => {
        await tx.recorrenciaPagamento.update({
          where: { id: recorrencia.id },
          data: {
            status: suspensaoConfirmadaPelaApi ? 'CANCELADA' : 'FALHA',
            transicaoPromocaoStatus: 'FALHA',
            transicaoPromocaoErro: erroOriginal,
            adesaoUrl: null,
          },
        })
        await notificarFalhaTransicaoPromocao(tx, recorrencia.empresaId, recorrencia.empresa.nome, recorrencia.renovacaoEm!)
      })
      falhas += 1
    }
  }

  const paraReconciliar = await prisma.recorrenciaPagamento.findMany({
    where: { status: 'FALHA', transicaoPromocaoStatus: 'FALHA', asaasSubscriptionId: { not: null } },
    select: { id: true, asaasSubscriptionId: true },
    take: 100,
  })
  for (const recorrencia of paraReconciliar) {
    try {
      await inativarAssinaturaAsaas(recorrencia.asaasSubscriptionId!)
      const atualizada = await prisma.recorrenciaPagamento.updateMany({
        where: { id: recorrencia.id, status: 'FALHA', transicaoPromocaoStatus: 'FALHA' },
        data: { status: 'CANCELADA', adesaoUrl: null },
      })
      suspensoesReconciliadas += atualizada.count
    } catch (error) {
      console.error('Falha ao reconciliar suspensão de assinatura promocional:', error)
      falhasSuspensao += 1
    }
  }

  return { avisos, solicitadas, falhas, suspensoesReconciliadas, falhasSuspensao }
}

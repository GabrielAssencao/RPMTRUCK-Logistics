import { prisma } from '@/lib/prisma'
import { avaliarSituacaoFinanceira } from '@/lib/financeiro/situacaoFinanceira'
import { garantirMensalidadeAtual } from '@/lib/financeiro/cicloCobranca'

// A decisão é calculada em cada requisição; não depende de cron, navegador ou JWT.
export const faturasPendentesFinanceiras = {
  where: { status: 'PENDENTE' as const, valor: { gt: 0 } },
  select: { vencimento: true },
} as const

export async function verificarAcessoFinanceiro(empresaId: string) {
  await garantirMensalidadeAtual(empresaId)
  const empresa = await prisma.empresa.findFirst({
    where: { id: empresaId, excluidoEm: null },
    select: {
      plano: true, status: true, pagamentoInicialVenceEm: true, primeiraMensalidadePagaEm: true,
      faturas: faturasPendentesFinanceiras,
    },
  })
  return empresa ? avaliarSituacaoFinanceira(empresa) : { bloqueado: true, mensagem: 'Empresa não encontrada.' }
}

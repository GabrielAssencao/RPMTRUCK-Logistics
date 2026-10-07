import type { PlanoTipo, Prisma } from '@prisma/client'
import { calcularMensalidadeEmpresa, obterPlanoComercial } from '@/lib/financeiro/planosComerciais'
import { competenciaBrasil, limiteVencimentoMensal, PRAZO_PAGAMENTO_INICIAL_MS } from '@/lib/financeiro/situacaoFinanceira'

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'] as const

/**
 * Sincroniza apenas cobranças ainda pendentes. Faturas pagas e mensalidades de
 * competências anteriores nunca são reprecificadas por uma troca de plano.
 */
export async function sincronizarCobrancaEmpresa(
  tx: Prisma.TransactionClient,
  dados: {
    empresaId: string
    planoAnterior: PlanoTipo
    plano: PlanoTipo
    usuariosAdicionais: number
    veiculosAdicionais: number
    agora?: Date
  },
) {
  const agora = dados.agora ?? new Date()
  const competencia = competenciaBrasil(agora)
  const ano = competencia.ano
  const mes = MESES[competencia.mes - 1]
  const empresa = await tx.empresa.findUniqueOrThrow({ where: { id: dados.empresaId } })
  const iniciouCobranca = dados.planoAnterior === 'PREVIEW' && dados.plano !== 'PREVIEW' && !empresa.cobrancaIniciadaEm && !empresa.primeiraMensalidadePagaEm
  const prazoInicial = iniciouCobranca ? new Date(agora.getTime() + PRAZO_PAGAMENTO_INICIAL_MS) : empresa.pagamentoInicialVenceEm
  if (iniciouCobranca) await tx.empresa.update({ where: { id: empresa.id }, data: { cobrancaIniciadaEm: agora, pagamentoInicialVenceEm: prazoInicial } })
  const vencimento = !empresa.primeiraMensalidadePagaEm ? prazoInicial : empresa.cobrancaIniciadaEm ? limiteVencimentoMensal(ano, competencia.mes, empresa.diaVencimento) : null
  const [catalogo, totalFaturas] = await Promise.all([
    obterPlanoComercial(dados.plano, tx),
    tx.fatura.count({ where: { empresaId: dados.empresaId } }),
  ])
  if (!catalogo) throw new Error('CATALOGO_INVALIDO')
  const mensalidade = calcularMensalidadeEmpresa({ ...empresa, usuarios_adicionais: dados.usuariosAdicionais, veiculos_adicionais: dados.veiculosAdicionais }, catalogo, agora)
  const taxaImplantacao = Number(empresa.taxaImplantacaoContratada ?? catalogo.taxaImplantacao)

  const mensalAtual = await tx.fatura.findFirst({
    where: { empresaId: dados.empresaId, ano, mes, tipo: 'MENSALIDADE' },
    orderBy: { criado_em: 'desc' },
  })
  if (mensalAtual?.status === 'PENDENTE') {
    await tx.fatura.update({ where: { id: mensalAtual.id }, data: { valor: mensalidade, ...(iniciouCobranca ? { vencimento } : {}), gatewayErro: null } })
  } else if (mensalidade > 0 && (!mensalAtual || (iniciouCobranca && mensalAtual.status === 'PAGO' && mensalAtual.valor === 0))) {
    await tx.fatura.create({ data: { empresaId: dados.empresaId, ano, mes, tipo: 'MENSALIDADE', valor: mensalidade, vencimento } })
  }

  const mudouDePreviewParaPago = dados.planoAnterior === 'PREVIEW' && dados.plano !== 'PREVIEW'
  if ((totalFaturas === 0 || mudouDePreviewParaPago) && taxaImplantacao > 0) {
    const setupPendente = await tx.fatura.findFirst({ where: { empresaId: dados.empresaId, tipo: 'IMPLEMENTACAO', status: 'PENDENTE' } })
    if (setupPendente) {
      await tx.fatura.update({ where: { id: setupPendente.id }, data: { valor: taxaImplantacao, gatewayErro: null } })
    } else if (!await tx.fatura.findFirst({ where: { empresaId: dados.empresaId, tipo: 'IMPLEMENTACAO', status: 'PAGO' } })) {
      await tx.fatura.create({ data: { empresaId: dados.empresaId, ano, mes, tipo: 'IMPLEMENTACAO', valor: taxaImplantacao, vencimento: prazoInicial } })
    }
  } else if (dados.plano !== dados.planoAnterior) {
    // Durante o onboarding, uma implantação ainda não liquidada acompanha o plano contratado.
    await tx.fatura.updateMany({
      where: { empresaId: dados.empresaId, tipo: 'IMPLEMENTACAO', status: 'PENDENTE' },
      data: { valor: taxaImplantacao },
    })
  }

  return { mensalidade, taxaImplantacao }
}

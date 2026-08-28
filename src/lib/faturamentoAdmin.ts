import type { PlanoTipo, Prisma } from '@prisma/client'
import { calcularMensalidadePersistida, obterPlanoComercial } from '@/lib/planosComerciais'

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
  const ano = agora.getFullYear()
  const mes = MESES[agora.getMonth()]
  const [catalogo, mensalidade, totalFaturas] = await Promise.all([
    obterPlanoComercial(dados.plano, tx),
    calcularMensalidadePersistida(dados.plano, dados.usuariosAdicionais, dados.veiculosAdicionais, tx),
    tx.fatura.count({ where: { empresaId: dados.empresaId } }),
  ])
  if (!catalogo) throw new Error('CATALOGO_INVALIDO')

  const mensalAtual = await tx.fatura.findFirst({
    where: { empresaId: dados.empresaId, ano, mes, tipo: 'MENSALIDADE' },
    orderBy: { criado_em: 'desc' },
  })
  if (mensalAtual?.status === 'PENDENTE') {
    await tx.fatura.update({ where: { id: mensalAtual.id }, data: { valor: mensalidade } })
  } else if (!mensalAtual && mensalidade > 0) {
    await tx.fatura.create({ data: { empresaId: dados.empresaId, ano, mes, tipo: 'MENSALIDADE', valor: mensalidade } })
  }

  const mudouDePreviewParaPago = dados.planoAnterior === 'PREVIEW' && dados.plano !== 'PREVIEW'
  if ((totalFaturas === 0 || mudouDePreviewParaPago) && catalogo.taxaImplantacao > 0) {
    const setupPendente = await tx.fatura.findFirst({ where: { empresaId: dados.empresaId, tipo: 'IMPLEMENTACAO', status: 'PENDENTE' } })
    if (setupPendente) {
      await tx.fatura.update({ where: { id: setupPendente.id }, data: { valor: catalogo.taxaImplantacao } })
    } else {
      await tx.fatura.create({ data: { empresaId: dados.empresaId, ano, mes, tipo: 'IMPLEMENTACAO', valor: catalogo.taxaImplantacao } })
    }
  } else if (dados.plano !== dados.planoAnterior) {
    // Durante o onboarding, uma implantação ainda não liquidada acompanha o plano contratado.
    await tx.fatura.updateMany({
      where: { empresaId: dados.empresaId, tipo: 'IMPLEMENTACAO', status: 'PENDENTE' },
      data: { valor: catalogo.taxaImplantacao },
    })
  }

  return { mensalidade, taxaImplantacao: catalogo.taxaImplantacao }
}

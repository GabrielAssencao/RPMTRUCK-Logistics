import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { calcularMensalidadePersistida } from '@/lib/financeiro/planosComerciais'
import { competenciaBrasil, limiteVencimentoMensal } from '@/lib/financeiro/situacaoFinanceira'

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'] as const

/** Emite a competência atual uma vez; não reprecifica faturas ou cria retroativos. */
export async function garantirMensalidadeAtual(empresaId: string, agora = new Date()): Promise<number> {
  const { ano, mes } = competenciaBrasil(agora)
  const referencia = MESES[mes - 1]
  if (await prisma.fatura.findFirst({ where: { empresaId, ano, mes: referencia, tipo: 'MENSALIDADE' }, select: { id: true } })) return 0
  try {
    return await prisma.$transaction(async tx => {
      const empresa = await tx.empresa.findUniqueOrThrow({ where: { id: empresaId } })
      if (empresa.excluidoEm || empresa.plano === 'PREVIEW' || empresa.status === 'INATIVO' || !empresa.primeiraMensalidadePagaEm || !empresa.cobrancaIniciadaEm) return 0
      const inicio = competenciaBrasil(empresa.cobrancaIniciadaEm)
      if (ano * 12 + mes <= inicio.ano * 12 + inicio.mes) return 0
      if (await tx.fatura.findFirst({ where: { empresaId, ano, mes: referencia, tipo: 'MENSALIDADE' }, select: { id: true } })) return 0
      const valor = await calcularMensalidadePersistida(empresa.plano, empresa.usuarios_adicionais, empresa.veiculos_adicionais, tx)
      if (valor <= 0) return 0
      const vencimento = limiteVencimentoMensal(ano, mes, empresa.diaVencimento)
      await tx.fatura.create({ data: { empresaId, ano, mes: referencia, tipo: 'MENSALIDADE', valor, vencimento, chaveCobranca: `mensalidade:${empresaId}:${ano}:${mes}` } })
      const gestores = await tx.usuario.findMany({ where: { empresaId, role: 'GESTOR_EMPRESA', ativo: true, excluidoEm: null }, select: { id: true } })
      await tx.notificacao.createMany({ data: gestores.map(gestor => ({ empresaId, usuarioId: gestor.id, modulo: 'GERAL', titulo: `Mensalidade do plano: ${referencia}/${ano}`, mensagem: `${valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}, vencimento em ${new Date(vencimento.getTime() - 1).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}. Regularize com o suporte; não se trata de uma conta a pagar cadastrada na sua operação.` })) })
      return 1
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && (error.code === 'P2002' || error.code === 'P2034')) {
      if (await prisma.fatura.findFirst({ where: { empresaId, ano, mes: referencia, tipo: 'MENSALIDADE' }, select: { id: true } })) return 0
    }
    throw error
  }
}

export async function atualizarCobrancasMensais(agora = new Date()) {
  const { ano, mes } = competenciaBrasil(agora)
  let cursor: string | undefined
  let emitidas = 0
  for (;;) {
    const empresas = await prisma.empresa.findMany({
      where: { excluidoEm: null, plano: { not: 'PREVIEW' }, status: { not: 'INATIVO' }, primeiraMensalidadePagaEm: { not: null }, cobrancaIniciadaEm: { not: null }, faturas: { none: { ano, mes: MESES[mes - 1], tipo: 'MENSALIDADE' } } },
      select: { id: true }, orderBy: { id: 'asc' }, take: 100, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    })
    if (!empresas.length) break
    for (const empresa of empresas) emitidas += await garantirMensalidadeAtual(empresa.id, agora)
    cursor = empresas.at(-1)!.id
  }
  return { emitidas }
}

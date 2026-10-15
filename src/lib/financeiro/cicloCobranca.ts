import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { calcularMensalidadeEmpresa, obterPlanoComercial } from '@/lib/financeiro/planosComerciais'
import { competenciaBrasil, limiteVencimentoMensal } from '@/lib/financeiro/situacaoFinanceira'
import { configuracaoAsaas, emitirCobrancaAsaas } from '@/lib/financeiro/asaas'
import { notificarUsuariosDaEmpresa } from '@/lib/notificacoes'

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
      const catalogo = await obterPlanoComercial(empresa.plano, tx)
      if (!catalogo) throw new Error('Plano comercial não configurado.')
      const valor = calcularMensalidadeEmpresa(empresa, catalogo, agora)
      if (valor <= 0) return 0
      const vencimento = limiteVencimentoMensal(ano, mes, empresa.diaVencimento)
      await tx.fatura.create({ data: { empresaId, ano, mes: referencia, tipo: 'MENSALIDADE', valor, vencimento, chaveCobranca: `mensalidade:${empresaId}:${ano}:${mes}` } })
      return 1
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && (error.code === 'P2002' || error.code === 'P2034')) {
      if (await prisma.fatura.findFirst({ where: { empresaId, ano, mes: referencia, tipo: 'MENSALIDADE' }, select: { id: true } })) return 0
    }
    throw error
  }
}

/** Avisa uma única vez, nas 48 horas anteriores, apenas quando não há recorrência ativa. */
export async function enviarAvisosVencimentoMensalidades(agora = new Date()) {
  const limite = new Date(agora.getTime() + 2 * 86_400_000)
  const faturas = await prisma.fatura.findMany({
    where: {
      tipo: 'MENSALIDADE', status: 'PENDENTE', valor: { gt: 0 },
      lembretePagamentoEnviadoEm: null,
      vencimento: { gt: agora, lte: limite },
      empresa: {
        excluidoEm: null, status: { not: 'INATIVO' }, primeiraMensalidadePagaEm: { not: null },
        OR: [
          { recorrenciaPagamento: { is: null } },
          { recorrenciaPagamento: { is: { status: { in: ['AGUARDANDO_ADESAO', 'CANCELADA'] } } } },
          { recorrenciaPagamento: { is: { status: 'FALHA', transicaoPromocaoStatus: null } } },
        ],
      },
    },
    select: { id: true, empresaId: true, mes: true, ano: true, valor: true, vencimento: true },
    orderBy: { id: 'asc' },
    take: 500,
  })
  let enviadas = 0
  for (const fatura of faturas) {
    try {
      const criadas = await prisma.$transaction(async tx => {
        const claim = await tx.fatura.updateMany({
          where: {
            id: fatura.id, status: 'PENDENTE', lembretePagamentoEnviadoEm: null,
            vencimento: { gt: agora, lte: limite },
          },
          data: { lembretePagamentoEnviadoEm: agora },
        })
        if (claim.count !== 1) return 0
        const vencimento = fatura.vencimento!.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
        const resultado = await notificarUsuariosDaEmpresa(fatura.empresaId, {
          titulo: 'Mensalidade próxima do vencimento',
          mensagem: `${fatura.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} referente à mensalidade ${fatura.mes}/${fatura.ano} vence em ${vencimento}. O pagamento automático não está ativo; escolha a forma de pagamento em Planos e pagamentos.`,
          modulo: 'GERAL',
        }, ['GESTOR_EMPRESA'], tx)
        return resultado.count
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
      enviadas += criadas
    } catch (error) {
      console.error('Falha ao enviar aviso de vencimento da mensalidade:', fatura.id, error instanceof Error ? error.message : error)
    }
  }
  return { faturas: faturas.length, enviadas }
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

/** Emite no Asaas apenas mensalidades de ciclos posteriores ao primeiro pagamento. */
export async function emitirMensalidadesAutomaticas(agora = new Date()) {
  if (process.env.ASAAS_AUTO_ISSUE_ENABLED !== 'true' || !configuracaoAsaas().ready) {
    return { emitidas: 0, falhas: 0, desabilitada: true }
  }
  const { ano, mes } = competenciaBrasil(agora)
  let cursor: string | undefined
  let emitidas = 0
  let falhas = 0
  for (;;) {
    const faturas = await prisma.fatura.findMany({
      where: {
        ano, mes: MESES[mes - 1], tipo: 'MENSALIDADE', status: 'PENDENTE',
        chaveCobranca: { startsWith: 'mensalidade:' }, gatewayPaymentId: null,
        vencimento: { lte: new Date(agora.getTime() + 5 * 86_400_000) },
        empresa: {
          excluidoEm: null, status: { not: 'INATIVO' },
          AND: [
            { OR: [{ cnpj: { not: null } }, { cnpjHash: { not: null } }] },
            { OR: [
              { recorrenciaPagamento: { is: null } },
              { recorrenciaPagamento: { is: { status: 'CANCELADA' } } },
              { recorrenciaPagamento: { is: { status: 'FALHA', transicaoPromocaoStatus: null } } },
            ] },
          ],
          primeiraMensalidadePagaEm: { not: null }, cobrancaIniciadaEm: { not: null },
        },
      },
      select: { id: true, empresaId: true }, orderBy: { id: 'asc' }, take: 50,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    })
    if (!faturas.length) break
    for (const fatura of faturas) {
      try {
        // UNDEFINED deixa o pagador escolher Pix, boleto ou cartão no ambiente seguro do Asaas.
        await emitirCobrancaAsaas(fatura.id, fatura.empresaId, 'UNDEFINED')
        emitidas++
      } catch (error) {
        falhas++
        console.error('Falha ao emitir mensalidade automática:', fatura.id, error instanceof Error ? error.message : error)
      }
    }
    cursor = faturas.at(-1)!.id
  }
  return { emitidas, falhas, desabilitada: false }
}

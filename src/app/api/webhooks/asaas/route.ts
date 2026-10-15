import { lerCorpoLimitado, RequestBodyError } from '@/lib/requestBody'
import { createHash, timingSafeEqual } from 'node:crypto'
import { Prisma } from '@prisma/client'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { executarComAuditoria } from '@/lib/auditoria'
import { liquidarFatura, registrarEstornoFatura } from '@/lib/financeiro/faturas'
import { distribuirLiquidoCentavos, extrairIdsCobrancaConjunta, somarCentavos } from '@/lib/financeiro/referenciaCobranca'
import { desativarRecorrenciaPorInadimplencia } from '@/lib/financeiro/asaas'
import {
  notificarPagamentoConfirmado,
  notificarPagamentoEstornado,
  notificarPagamentoVencido,
  notificarFalhaTransicaoPromocao,
  notificarSituacaoRecorrencia,
  notificarTransicaoPromocaoConfirmada,
} from '@/lib/financeiro/notificacoesPagamento'

export const dynamic = 'force-dynamic'

const eventoSchema = z.object({
  id: z.string().min(3).max(160),
  event: z.string().min(3).max(120),
  payment: z.object({
    id: z.string().min(3).max(160),
    externalReference: z.string().max(160).nullish(),
    status: z.string().max(80).nullish(),
    value: z.number().nonnegative().max(9_999_999_999.99).nullish(),
    netValue: z.number().nonnegative().max(9_999_999_999.99).nullish(),
    billingType: z.string().max(40).nullish(),
    subscription: z.string().max(160).nullish(),
    checkoutSession: z.string().max(160).nullish(),
    customer: z.string().max(160).nullish(),
    dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
    confirmedDate: z.string().max(20).nullish(),
    creditDate: z.string().max(20).nullish(),
  }).passthrough(),
}).passthrough()

const eventoRecorrenciaSchema = z.object({
  id: z.string().min(3).max(160),
  event: z.enum(['CHECKOUT_PAID', 'CHECKOUT_CANCELED', 'CHECKOUT_EXPIRED', 'SUBSCRIPTION_CREATED', 'SUBSCRIPTION_UPDATED', 'SUBSCRIPTION_INACTIVATED']),
  checkout: z.object({ id: z.string().min(3).max(160), customer: z.string().max(160).nullish(), externalReference: z.string().max(160).nullish() }).passthrough().optional(),
  subscription: z.object({
    id: z.string().min(3).max(160),
    customer: z.string().max(160).nullish(),
    externalReference: z.string().max(160).nullish(),
    value: z.number().positive().max(9_999_999_999.99).nullish(),
    status: z.string().max(40).nullish(),
  }).passthrough().optional(),
}).passthrough()

function tokenValido(recebido: string | null, esperado: string | undefined) {
  if (!recebido || !esperado || esperado.length < 32) return false
  const a = Buffer.from(recebido)
  const b = Buffer.from(esperado)
  return a.length === b.length && timingSafeEqual(a, b)
}

function dataAsaas(value: string | null | undefined, fallback: Date) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return fallback
  const data = new Date(`${value}T12:00:00.000Z`)
  return !Number.isNaN(data.getTime()) && data.toISOString().slice(0, 10) === value ? data : fallback
}

export async function POST(request: NextRequest) {
  if (!tokenValido(request.headers.get('asaas-access-token'), process.env.ASAAS_WEBHOOK_TOKEN)) {
    return NextResponse.json({ erro: 'Webhook não autorizado.' }, { status: 401 })
  }
  let raw: string
  try {
    raw = new TextDecoder().decode(await lerCorpoLimitado(request, 128 * 1024))
  } catch (error) {
    if (error instanceof RequestBodyError) return NextResponse.json({ erro: error.message }, { status: error.status })
    return NextResponse.json({ erro: 'Payload inválido.' }, { status: 400 })
  }
  const json = (() => { try { return JSON.parse(raw || 'null') } catch { return null } })()
  const parsedRecorrencia = eventoRecorrenciaSchema.safeParse(json)
  if (parsedRecorrencia.success) {
    const evento = parsedRecorrencia.data
    const recurso = evento.checkout ?? evento.subscription
    if (!recurso) return NextResponse.json({ erro: 'Recurso ausente.' }, { status: 400 })
    try {
      await executarComAuditoria({ origem: 'PUBLIC_API' }, async tx => {
        await tx.eventoWebhookPagamento.create({ data: {
          id: evento.id, provedor: 'ASAAS', tipo: evento.event,
          pagamentoExternoId: recurso.id, payloadHash: createHash('sha256').update(raw).digest('hex'),
        } })
        const recorrencia = evento.checkout
          ? await tx.recorrenciaPagamento.findUnique({ where: { asaasCheckoutId: recurso.id }, include: { empresa: { select: { asaasCustomerId: true, nome: true } } } })
          : await tx.recorrenciaPagamento.findFirst({ where: { OR: [
            { asaasSubscriptionId: recurso.id },
            ...(recurso.externalReference ? [{ id: recurso.externalReference }] : []),
            ...(recurso.customer ? [{
              status: 'AGUARDANDO_ADESAO' as const,
              asaasSubscriptionId: null,
              empresa: { is: { asaasCustomerId: recurso.customer } },
            }] : []),
          ] }, include: { empresa: { select: { asaasCustomerId: true, nome: true } } } })
        let situacaoNotificar: 'ATIVADA' | 'NAO_CONCLUIDA' | 'DESATIVADA' | null = null
        let transicaoNotificar: 'ATUALIZAR_VALOR' | 'DESATIVAR_RECORRENCIA' | null = null
        let falhaTransicao = false
        if (recorrencia && (!recurso.customer || recurso.customer === recorrencia.empresa.asaasCustomerId)
          && (!recurso.externalReference || recurso.externalReference === recorrencia.id)) {
          if (evento.event === 'CHECKOUT_PAID' && recorrencia.status === 'AGUARDANDO_ADESAO') {
            await tx.recorrenciaPagamento.update({ where: { id: recorrencia.id }, data: { status: 'ATIVA' } })
            situacaoNotificar = 'ATIVADA'
          } else if (['CHECKOUT_CANCELED', 'CHECKOUT_EXPIRED'].includes(evento.event) && recorrencia.status === 'AGUARDANDO_ADESAO') {
            await tx.recorrenciaPagamento.update({ where: { id: recorrencia.id }, data: { status: 'FALHA' } })
            situacaoNotificar = 'NAO_CONCLUIDA'
          } else if (evento.event === 'SUBSCRIPTION_UPDATED'
            && recorrencia.transicaoPromocaoStatus === 'PROCESSANDO'
            && recorrencia.acaoFimPromocao === 'ATUALIZAR_VALOR') {
            const valorConfirmado = evento.subscription?.value
            if (valorConfirmado != null && recorrencia.valorRenovacao !== null
              && Math.round(valorConfirmado * 100) === Math.round(Number(recorrencia.valorRenovacao) * 100)) {
              await tx.recorrenciaPagamento.update({ where: { id: recorrencia.id }, data: {
                valor: recorrencia.valorRenovacao,
                transicaoPromocaoStatus: 'CONFIRMADA', transicaoPromocaoConfirmadaEm: new Date(), transicaoPromocaoErro: null,
              } })
              transicaoNotificar = 'ATUALIZAR_VALOR'
            } else {
              await tx.recorrenciaPagamento.update({ where: { id: recorrencia.id }, data: {
                status: 'FALHA', transicaoPromocaoStatus: 'FALHA', adesaoUrl: null,
                transicaoPromocaoErro: 'O webhook não confirmou o valor de renovação esperado.',
              } })
              falhaTransicao = true
            }
          } else if (evento.event === 'SUBSCRIPTION_INACTIVATED' && ['ATIVA', 'FALHA'].includes(recorrencia.status)) {
            const desativacaoPromocional = recorrencia.transicaoPromocaoStatus === 'PROCESSANDO'
              && recorrencia.acaoFimPromocao === 'DESATIVAR_RECORRENCIA'
            await tx.recorrenciaPagamento.update({ where: { id: recorrencia.id }, data: {
              status: 'CANCELADA', adesaoUrl: null,
              ...(desativacaoPromocional ? {
                transicaoPromocaoStatus: 'CONFIRMADA', transicaoPromocaoConfirmadaEm: new Date(), transicaoPromocaoErro: null,
              } : {}),
            } })
            if (desativacaoPromocional) transicaoNotificar = 'DESATIVAR_RECORRENCIA'
            else situacaoNotificar = 'DESATIVADA'
          } else if (evento.subscription && !recorrencia.asaasSubscriptionId) {
            await tx.recorrenciaPagamento.update({ where: { id: recorrencia.id }, data: { asaasSubscriptionId: recurso.id } })
          }
        }
        if (recorrencia && situacaoNotificar) {
          await notificarSituacaoRecorrencia(tx, recorrencia.empresaId, situacaoNotificar)
        }
        if (recorrencia && transicaoNotificar && recorrencia.renovacaoEm && recorrencia.valorRenovacao !== null) {
          await notificarTransicaoPromocaoConfirmada(
            tx, recorrencia.empresaId, transicaoNotificar, recorrencia.renovacaoEm, Number(recorrencia.valorRenovacao),
          )
        }
        if (recorrencia && falhaTransicao && recorrencia.renovacaoEm) {
          await notificarFalhaTransicaoPromocao(tx, recorrencia.empresaId, recorrencia.empresa.nome, recorrencia.renovacaoEm)
        }
        await tx.eventoWebhookPagamento.update({ where: { id: evento.id }, data: { processadoEm: new Date(), erro: recorrencia ? null : 'Recorrência não localizada.' } })
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
      return NextResponse.json({ recebido: true })
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return NextResponse.json({ recebido: true, duplicado: true })
      console.error('Falha ao processar recorrência do Asaas:', error)
      return NextResponse.json({ erro: 'Falha temporária ao processar o evento.' }, { status: 500 })
    }
  }
  const parsed = eventoSchema.safeParse(json)
  if (!parsed.success) return NextResponse.json({ erro: 'Evento inválido.' }, { status: 400 })

  const evento = parsed.data
  try {
    if (evento.event === 'PAYMENT_OVERDUE' && evento.payment.subscription) {
      await desativarRecorrenciaPorInadimplencia(evento.payment.subscription, evento.payment.customer)
    }
    const resultado = await executarComAuditoria({ origem: 'PUBLIC_API' }, async tx => {
      await tx.eventoWebhookPagamento.create({
        data: {
          id: evento.id,
          provedor: 'ASAAS',
          tipo: evento.event,
          pagamentoExternoId: evento.payment.id,
          payloadHash: createHash('sha256').update(raw).digest('hex'),
        },
      })
      const recorrencia = evento.payment.subscription || evento.payment.checkoutSession
        ? await tx.recorrenciaPagamento.findFirst({
          where: { OR: [
            ...(evento.payment.subscription ? [{ asaasSubscriptionId: evento.payment.subscription }] : []),
            ...(evento.payment.checkoutSession ? [{ asaasCheckoutId: evento.payment.checkoutSession }] : []),
          ] }, include: { empresa: { select: { asaasCustomerId: true } } },
        }) : null
      const referencia = evento.payment.externalReference
      const referenciaConjunta = referencia?.startsWith('bundle:')
      const idsConjuntos = extrairIdsCobrancaConjunta(referencia)
      const faturas = await tx.fatura.findMany({
        where: {
          OR: [
            { gatewayPaymentId: evento.payment.id },
            ...(idsConjuntos ? [{ id: { in: idsConjuntos } }] : referencia && !referenciaConjunta && !recorrencia ? [{ id: referencia }] : []),
          ],
        },
      })
      // Depois do cancelamento, cobranças já emitidas continuam válidas, mas não
      // associamos novas faturas apenas pela competência. A cobrança precisa já
      // estar vinculada pelo gatewayPaymentId para poder ser liquidada.
      if (recorrencia && recorrencia.status !== 'CANCELADA' && faturas.length === 0 && evento.payment.dueDate) {
        const [ano, numeroMes] = evento.payment.dueDate.split('-').map(Number)
        const mes = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'][numeroMes - 1]
        if (mes) {
          const fatura = await tx.fatura.findFirst({ where: { empresaId: recorrencia.empresaId, ano, mes, tipo: 'MENSALIDADE' } })
          if (fatura) faturas.push(fatura)
        }
      }
      if (recorrencia && (recorrencia.metodo !== 'CARTAO' || (recorrencia.status === 'CANCELADA' && faturas.length === 0)
        || evento.payment.customer !== recorrencia.empresa.asaasCustomerId
        || evento.payment.subscription && recorrencia.asaasSubscriptionId && evento.payment.subscription !== recorrencia.asaasSubscriptionId
        || evento.payment.checkoutSession && recorrencia.asaasCheckoutId && evento.payment.checkoutSession !== recorrencia.asaasCheckoutId
        || referencia && ![recorrencia.id, faturas[0]?.id].includes(referencia))) {
        await tx.eventoWebhookPagamento.update({ where: { id: evento.id }, data: { processadoEm: new Date(), erro: 'Recorrência divergente.' } })
        return { ignorado: true }
      }
      if (faturas.length === 0) {
        if (recorrencia && ['PAYMENT_CONFIRMED', 'PAYMENT_RECEIVED'].includes(evento.event)) {
          throw new Error('Fatura recorrente ainda não gerada; reprocessar webhook.')
        }
        await tx.eventoWebhookPagamento.update({ where: { id: evento.id }, data: { processadoEm: new Date(), erro: 'Cobrança não vinculada a uma fatura do RPM Truck.' } })
        return { ignorado: true }
      }
      const vinculoValido = idsConjuntos
        ? faturas.length === 2 && faturas.every(fatura => idsConjuntos.includes(fatura.id))
          && new Set(faturas.map(fatura => fatura.empresaId)).size === 1
          && new Set(faturas.map(fatura => fatura.tipo)).size === 2
        : !referenciaConjunta && (faturas.length === 1 && (!referencia || referencia === faturas[0].id || recorrencia?.id === referencia)
          || !referencia && faturas.length === 2 && faturas.every(fatura => fatura.gatewayPaymentId === evento.payment.id)
            && new Set(faturas.map(fatura => fatura.empresaId)).size === 1)
      if (!vinculoValido || faturas.some(fatura => fatura.gatewayPaymentId && fatura.gatewayPaymentId !== evento.payment.id)
        || recorrencia && faturas.some(fatura => fatura.empresaId !== recorrencia.empresaId)) {
        await tx.eventoWebhookPagamento.update({ where: { id: evento.id }, data: { processadoEm: new Date(), erro: 'Referência externa divergente.' } })
        return { ignorado: true }
      }
      if (recorrencia && evento.payment.subscription && !recorrencia.asaasSubscriptionId) {
        await tx.recorrenciaPagamento.update({ where: { id: recorrencia.id }, data: { asaasSubscriptionId: evento.payment.subscription } })
      }
      const totalCentavos = somarCentavos(faturas.map(fatura => fatura.valor))
      if ((['PAYMENT_CONFIRMED', 'PAYMENT_RECEIVED'].includes(evento.event) && evento.payment.value == null)
        || (evento.payment.value != null && Math.round(evento.payment.value * 100) !== totalCentavos)) {
        await tx.eventoWebhookPagamento.update({ where: { id: evento.id }, data: { processadoEm: new Date(), erro: 'Valor recebido diverge da fatura.' } })
        return { ignorado: true }
      }

      const netCentavos = evento.payment.netValue == null ? null : Math.round(evento.payment.netValue * 100)
      const partesLiquidas = distribuirLiquidoCentavos(netCentavos, faturas.map(fatura => fatura.valor))
      // No Sandbox, a ação oficial de forçar vencimento altera a dueDate e envia
      // PAYMENT_OVERDUE sem um PAYMENT_UPDATED anterior. O evento autenticado é a
      // fonte confiável para manter a regra local de bloqueio na mesma data do Asaas.
      const vencimentoAtualizado = ['PAYMENT_UPDATED', 'PAYMENT_OVERDUE'].includes(evento.event) && evento.payment.dueDate
        ? new Date(`${evento.payment.dueDate}T23:59:59-03:00`) : null
      if (vencimentoAtualizado && Number.isNaN(vencimentoAtualizado.getTime())) {
        await tx.eventoWebhookPagamento.update({ where: { id: evento.id }, data: { processadoEm: new Date(), erro: 'Vencimento inválido.' } })
        return { ignorado: true }
      }
      const liquidadas: typeof faturas = []
      const estornadas: typeof faturas = []
      const vencidasAgora = evento.event === 'PAYMENT_OVERDUE'
        ? faturas.filter(fatura => fatura.status === 'PENDENTE' && fatura.gatewayStatus !== 'OVERDUE')
        : []
      for (const [index, fatura] of faturas.entries()) {
        if ((fatura.status === 'PAGO' && !['PAYMENT_RECEIVED', 'PAYMENT_REFUNDED'].includes(evento.event))
          || (fatura.gatewayStatus === 'REFUNDED' && ['PAYMENT_CONFIRMED', 'PAYMENT_RECEIVED'].includes(evento.event))) continue
        const parcelaNet = partesLiquidas[index]
        await tx.fatura.update({
          where: { id: fatura.id },
          data: {
            provedorPagamento: 'ASAAS',
            gatewayPaymentId: evento.payment.id,
            gatewayStatus: evento.payment.status ?? evento.event.replace(/^PAYMENT_/, ''),
            gatewayBillingType: evento.payment.billingType ?? fatura.gatewayBillingType,
            gatewayNetValue: parcelaNet == null ? fatura.gatewayNetValue : parcelaNet / 100,
            gatewayRecebidoEm: evento.event === 'PAYMENT_RECEIVED'
              ? fatura.gatewayRecebidoEm ?? dataAsaas(evento.payment.creditDate, new Date()) : undefined,
            gatewaySincronizadoEm: new Date(),
            gatewayErro: null,
            ...(vencimentoAtualizado ? { vencimento: vencimentoAtualizado, pixCopiaECola: null } : {}),
          },
        })
        if (evento.event === 'PAYMENT_CONFIRMED' || evento.event === 'PAYMENT_RECEIVED') {
          await liquidarFatura(tx, fatura.id, {
            pagoEm: dataAsaas(evento.payment.confirmedDate, new Date()),
            gatewayStatus: evento.payment.status ?? 'RECEIVED',
            gatewayNetValue: parcelaNet == null ? null : parcelaNet / 100,
          })
          if (fatura.status === 'PENDENTE') liquidadas.push(fatura)
        } else if (evento.event === 'PAYMENT_REFUNDED' && fatura.status === 'PAGO') {
          await registrarEstornoFatura(tx, fatura.id, evento.payment.status ?? 'REFUNDED')
          estornadas.push(fatura)
        }
      }
      if (liquidadas.length > 0) await notificarPagamentoConfirmado(tx, liquidadas)
      if (estornadas.length > 0) await notificarPagamentoEstornado(tx, estornadas)
      if (vencidasAgora.length > 0) await notificarPagamentoVencido(tx, vencidasAgora, Boolean(evento.payment.subscription))
      await tx.eventoWebhookPagamento.update({ where: { id: evento.id }, data: { processadoEm: new Date() } })
      return { ignorado: false }
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
    return NextResponse.json({ recebido: true, ...resultado })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return NextResponse.json({ recebido: true, duplicado: true })
    console.error('Falha ao processar webhook do Asaas:', error)
    return NextResponse.json({ erro: 'Falha temporária ao processar o evento.' }, { status: 500 })
  }
}

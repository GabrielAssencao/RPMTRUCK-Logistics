import { Prisma } from '@prisma/client'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { calcularPropostaAssinatura, valoresIguaisEmCentavos } from '@/lib/financeiro/assinaturas'
import { requireAdminAuth } from '@/lib/auth'
import { executarComAuditoria } from '@/lib/auditoria'
import { textoOperacional, valorMonetarioSchema } from '@/lib/domainValidation'
import { obterPlanoComercial } from '@/lib/financeiro/planosComerciais'
import { applyRateLimit, RATE_LIMITS } from '@/lib/rateLimit'
import { obterModulosPadrao } from '@/utils/planos'
import { sincronizarCobrancaEmpresa } from '@/lib/financeiro/faturamentoAdmin'
import { AsaasError, atualizarVencimentoAsaas } from '@/lib/financeiro/asaas'
import { somarCentavos } from '@/lib/financeiro/referenciaCobranca'

const decidirSchema = z.object({
  decisao: z.enum(['APROVAR', 'REJEITAR']),
  resposta: textoOperacional(3, 1000).optional(),
  mensalidadeEsperada: valorMonetarioSchema.optional(),
}).strict()

export async function PATCH(request: NextRequest, context: RouteContext<'/api/admin/assinaturas/[id]'>) {
  const auth = await requireAdminAuth(request)
  if (auth.error || !auth.session || !auth.usuario) {
    return NextResponse.json({ erro: auth.error }, { status: auth.status })
  }

  const limited = await applyRateLimit(
    request,
    `admin-mutation:${auth.session.userId}:assinaturas`,
    RATE_LIMITS.ADMIN_MUTATION.limit,
    RATE_LIMITS.ADMIN_MUTATION.windowMs,
  )
  if (limited) return limited

  const parsed = decidirSchema.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ erro: 'Decisão inválida.' }, { status: 400 })
  if (parsed.data.decisao === 'REJEITAR' && !parsed.data.resposta) {
    return NextResponse.json({ erro: 'Informe o motivo da rejeição.' }, { status: 400 })
  }
  if (parsed.data.decisao === 'APROVAR' && parsed.data.mensalidadeEsperada === undefined) {
    return NextResponse.json({ erro: 'Confirme a mensalidade calculada antes de aprovar.' }, { status: 400 })
  }

  const { id } = await context.params

  try {
    const resultado = await executarComAuditoria(
      { usuarioId: auth.session.userId, origem: 'SUPERADMIN' },
      async (tx) => {
        const solicitacao = await tx.solicitacaoAssinatura.findUnique({
          where: { id },
          include: {
            empresa: {
              include: { _count: { select: { usuarios: true, veiculos_frota: true } } },
            },
            fatura: { select: { id: true, status: true, gatewayPaymentId: true, gatewayStatus: true } },
          },
        })
        if (!solicitacao) throw new Error('NAO_ENCONTRADA')
        if (solicitacao.status !== 'PENDENTE') throw new Error('JA_PROCESSADA')

        if (parsed.data.decisao === 'REJEITAR') {
          const atualizada = await tx.solicitacaoAssinatura.updateMany({
            where: { id, status: 'PENDENTE' },
            data: {
              status: 'REJEITADA',
              respostaAdmin: parsed.data.resposta,
              decididoPorId: auth.session!.userId,
              decididoPorNome: auth.usuario!.nome,
              decidido_em: new Date(),
            },
          })
          if (atualizada.count !== 1) throw new Error('JA_PROCESSADA')

          if (solicitacao.criadoPorId) {
            await tx.notificacao.create({
              data: {
                titulo: 'Solicitação de assinatura não aprovada',
                mensagem: parsed.data.resposta!,
                modulo: 'ASSINATURA',
                empresaId: solicitacao.empresaId,
                usuarioId: solicitacao.criadoPorId,
              },
            })
          }
          return { status: 'REJEITADA' as const }
        }

        const impactoVencimento = solicitacao.tipo === 'ALTERAR_VENCIMENTO'
          && solicitacao.impacto && typeof solicitacao.impacto === 'object' && !Array.isArray(solicitacao.impacto)
          ? solicitacao.impacto : null
        const diaVencimentoAtual = impactoVencimento && 'diaVencimentoAtual' in impactoVencimento
          ? impactoVencimento.diaVencimentoAtual : null
        const diaVencimentoProposto = impactoVencimento && 'diaVencimentoProposto' in impactoVencimento
          ? impactoVencimento.diaVencimentoProposto : null

        if (solicitacao.tipo === 'ALTERAR_VENCIMENTO') {
          if (diaVencimentoAtual !== solicitacao.empresa.diaVencimento) throw new Error('ESTADO_ALTERADO')
          if (typeof diaVencimentoProposto !== 'number' || !Number.isInteger(diaVencimentoProposto) || diaVencimentoProposto < 1 || diaVencimentoProposto > 28 || diaVencimentoProposto === solicitacao.empresa.diaVencimento) {
            throw new Error('DIA_VENCIMENTO_INVALIDO')
          }
        } else if (solicitacao.tipo !== 'NEGOCIAR_PAGAMENTO') {
          const estadoAlterado = solicitacao.empresa.plano !== solicitacao.planoAtual
            || solicitacao.empresa.usuarios_adicionais !== solicitacao.usuariosAdicionaisAtuais
            || solicitacao.empresa.veiculos_adicionais !== solicitacao.veiculosAdicionaisAtuais
          if (estadoAlterado) throw new Error('ESTADO_ALTERADO')
        } else if (!solicitacao.fatura || solicitacao.fatura.status !== 'PENDENTE') {
          throw new Error('FATURA_INVALIDA')
        }

        const planoDestino = solicitacao.planoSolicitado ?? solicitacao.empresa.plano
        const [catalogoAtual, catalogoDestino] = await Promise.all([
          obterPlanoComercial(solicitacao.empresa.plano, tx),
          obterPlanoComercial(planoDestino, tx),
        ])
        if (!catalogoAtual || !catalogoDestino || !catalogoDestino.ativo) {
          throw new Error('CATALOGO_INVALIDO')
        }

        const proposta = calcularPropostaAssinatura(
          {
            plano: solicitacao.empresa.plano,
            modulos: solicitacao.empresa.modulos,
            usuariosAdicionais: solicitacao.empresa.usuarios_adicionais,
            veiculosAdicionais: solicitacao.empresa.veiculos_adicionais,
            totalUsuarios: solicitacao.empresa._count.usuarios,
            totalVeiculos: solicitacao.empresa._count.veiculos_frota,
          },
          {
            plano: planoDestino,
            usuariosAdicionais: solicitacao.tipo === 'NEGOCIAR_PAGAMENTO'
              ? solicitacao.empresa.usuarios_adicionais
              : solicitacao.usuariosAdicionaisSolicitados,
            veiculosAdicionais: solicitacao.tipo === 'NEGOCIAR_PAGAMENTO'
              ? solicitacao.empresa.veiculos_adicionais
              : solicitacao.veiculosAdicionaisSolicitados,
          },
          catalogoAtual,
          catalogoDestino,
        )

        if (!valoresIguaisEmCentavos(parsed.data.mensalidadeEsperada!, proposta.mensalidadeProposta)) {
          throw new Error('PRECO_ALTERADO')
        }
        if ((solicitacao.tipo === 'ALTERAR_VENCIMENTO'
          || (solicitacao.tipo !== 'NEGOCIAR_PAGAMENTO'
          && (planoDestino !== solicitacao.empresa.plano
            || solicitacao.usuariosAdicionaisSolicitados !== solicitacao.empresa.usuarios_adicionais
            || solicitacao.veiculosAdicionaisSolicitados !== solicitacao.empresa.veiculos_adicionais)))
          && await tx.recorrenciaPagamento.findFirst({
            where: { empresaId: solicitacao.empresaId, status: { in: ['AGUARDANDO_ADESAO', 'ATIVA'] } }, select: { id: true },
          })) throw new Error('RECORRENCIA_ATIVA')
        if (proposta.bloqueios.length > 0) throw new Error('LIMITES_EXCEDIDOS')

        const impactoNegociacao = solicitacao.tipo === 'NEGOCIAR_PAGAMENTO'
          && solicitacao.impacto && typeof solicitacao.impacto === 'object' && !Array.isArray(solicitacao.impacto)
          ? solicitacao.impacto : null
        const dataSolicitada = impactoNegociacao && 'vencimentoProposto' in impactoNegociacao
          ? impactoNegociacao.vencimentoProposto : null
        if (dataSolicitada != null) {
          if (typeof dataSolicitada !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dataSolicitada)) throw new Error('DATA_INVALIDA')
          const novoVencimento = new Date(`${dataSolicitada}T23:59:59-03:00`)
          if (Number.isNaN(novoVencimento.getTime()) || novoVencimento <= new Date()) throw new Error('DATA_INVALIDA')
          if (!solicitacao.fatura || solicitacao.fatura.gatewayStatus === 'CREATING') throw new Error('FATURA_INVALIDA')
          const faturasDaCobranca = solicitacao.fatura.gatewayPaymentId
            ? await tx.fatura.findMany({ where: { empresaId: solicitacao.empresaId, gatewayPaymentId: solicitacao.fatura.gatewayPaymentId } })
            : await tx.fatura.findMany({ where: { id: solicitacao.fatura.id, empresaId: solicitacao.empresaId } })
          if (faturasDaCobranca.length < 1 || faturasDaCobranca.length > 2 || faturasDaCobranca.some(fatura => fatura.status !== 'PENDENTE')) throw new Error('FATURA_INVALIDA')
          if (solicitacao.fatura.gatewayPaymentId) {
            const billingType = faturasDaCobranca[0].gatewayBillingType
            if (!billingType) throw new Error('FATURA_INVALIDA')
            const totalCentavos = somarCentavos(faturasDaCobranca.map(fatura => fatura.valor))
            await atualizarVencimentoAsaas(solicitacao.fatura.gatewayPaymentId, dataSolicitada, billingType, totalCentavos)
          }
          await tx.fatura.updateMany({ where: { id: { in: faturasDaCobranca.map(fatura => fatura.id) }, empresaId: solicitacao.empresaId }, data: { vencimento: novoVencimento, pixCopiaECola: null } })
          if (solicitacao.empresa.status === 'INADIMPLENTE') {
            const outrasVencidas = await tx.fatura.count({ where: { empresaId: solicitacao.empresaId, status: 'PENDENTE', valor: { gt: 0 }, vencimento: { lte: new Date() } } })
            if (outrasVencidas === 0) await tx.empresa.update({ where: { id: solicitacao.empresaId }, data: { status: 'ATIVO' } })
          }
        }

        const atualizada = await tx.solicitacaoAssinatura.updateMany({
          where: { id, status: 'PENDENTE' },
          data: {
            status: 'APROVADA',
            mensalidadeProposta: proposta.mensalidadeProposta,
            catalogoVersao: catalogoDestino.versao,
            impacto: solicitacao.tipo === 'NEGOCIAR_PAGAMENTO' || solicitacao.tipo === 'ALTERAR_VENCIMENTO'
              ? (solicitacao.impacto ?? Prisma.JsonNull)
              : proposta.impacto,
            respostaAdmin: parsed.data.resposta ?? 'Solicitação aprovada.',
            decididoPorId: auth.session!.userId,
            decididoPorNome: auth.usuario!.nome,
            decidido_em: new Date(),
          },
        })
        if (atualizada.count !== 1) throw new Error('JA_PROCESSADA')

        if (solicitacao.tipo === 'ALTERAR_PLANO') {
          await tx.empresa.update({
            where: { id: solicitacao.empresaId },
            data: { plano: planoDestino, modulos: obterModulosPadrao(planoDestino) },
          })
        } else if (solicitacao.tipo === 'ALTERAR_COTAS') {
          await tx.empresa.update({
            where: { id: solicitacao.empresaId },
            data: {
              usuarios_adicionais: solicitacao.usuariosAdicionaisSolicitados,
              veiculos_adicionais: solicitacao.veiculosAdicionaisSolicitados,
            },
          })
        } else if (solicitacao.tipo === 'ALTERAR_VENCIMENTO') {
          await tx.empresa.update({
            where: { id: solicitacao.empresaId },
            data: { diaVencimento: diaVencimentoProposto as number },
          })
        }

        if (solicitacao.tipo === 'ALTERAR_PLANO' || solicitacao.tipo === 'ALTERAR_COTAS') {
          await sincronizarCobrancaEmpresa(tx, {
            empresaId: solicitacao.empresaId,
            planoAnterior: solicitacao.empresa.plano,
            plano: planoDestino,
            usuariosAdicionais: solicitacao.tipo === 'ALTERAR_COTAS'
              ? solicitacao.usuariosAdicionaisSolicitados
              : solicitacao.empresa.usuarios_adicionais,
            veiculosAdicionais: solicitacao.tipo === 'ALTERAR_COTAS'
              ? solicitacao.veiculosAdicionaisSolicitados
              : solicitacao.empresa.veiculos_adicionais,
          })
        }

        if (solicitacao.criadoPorId) {
          await tx.notificacao.create({
            data: {
              titulo: 'Solicitação de assinatura aprovada',
              mensagem: parsed.data.resposta ?? 'A alteração solicitada foi aprovada pelo SuperAdmin.',
              modulo: 'ASSINATURA',
              empresaId: solicitacao.empresaId,
              usuarioId: solicitacao.criadoPorId,
            },
          })
        }

        return { status: 'APROVADA' as const, mensalidade: proposta.mensalidadeProposta }
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 25_000 },
    )

    return NextResponse.json({ sucesso: true, ...resultado })
  } catch (error) {
    if (error instanceof AsaasError) return NextResponse.json({ erro: error.message }, { status: error.status })
    const codigo = error instanceof Error ? error.message : ''
    const conflitos: Record<string, string> = {
      NAO_ENCONTRADA: 'Solicitação não encontrada.',
      JA_PROCESSADA: 'A solicitação já foi processada.',
      ESTADO_ALTERADO: 'A assinatura da empresa mudou após o pedido. Solicite uma nova análise.',
      CATALOGO_INVALIDO: 'O plano comercial não está disponível.',
      PRECO_ALTERADO: 'O catálogo de preços mudou. Recarregue a tela antes de aprovar.',
      RECORRENCIA_ATIVA: 'Encerre o pagamento automático antes de aprovar uma mudança de preço, plano, cotas ou dia de vencimento.',
      LIMITES_EXCEDIDOS: 'A empresa ainda excede os limites do plano solicitado.',
      FATURA_INVALIDA: 'A fatura desta negociação não está mais pendente.',
      DATA_INVALIDA: 'A data solicitada expirou ou é inválida. Peça uma nova proposta.',
      DIA_VENCIMENTO_INVALIDO: 'O dia solicitado precisa estar entre 1 e 28 e ser diferente do atual.',
      COBRANCA_JA_EMITIDA: 'Já existe uma cobrança para esta fatura. Ajuste ou cancele a cobrança no Asaas antes de aprovar outra data.',
    }
    if (conflitos[codigo]) {
      const status = codigo === 'NAO_ENCONTRADA' ? 404 : 409
      return NextResponse.json({ erro: conflitos[codigo] }, { status })
    }
    console.error('Erro ao decidir solicitação de assinatura:', error)
    return NextResponse.json({ erro: 'Não foi possível processar a solicitação.' }, { status: 500 })
  }
}

import { Prisma } from '@prisma/client'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdminAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { notificarAdmins, notificarUsuariosDaEmpresa } from '@/lib/notificacoes'
import { executarComAuditoria } from '@/lib/auditoria'
import { applyRateLimit, RATE_LIMITS } from '@/lib/rateLimit'
import {
  MODULOS,
  normalizarModulos,
  obterModulosPadrao,
  PLANOS,
  STATUS_EMPRESA,
  adicionaisPadraoNaTrocaDePlano,
} from '@/utils/planos'
import { sincronizarCobrancaEmpresa } from '@/lib/financeiro/faturamentoAdmin'
import { avaliarSituacaoFinanceira } from '@/lib/financeiro/situacaoFinanceira'

const atualizarEmpresaSchema = z.object({
  plano: z.enum(PLANOS).optional(),
  diaVencimento: z.number().int().min(1).max(28).optional(),
  status: z.enum(STATUS_EMPRESA).optional(),
  status_motivo: z.string().trim().max(500).nullable().optional(),
  modulos: z.array(z.enum(MODULOS)).max(MODULOS.length).optional(),
  usuarios_adicionais: z.coerce.number().int().min(0).max(10_000).optional(),
  veiculos_adicionais: z.coerce.number().int().min(0).max(100_000).optional(),
  promocaoId: z.string().uuid().nullable().optional(),
}).strict()

export async function PATCH(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const auth = await requireAdminAuth(request)
  if (auth.error || !auth.session) {
    return NextResponse.json({ erro: auth.error }, { status: auth.status })
  }
  const limited = await applyRateLimit(request, `admin-mutation:${auth.session.userId}`, RATE_LIMITS.ADMIN_MUTATION.limit, RATE_LIMITS.ADMIN_MUTATION.windowMs)
  if (limited) return limited

  const parsed = atualizarEmpresaSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ erro: 'Configuração de plano inválida.' }, { status: 400 })
  }

  try {
    const empresaAtual = await prisma.empresa.findUnique({ where: { id: params.id } })
    if (!empresaAtual) {
      return NextResponse.json({ erro: 'Empresa não encontrada.' }, { status: 404 })
    }

    const plano = parsed.data.plano ?? empresaAtual.plano
    const status = parsed.data.status ?? empresaAtual.status
    const mudouStatus = status !== empresaAtual.status
    const mudouMotivo = parsed.data.status_motivo !== undefined
      && parsed.data.status_motivo !== empresaAtual.status_motivo
    const mudouControleAcesso = mudouStatus || mudouMotivo
    const modulos = parsed.data.modulos
      ? normalizarModulos(parsed.data.modulos)
      : parsed.data.plano && parsed.data.plano !== empresaAtual.plano
        ? obterModulosPadrao(plano)
        : normalizarModulos(empresaAtual.modulos)
    if (modulos.includes('INTELIGENCIA') && (!modulos.includes('FROTA') || !modulos.includes('GESTAO'))) {
      return NextResponse.json({ erro: 'Inteligência da frota requer os módulos Frota e Controle e gestão.' }, { status: 400 })
    }
    const adicionais = adicionaisPadraoNaTrocaDePlano(empresaAtual.plano, plano, empresaAtual.usuarios_adicionais, empresaAtual.veiculos_adicionais)
    const usuariosAdicionais = parsed.data.usuarios_adicionais ?? adicionais.usuariosAdicionais
    const veiculosAdicionais = parsed.data.veiculos_adicionais ?? adicionais.veiculosAdicionais
    const promocaoAlterada = parsed.data.promocaoId !== undefined && parsed.data.promocaoId !== empresaAtual.promocaoId

    const resultado = await executarComAuditoria({ usuarioId: auth.session!.userId, origem: 'SUPERADMIN' }, async (tx) => {
      const mudouPreco = plano !== empresaAtual.plano
        || usuariosAdicionais !== empresaAtual.usuarios_adicionais
        || veiculosAdicionais !== empresaAtual.veiculos_adicionais
        || promocaoAlterada
      if ((mudouPreco || parsed.data.diaVencimento !== undefined && parsed.data.diaVencimento !== empresaAtual.diaVencimento)
        && await tx.recorrenciaPagamento.findFirst({
          where: { empresaId: empresaAtual.id, status: { in: ['AGUARDANDO_ADESAO', 'ATIVA'] } }, select: { id: true },
        })) {
        throw new Error('RECORRENCIA_ATIVA')
      }
      if (mudouPreco && await tx.fatura.findFirst({
        where: { empresaId: empresaAtual.id, status: 'PENDENTE', gatewayPaymentId: { not: null } },
        select: { id: true },
      })) {
        throw new Error('COBRANCA_GATEWAY_EMITIDA')
      }
      let dadosPromocao: {
        promocaoId: string | null
        precoBasePromocional: Prisma.Decimal | null
        precoBaseRenovacao: Prisma.Decimal | null
        promocaoMesesIniciais: number | null
        promocaoAtivadaEm: Date | null
        taxaImplantacaoContratada: Prisma.Decimal | null
      } | undefined

      if (promocaoAlterada) {
        if (empresaAtual.promocaoId) {
          await tx.promocaoComercial.updateMany({
            where: { id: empresaAtual.promocaoId, adesoesConfirmadas: { gt: 0 } },
            data: { adesoesConfirmadas: { decrement: 1 } },
          })
        }
        if (parsed.data.promocaoId) {
          const agora = new Date()
          const promocao = await tx.promocaoComercial.findUnique({ where: { id: parsed.data.promocaoId } })
          if (!promocao || !promocao.ativa || promocao.plano !== plano || promocao.escopo === 'NOVAS_EMPRESAS'
            || (promocao.inicio && promocao.inicio > agora) || (promocao.fim && promocao.fim < agora)) {
            throw new Error('PROMOCAO_INDISPONIVEL')
          }
          const reservada = promocao.limiteAdesoes == null
            ? await tx.promocaoComercial.updateMany({ where: { id: promocao.id, ativa: true }, data: { adesoesConfirmadas: { increment: 1 } } })
            : await tx.promocaoComercial.updateMany({ where: { id: promocao.id, ativa: true, adesoesConfirmadas: { lt: promocao.limiteAdesoes } }, data: { adesoesConfirmadas: { increment: 1 } } })
          if (reservada.count !== 1) throw new Error('PROMOCAO_ESGOTADA')
          dadosPromocao = {
            promocaoId: promocao.id,
            precoBasePromocional: promocao.precoBaseInicial,
            precoBaseRenovacao: promocao.precoBaseRenovacao,
            promocaoMesesIniciais: promocao.mesesPrecoInicial,
            promocaoAtivadaEm: agora,
            taxaImplantacaoContratada: promocao.taxaImplantacao,
          }
        } else {
          dadosPromocao = {
            promocaoId: null, precoBasePromocional: null, precoBaseRenovacao: null,
            promocaoMesesIniciais: null, promocaoAtivadaEm: null, taxaImplantacaoContratada: null,
          }
        }
      }
      const empresa = await tx.empresa.update({
        where: { id: params.id },
        data: {
          plano,
          diaVencimento: parsed.data.diaVencimento,
          status,
          modulos,
          usuarios_adicionais: usuariosAdicionais,
          veiculos_adicionais: veiculosAdicionais,
          status_motivo: status === 'ATIVO' ? null : parsed.data.status_motivo,
          status_alterado_em: mudouControleAcesso ? new Date() : empresaAtual.status_alterado_em,
          status_alterado_por_id: mudouControleAcesso ? auth.session!.userId : empresaAtual.status_alterado_por_id,
          ...dadosPromocao,
        },
      })
      const cobranca = await sincronizarCobrancaEmpresa(tx, {
        empresaId: empresa.id,
        planoAnterior: empresaAtual.plano,
        plano,
        usuariosAdicionais,
        veiculosAdicionais,
      })
      if (promocaoAlterada) {
        await tx.fatura.updateMany({
          where: { empresaId: empresa.id, tipo: 'IMPLEMENTACAO', status: 'PENDENTE', gatewayPaymentId: null },
          data: { valor: cobranca.taxaImplantacao, gatewayErro: null },
        })
      }
      const faturas = await tx.fatura.findMany({ where: { empresaId: empresa.id }, orderBy: [{ ano: 'desc' }, { criado_em: 'desc' }] })
      const atualizada = await tx.empresa.findUniqueOrThrow({ where: { id: empresa.id } })
      const financeiro = avaliarSituacaoFinanceira({ ...atualizada, faturas: faturas.filter(fatura => fatura.status === 'PENDENTE' && fatura.valor > 0) })
      return { empresa: { ...atualizada, financeiro }, cobranca, faturas }
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
    const { empresa } = resultado

    const alteracoes = [
      usuariosAdicionais !== empresaAtual.usuarios_adicionais || veiculosAdicionais !== empresaAtual.veiculos_adicionais ? 'capacidades de usuários e veículos atualizadas' : null,
      plano !== empresaAtual.plano ? `plano ${empresaAtual.plano} → ${plano}` : null,
      promocaoAlterada ? 'condição promocional atualizada' : null,
      status !== empresaAtual.status ? `status ${empresaAtual.status} → ${status}` : null,
      JSON.stringify(modulos) !== JSON.stringify(normalizarModulos(empresaAtual.modulos)) ? 'módulos atualizados' : null,
    ].filter(Boolean).join(', ')

    if (alteracoes) {
      const resultados = await Promise.allSettled([
        notificarAdmins({ titulo: 'Regras da empresa atualizadas', mensagem: `${empresa.nome}: ${alteracoes}.`, modulo: 'EMPRESAS' }),
        notificarUsuariosDaEmpresa(empresa.id, { titulo: 'Configuração de acesso atualizada', mensagem: `O SuperAdmin alterou: ${alteracoes}.`, modulo: 'GERAL' }),
      ])
      resultados.forEach(resultado => {
        if (resultado.status === 'rejected') console.error('Falha ao registrar notificação de alteração da empresa:', resultado.reason)
      })
    }

    return NextResponse.json({
      sucesso: true,
      empresa,
      mensalidade: resultado.cobranca.mensalidade,
      taxaImplantacao: resultado.cobranca.taxaImplantacao,
      faturas: resultado.faturas,
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'RECORRENCIA_ATIVA') {
      return NextResponse.json({ erro: 'Encerre a recorrência no Asaas antes de alterar preço, plano, cotas ou dia de vencimento.' }, { status: 409 })
    }
    if (error instanceof Error && error.message === 'PROMOCAO_INDISPONIVEL') {
      return NextResponse.json({ erro: 'A promoção não está disponível para esta empresa e plano.' }, { status: 409 })
    }
    if (error instanceof Error && error.message === 'PROMOCAO_ESGOTADA') {
      return NextResponse.json({ erro: 'O limite de adesões desta promoção foi atingido.' }, { status: 409 })
    }
    if (error instanceof Error && error.message === 'COBRANCA_GATEWAY_EMITIDA') {
      return NextResponse.json({ erro: 'Há uma cobrança Asaas emitida. Cancele ou quite essa cobrança antes de alterar valores.' }, { status: 409 })
    }
    console.error('Erro ao atualizar plano da empresa:', error)
    return NextResponse.json({ erro: 'Erro interno ao salvar a configuração.' }, { status: 500 })
  }
}

import { Prisma } from '@prisma/client'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { calcularPropostaAssinatura } from '@/lib/financeiro/assinaturas'
import { executarComAuditoria } from '@/lib/auditoria'
import { textoOperacional } from '@/lib/domainValidation'
import { requireEmpresaAuth } from '@/lib/empresaAuth'
import { notificarAdmins } from '@/lib/notificacoes'
import {
  calcularMensalidadeEmpresa,
  listarPlanosComerciais,
  obterPlanoComercial,
} from '@/lib/financeiro/planosComerciais'
import { configuracaoAsaas, origemCheckoutAsaas } from '@/lib/financeiro/asaas'
import { prisma } from '@/lib/prisma'
import { applyRateLimit, RATE_LIMITS } from '@/lib/rateLimit'
import { adicionaisPadraoNaTrocaDePlano } from '@/utils/planos'
import { avaliarSituacaoFinanceira, limiteBloqueioFinanceiro } from '@/lib/financeiro/situacaoFinanceira'
import { faturasPendentesFinanceiras } from '@/lib/financeiro/acessoFinanceiro'

export const dynamic = 'force-dynamic'

const alterarPlanoSchema = z.object({
  tipo: z.literal('ALTERAR_PLANO'),
  plano: z.enum(['ESSENCIAL', 'AVANCADO', 'ENTERPRISE']),
  mensagem: textoOperacional(3, 800).optional(),
}).strict()

const alterarCotasSchema = z.object({
  tipo: z.literal('ALTERAR_COTAS'),
  adicionarUsuarios: z.coerce.number().int().min(0).max(10_000),
  adicionarVeiculos: z.coerce.number().int().min(0).max(100_000),
  mensagem: textoOperacional(3, 800).optional(),
}).strict()

const negociarPagamentoSchema = z.object({
  tipo: z.literal('NEGOCIAR_PAGAMENTO'),
  faturaId: z.string().uuid(),
  mensagem: textoOperacional(10, 1200),
  vencimentoProposto: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
}).strict()

const alterarVencimentoSchema = z.object({
  tipo: z.literal('ALTERAR_VENCIMENTO'),
  diaVencimento: z.coerce.number().int().min(1).max(28),
  mensagem: textoOperacional(3, 800).optional(),
}).strict()

function dataPropostaValida(value: string) {
  const data = new Date(`${value}T23:59:59-03:00`)
  return !Number.isNaN(data.getTime())
    && new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(data) === value
    && data.getTime() > Date.now()
    && data.getTime() <= Date.now() + 366 * 24 * 60 * 60 * 1000
}

const criarSolicitacaoSchema = z.discriminatedUnion('tipo', [
  alterarPlanoSchema,
  alterarCotasSchema,
  alterarVencimentoSchema,
  negociarPagamentoSchema,
])

function serializarSolicitacao(solicitacao: {
  id: string
  tipo: string
  status: string
  planoAtual: string
  planoSolicitado: string | null
  usuariosAdicionaisSolicitados: number
  veiculosAdicionaisSolicitados: number
  mensalidadeAtual: Prisma.Decimal
  mensalidadeProposta: Prisma.Decimal
  impacto: Prisma.JsonValue | null
  mensagem: string | null
  respostaAdmin: string | null
  criado_em: Date
  decidido_em: Date | null
  faturaId: string | null
}) {
  return {
    ...solicitacao,
    mensalidadeAtual: Number(solicitacao.mensalidadeAtual),
    mensalidadeProposta: Number(solicitacao.mensalidadeProposta),
  }
}

export async function GET(request: NextRequest) {
  const auth = await requireEmpresaAuth(request, { acao: 'GESTAO' })
  if (auth.error || !auth.session?.empresaId) {
    return NextResponse.json({ erro: auth.error }, { status: auth.status })
  }

  const [empresa, planos, solicitacoes, faturasPendentes, recorrencia] = await Promise.all([
    prisma.empresa.findUnique({
      where: { id: auth.session.empresaId },
      include: {
        _count: { select: { usuarios: true, veiculos_frota: true } },
        faturas: faturasPendentesFinanceiras,
        promocao: { select: { nome: true, descricao: true } },
      },
    }),
    listarPlanosComerciais(),
    prisma.solicitacaoAssinatura.findMany({
      where: { empresaId: auth.session.empresaId },
      orderBy: { criado_em: 'desc' },
      take: 50,
      select: {
        id: true,
        tipo: true,
        status: true,
        planoAtual: true,
        planoSolicitado: true,
        usuariosAdicionaisSolicitados: true,
        veiculosAdicionaisSolicitados: true,
        mensalidadeAtual: true,
        mensalidadeProposta: true,
        impacto: true,
        mensagem: true,
        respostaAdmin: true,
        criado_em: true,
        decidido_em: true,
        faturaId: true,
      },
    }),
    prisma.fatura.findMany({
      where: { empresaId: auth.session.empresaId, status: 'PENDENTE', valor: { gt: 0 } },
      orderBy: { criado_em: 'desc' },
      take: 24,
      select: {
        id: true, mes: true, ano: true, tipo: true, valor: true, criado_em: true, vencimento: true,
        pixCopiaECola: true, comprovantePath: true, comprovanteNome: true, comprovanteEnviadoEm: true,
        provedorPagamento: true, gatewayPaymentId: true, gatewayStatus: true, gatewayBillingType: true,
        gatewayInvoiceUrl: true, gatewayErro: true, gatewaySincronizadoEm: true,
      },
    }),
    prisma.recorrenciaPagamento.findUnique({
      where: { empresaId: auth.session.empresaId },
      select: {
        metodo: true, status: true, valor: true, faturaInicialId: true, adesaoUrl: true, pixCopiaECola: true,
        valorRenovacao: true, renovacaoEm: true, acaoFimPromocao: true, transicaoPromocaoStatus: true,
      },
    }),
  ])

  if (!empresa) return NextResponse.json({ erro: 'Empresa não encontrada.' }, { status: 404 })
  const pendencias = await prisma.fatura.aggregate({ where: { empresaId: empresa.id, status: 'PENDENTE', valor: { gt: 0 } }, _min: { vencimento: true }, _sum: { valor: true } })
  const financeiro = avaliarSituacaoFinanceira(empresa)
  const vencimentoFinanceiro = pendencias._min.vencimento ?? (!empresa.primeiraMensalidadePagaEm && pendencias._sum.valor ? empresa.pagamentoInicialVenceEm : null)
  const recorrenciaAtiva = recorrencia?.status === 'ATIVA'
  const catalogoAtual = await obterPlanoComercial(empresa.plano)
  if (!catalogoAtual) return NextResponse.json({ erro: 'Plano comercial não configurado.' }, { status: 503 })

  return NextResponse.json({
    pagamento: {
      vencimento: vencimentoFinanceiro,
      bloqueioEm: vencimentoFinanceiro ? limiteBloqueioFinanceiro(vencimentoFinanceiro) : null,
      valorPendente: Number(pendencias._sum.valor ?? 0),
      primeiraMensalidadePaga: Boolean(empresa.primeiraMensalidadePagaEm),
      situacao: financeiro.situacao,
      bloqueado: financeiro.bloqueado,
      emCarencia: financeiro.emCarencia,
      recorrenciaAtiva,
      servidorAgora: new Date().toISOString(),
    },
    empresa: {
      nome: empresa.nome,
      plano: empresa.plano,
      diaVencimento: empresa.diaVencimento,
      temDocumentoFiscal: Boolean(empresa.cnpj || empresa.cnpjHash),
      usuariosAdicionais: empresa.usuarios_adicionais,
      veiculosAdicionais: empresa.veiculos_adicionais,
      totalUsuarios: empresa._count.usuarios,
      totalVeiculos: empresa._count.veiculos_frota,
      limiteUsuarios: catalogoAtual.usuariosBase + empresa.usuarios_adicionais,
      limiteVeiculos: catalogoAtual.veiculosBase + empresa.veiculos_adicionais,
      mensalidade: calcularMensalidadeEmpresa(empresa, catalogoAtual),
      condicaoComercial: empresa.promocaoId
        && empresa.precoBasePromocional !== null
        && empresa.precoBaseRenovacao !== null
        && empresa.promocaoMesesIniciais
        && empresa.promocaoAtivadaEm
        ? {
            nome: empresa.promocao?.nome ?? 'Condição promocional',
            descricao: empresa.promocao?.descricao ?? null,
            precoBasePromocional: Number(empresa.precoBasePromocional),
            precoBaseRenovacao: Number(empresa.precoBaseRenovacao),
            mesesPromocionais: empresa.promocaoMesesIniciais,
            ativadaEm: empresa.promocaoAtivadaEm,
            taxaImplantacao: Number(empresa.taxaImplantacaoContratada ?? catalogoAtual.taxaImplantacao),
            primeiraMensalidadePaga: Boolean(empresa.primeiraMensalidadePagaEm),
          }
        : null,
    },
    planoAtual: catalogoAtual,
    planos: planos.filter((plano) => plano.ativo && plano.id !== 'PREVIEW'),
    solicitacoes: solicitacoes.map(serializarSolicitacao),
    faturasPendentes,
    recorrencia: recorrencia ? {
      ...recorrencia,
      valor: Number(recorrencia.valor),
      valorRenovacao: recorrencia.valorRenovacao === null ? null : Number(recorrencia.valorRenovacao),
    } : null,
    recorrenciaDisponivel: configuracaoAsaas().ready && process.env.ASAAS_RECURRING_ENABLED === 'true' && Boolean(origemCheckoutAsaas()),
    recorrenciaPodeAderir: Boolean(empresa.primeiraMensalidadePagaEm) && !financeiro.bloqueado,
    gateway: (() => {
      const config = configuracaoAsaas()
      return { enabled: config.enabled, ready: config.ready, environment: config.environment }
    })(),
  }, { headers: { 'Cache-Control': 'private, no-store' } })
}

export async function POST(request: NextRequest) {
  const auth = await requireEmpresaAuth(request, { acao: 'GESTAO' })
  if (auth.error || !auth.session?.empresaId || !auth.usuario) {
    return NextResponse.json({ erro: auth.error }, { status: auth.status })
  }

  const limited = await applyRateLimit(
    request,
    `subscription:${auth.session.userId}`,
    RATE_LIMITS.SUBSCRIPTION_REQUEST.limit,
    RATE_LIMITS.SUBSCRIPTION_REQUEST.windowMs,
  )
  if (limited) return limited

  const parsed = criarSolicitacaoSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ erro: 'Solicitação de assinatura inválida.' }, { status: 400 })
  if (parsed.data.tipo === 'NEGOCIAR_PAGAMENTO' && parsed.data.vencimentoProposto && !dataPropostaValida(parsed.data.vencimentoProposto)) {
    return NextResponse.json({ erro: 'Escolha uma data válida dentro dos próximos 12 meses.' }, { status: 400 })
  }
  const financeiro = await prisma.empresa.findUniqueOrThrow({ where: { id: auth.session.empresaId }, include: { faturas: faturasPendentesFinanceiras } })
  if (avaliarSituacaoFinanceira(financeiro).bloqueado && parsed.data.tipo !== 'NEGOCIAR_PAGAMENTO') {
    return NextResponse.json({ erro: 'Regularize o pagamento antes de solicitar alterações de plano ou capacidade.' }, { status: 403 })
  }
  if (
    parsed.data.tipo === 'ALTERAR_COTAS'
    && parsed.data.adicionarUsuarios === 0
    && parsed.data.adicionarVeiculos === 0
  ) {
    return NextResponse.json({ erro: 'Informe ao menos uma cota adicional.' }, { status: 400 })
  }

  try {
    const solicitacao = await executarComAuditoria(
      { usuarioId: auth.session.userId },
      async (tx) => {
        const empresa = await tx.empresa.findUnique({
          where: { id: auth.session!.empresaId! },
          include: { _count: { select: { usuarios: true, veiculos_frota: true } } },
        })
        if (!empresa) throw new Error('EMPRESA_NAO_ENCONTRADA')

        const catalogoAtual = await obterPlanoComercial(empresa.plano, tx)
        if (!catalogoAtual) throw new Error('CATALOGO_NAO_CONFIGURADO')

        const planoDestino = parsed.data.tipo === 'ALTERAR_PLANO' ? parsed.data.plano : empresa.plano
        const catalogoDestino = await obterPlanoComercial(planoDestino, tx)
        if (!catalogoDestino || !catalogoDestino.ativo || planoDestino === 'PREVIEW') {
          throw new Error('PLANO_INDISPONIVEL')
        }

        const adicionais = adicionaisPadraoNaTrocaDePlano(empresa.plano, planoDestino, empresa.usuarios_adicionais, empresa.veiculos_adicionais)
        const usuariosDestino = parsed.data.tipo === 'ALTERAR_COTAS'
          ? empresa.usuarios_adicionais + parsed.data.adicionarUsuarios
          : adicionais.usuariosAdicionais
        const veiculosDestino = parsed.data.tipo === 'ALTERAR_COTAS'
          ? empresa.veiculos_adicionais + parsed.data.adicionarVeiculos
          : adicionais.veiculosAdicionais

        if (usuariosDestino > 10_000 || veiculosDestino > 100_000) {
          throw new Error('COTAS_FORA_DO_LIMITE')
        }

        if (parsed.data.tipo === 'ALTERAR_PLANO' && planoDestino === empresa.plano) {
          throw new Error('PLANO_JA_ATIVO')
        }
        if (parsed.data.tipo === 'ALTERAR_VENCIMENTO' && parsed.data.diaVencimento === empresa.diaVencimento) {
          throw new Error('VENCIMENTO_JA_ATIVO')
        }
        if (parsed.data.tipo === 'ALTERAR_VENCIMENTO' && await tx.recorrenciaPagamento.findFirst({
          where: { empresaId: empresa.id, status: { in: ['AGUARDANDO_ADESAO', 'ATIVA'] } },
          select: { id: true },
        })) {
          throw new Error('RECORRENCIA_ATIVA')
        }

        let faturaId: string | null = null
        if (parsed.data.tipo === 'NEGOCIAR_PAGAMENTO') {
          const fatura = await tx.fatura.findFirst({
            where: { id: parsed.data.faturaId, empresaId: empresa.id, status: 'PENDENTE', valor: { gt: 0 } },
            select: { id: true },
          })
          if (!fatura) throw new Error('FATURA_INVALIDA')
          faturaId = fatura.id
        }

        const proposta = calcularPropostaAssinatura(
          {
            plano: empresa.plano,
            modulos: empresa.modulos,
            usuariosAdicionais: empresa.usuarios_adicionais,
            veiculosAdicionais: empresa.veiculos_adicionais,
            totalUsuarios: empresa._count.usuarios,
            totalVeiculos: empresa._count.veiculos_frota,
          },
          {
            plano: planoDestino,
            usuariosAdicionais: usuariosDestino,
            veiculosAdicionais: veiculosDestino,
          },
          catalogoAtual,
          catalogoDestino,
        )

        const impacto: Prisma.InputJsonValue = parsed.data.tipo === 'NEGOCIAR_PAGAMENTO'
          ? { mudanca: 'NEGOCIACAO', vencimentoProposto: parsed.data.vencimentoProposto ?? null, perdas: [], bloqueios: [] }
          : parsed.data.tipo === 'ALTERAR_VENCIMENTO'
            ? { mudanca: 'VENCIMENTO_FIXO', diaVencimentoAtual: empresa.diaVencimento, diaVencimentoProposto: parsed.data.diaVencimento, perdas: [], bloqueios: [] }
            : proposta.impacto

        return tx.solicitacaoAssinatura.create({
          data: {
            tipo: parsed.data.tipo,
            planoAtual: empresa.plano,
            planoSolicitado: parsed.data.tipo === 'ALTERAR_PLANO' ? planoDestino : null,
            usuariosAdicionaisAtuais: empresa.usuarios_adicionais,
            usuariosAdicionaisSolicitados: usuariosDestino,
            veiculosAdicionaisAtuais: empresa.veiculos_adicionais,
            veiculosAdicionaisSolicitados: veiculosDestino,
            mensalidadeAtual: proposta.mensalidadeAtual,
            mensalidadeProposta: proposta.mensalidadeProposta,
            catalogoVersao: catalogoDestino.versao,
            impacto,
            mensagem: parsed.data.mensagem,
            empresaId: empresa.id,
            criadoPorId: auth.session!.userId,
            criadoPorNome: auth.usuario!.nome,
            faturaId,
          },
        })
      },
      { isolationLevel: 'Serializable' },
    )

    await notificarAdmins({
      titulo: 'Nova solicitação de assinatura',
      mensagem: `${auth.empresa?.nome ?? 'Uma empresa'} enviou um pedido de ${parsed.data.tipo.toLowerCase().replaceAll('_', ' ')}.`,
      modulo: 'ASSINATURA',
    })

    return NextResponse.json({ sucesso: true, id: solicitacao.id }, { status: 201 })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json({ erro: 'Já existe uma solicitação pendente deste tipo.' }, { status: 409 })
    }
    const codigo = error instanceof Error ? error.message : ''
    const mensagens: Record<string, string> = {
      EMPRESA_NAO_ENCONTRADA: 'Empresa não encontrada.',
      CATALOGO_NAO_CONFIGURADO: 'Catálogo comercial não configurado.',
      PLANO_INDISPONIVEL: 'O plano solicitado não está disponível.',
      PLANO_JA_ATIVO: 'Este já é o plano ativo da empresa.',
      VENCIMENTO_JA_ATIVO: 'Este já é o dia de vencimento contratado.',
      RECORRENCIA_ATIVA: 'Desative o pagamento automático antes de solicitar outro dia de vencimento.',
      FATURA_INVALIDA: 'A fatura não pertence à empresa ou não está pendente.',
      COTAS_FORA_DO_LIMITE: 'As cotas totais excedem o limite permitido.',
    }
    if (mensagens[codigo]) return NextResponse.json({ erro: mensagens[codigo] }, { status: 400 })
    console.error('Erro ao criar solicitação de assinatura:', error)
    return NextResponse.json({ erro: 'Não foi possível registrar a solicitação.' }, { status: 500 })
  }
}

import { Prisma } from '@prisma/client'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { calcularPropostaAssinatura } from '@/lib/financeiro/assinaturas'
import { executarComAuditoria } from '@/lib/auditoria'
import { textoOperacional } from '@/lib/domainValidation'
import { requireEmpresaAuth } from '@/lib/empresaAuth'
import { notificarAdmins } from '@/lib/notificacoes'
import {
  calcularMensalidadePorCatalogo,
  listarPlanosComerciais,
  obterPlanoComercial,
} from '@/lib/financeiro/planosComerciais'
import { prisma } from '@/lib/prisma'
import { applyRateLimit, RATE_LIMITS } from '@/lib/rateLimit'

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
}).strict()

const criarSolicitacaoSchema = z.discriminatedUnion('tipo', [
  alterarPlanoSchema,
  alterarCotasSchema,
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

  const [empresa, planos, solicitacoes, faturasPendentes] = await Promise.all([
    prisma.empresa.findUnique({
      where: { id: auth.session.empresaId },
      include: { _count: { select: { usuarios: true, veiculos_frota: true } } },
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
      where: { empresaId: auth.session.empresaId, status: 'PENDENTE' },
      orderBy: { criado_em: 'desc' },
      take: 24,
      select: { id: true, mes: true, ano: true, tipo: true, valor: true, criado_em: true },
    }),
  ])

  if (!empresa) return NextResponse.json({ erro: 'Empresa não encontrada.' }, { status: 404 })
  const catalogoAtual = await obterPlanoComercial(empresa.plano)
  if (!catalogoAtual) return NextResponse.json({ erro: 'Plano comercial não configurado.' }, { status: 503 })

  return NextResponse.json({
    empresa: {
      nome: empresa.nome,
      plano: empresa.plano,
      usuariosAdicionais: empresa.usuarios_adicionais,
      veiculosAdicionais: empresa.veiculos_adicionais,
      totalUsuarios: empresa._count.usuarios,
      totalVeiculos: empresa._count.veiculos_frota,
      limiteUsuarios: catalogoAtual.usuariosBase + empresa.usuarios_adicionais,
      limiteVeiculos: catalogoAtual.veiculosBase + empresa.veiculos_adicionais,
      mensalidade: calcularMensalidadePorCatalogo(
        catalogoAtual,
        empresa.usuarios_adicionais,
        empresa.veiculos_adicionais,
      ),
    },
    planoAtual: catalogoAtual,
    planos: planos.filter((plano) => plano.ativo && plano.id !== 'PREVIEW'),
    solicitacoes: solicitacoes.map(serializarSolicitacao),
    faturasPendentes,
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

  const parsed = criarSolicitacaoSchema.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ erro: 'Solicitação de assinatura inválida.' }, { status: 400 })
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

        const usuariosDestino = parsed.data.tipo === 'ALTERAR_COTAS'
          ? empresa.usuarios_adicionais + parsed.data.adicionarUsuarios
          : empresa.usuarios_adicionais
        const veiculosDestino = parsed.data.tipo === 'ALTERAR_COTAS'
          ? empresa.veiculos_adicionais + parsed.data.adicionarVeiculos
          : empresa.veiculos_adicionais

        if (usuariosDestino > 10_000 || veiculosDestino > 100_000) {
          throw new Error('COTAS_FORA_DO_LIMITE')
        }

        if (parsed.data.tipo === 'ALTERAR_PLANO' && planoDestino === empresa.plano) {
          throw new Error('PLANO_JA_ATIVO')
        }

        let faturaId: string | null = null
        if (parsed.data.tipo === 'NEGOCIAR_PAGAMENTO') {
          const fatura = await tx.fatura.findFirst({
            where: { id: parsed.data.faturaId, empresaId: empresa.id, status: 'PENDENTE' },
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
          ? { mudanca: 'NEGOCIACAO', perdas: [], bloqueios: [] }
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
      FATURA_INVALIDA: 'A fatura não pertence à empresa ou não está pendente.',
      COTAS_FORA_DO_LIMITE: 'As cotas totais excedem o limite permitido.',
    }
    if (mensagens[codigo]) return NextResponse.json({ erro: mensagens[codigo] }, { status: 400 })
    console.error('Erro ao criar solicitação de assinatura:', error)
    return NextResponse.json({ erro: 'Não foi possível registrar a solicitação.' }, { status: 500 })
  }
}

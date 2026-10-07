import { OperacaoFinanceiraError } from '@/lib/financeiro/operacaoFinanceira'
import { Prisma } from '@prisma/client'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireEmpresaAuth } from '@/lib/empresaAuth'
import { applyRateLimit, RATE_LIMITS } from '@/lib/rateLimit'
import { configuracaoAsaas, encerrarRecorrenciaCartao, iniciarRecorrenciaCartao, origemCheckoutAsaas } from '@/lib/financeiro/asaas'
import { prisma } from '@/lib/prisma'
import { telefoneBRValido } from '@/utils/telefone'

export const dynamic = 'force-dynamic'

async function autenticar(request: NextRequest) {
  const auth = await requireEmpresaAuth(request, { acao: 'GESTAO' })
  if (auth.error || !auth.session?.empresaId) return { erro: NextResponse.json({ erro: auth.error }, { status: auth.status }), empresaId: null }
  const limited = await applyRateLimit(request, `recorrencia:${auth.session.userId}`, RATE_LIMITS.ADMIN_MUTATION.limit, RATE_LIMITS.ADMIN_MUTATION.windowMs)
  return { erro: limited, empresaId: auth.session.empresaId }
}

export async function GET(request: NextRequest) {
  const auth = await autenticar(request)
  if (auth.erro || !auth.empresaId) return auth.erro ?? NextResponse.json({ erro: 'Empresa não identificada.' }, { status: 401 })
  const recorrencia = await prisma.recorrenciaPagamento.findUnique({
    where: { empresaId: auth.empresaId },
    select: {
      metodo: true, status: true, valor: true, faturaInicialId: true, adesaoUrl: true, pixCopiaECola: true, criadoEm: true,
      valorRenovacao: true, renovacaoEm: true, acaoFimPromocao: true, transicaoPromocaoStatus: true,
    },
  })
  return NextResponse.json({
    disponivel: configuracaoAsaas().ready && process.env.ASAAS_RECURRING_ENABLED === 'true' && Boolean(origemCheckoutAsaas()),
    recorrencia: recorrencia ? {
      ...recorrencia,
      valor: Number(recorrencia.valor),
      valorRenovacao: recorrencia.valorRenovacao === null ? null : Number(recorrencia.valorRenovacao),
    } : null,
  })
}

export async function PATCH(request: NextRequest) {
  const auth = await autenticar(request)
  if (auth.erro || !auth.empresaId) return auth.erro ?? NextResponse.json({ erro: 'Empresa não identificada.' }, { status: 401 })
  const parsed = z.object({
    acaoFimPromocao: z.enum(['ATUALIZAR_VALOR', 'DESATIVAR_RECORRENCIA']),
  }).strict().safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ erro: 'Escolha inválida para o fim da promoção.' }, { status: 400 })

  const atualizada = await prisma.recorrenciaPagamento.updateMany({
    where: {
      empresaId: auth.empresaId,
      status: 'ATIVA',
      transicaoPromocaoStatus: 'AGENDADA',
      renovacaoEm: { not: null },
      valorRenovacao: { not: null },
    },
    data: { acaoFimPromocao: parsed.data.acaoFimPromocao },
  })
  if (atualizada.count !== 1) {
    return NextResponse.json({ erro: 'Essa preferência não pode mais ser alterada. Atualize a página ou contate o suporte.' }, { status: 409 })
  }
  return NextResponse.json({
    mensagem: parsed.data.acaoFimPromocao === 'ATUALIZAR_VALOR'
      ? 'O cartão continuará ativo com o valor informado para o fim da promoção.'
      : 'A desativação do cartão automático foi programada para o fim da promoção.',
  })
}

export async function POST(request: NextRequest) {
  const auth = await autenticar(request)
  if (auth.erro || !auth.empresaId) return auth.erro ?? NextResponse.json({ erro: 'Empresa não identificada.' }, { status: 401 })
  if (process.env.ASAAS_RECURRING_ENABLED !== 'true' || !configuracaoAsaas().ready) {
    return NextResponse.json({ erro: 'Adesão recorrente ainda não habilitada.' }, { status: 503 })
  }
  const parsed = z.object({
    faturaId: z.string().uuid().optional(),
    metodo: z.literal('CARTAO'),
    dadosCadastrais: z.object({
      telefone: z.string().trim().refine(telefoneBRValido),
      cep: z.string().trim().refine(value => /^\d{8}$/.test(value.replace(/\D/g, ''))),
      logradouro: z.string().trim().min(2).max(120),
      numero: z.string().trim().min(1).max(20),
      complemento: z.string().trim().max(80).optional(),
      bairro: z.string().trim().min(2).max(80),
    }).strict(),
  }).strict().safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ erro: 'Preencha telefone, CEP e endereço completos para aderir.' }, { status: 400 })
  try {
    const recorrencia = await iniciarRecorrenciaCartao(auth.empresaId, parsed.data.faturaId, parsed.data.dadosCadastrais)
    return NextResponse.json({ recorrencia: { metodo: recorrencia.metodo, status: recorrencia.status, adesaoUrl: recorrencia.adesaoUrl } })
  } catch (error) {
    if (error instanceof OperacaoFinanceiraError) return NextResponse.json({ erro: error.message }, { status: error.status })
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json({ erro: 'Uma adesão já está em andamento para esta empresa.' }, { status: 409 })
    }
    console.error('Falha ao iniciar recorrência no cartão:', error)
    return NextResponse.json({ erro: 'Não foi possível iniciar a autorização do cartão. Aguarde alguns instantes antes de tentar novamente.' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await autenticar(request)
  if (auth.erro || !auth.empresaId) return auth.erro ?? NextResponse.json({ erro: 'Empresa não identificada.' }, { status: 401 })
  try {
    await encerrarRecorrenciaCartao(auth.empresaId)
    return NextResponse.json({ mensagem: 'Pagamento automático desativado com sucesso.' })
  } catch (error) {
    if (error instanceof OperacaoFinanceiraError) return NextResponse.json({ erro: error.message }, { status: error.status })
    console.error('Falha ao cancelar recorrência:', error)
    return NextResponse.json({ erro: 'Não foi possível desativar o pagamento automático. Tente novamente ou contate o suporte.' }, { status: 500 })
  }
}

import { randomUUID } from 'node:crypto'
import { Prisma } from '@prisma/client'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireEmpresaAuth } from '@/lib/empresaAuth'
import { encryptSensitive, decryptSensitive } from '@/lib/fieldEncryption'
import { prisma } from '@/lib/prisma'
import { executarComAuditoria } from '@/lib/auditoria'
import { applyRateLimit, RATE_LIMITS } from '@/lib/rateLimit'
import {
  CAPACIDADES_CONTAS_PAGAR,
  diasAteVencimento,
  formatarLinhaDigitavel,
  linhaDigitavelValida,
  nivelVencimento,
  somenteDigitosBoleto,
} from '@/lib/financeiro/contasPagar'
import { ArquivoContaPagarError, removerArquivosContaPagar, salvarArquivoContaPagar } from '@/lib/financeiro/contasPagarStorage'
import { categoriaContaPagarRequerVeiculo, VALORES_CATEGORIA_CONTA_PAGAR } from '@/lib/financeiro/categoriasContaPagar'

const schema = z.object({
  descricao: z.string().trim().min(3).max(160),
  fornecedor: z.string().trim().max(160).optional(),
  vencimento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  valor: z.coerce.number().positive().max(999_999_999.99),
  linhaDigitavel: z.string().trim().max(80).optional(),
  origemLeitura: z.enum(['MANUAL', 'PDF_TEXTO', 'CODIGO_BARRAS']).default('MANUAL'),
  revisado: z.enum(['true', 'false']).default('false').transform((valor) => valor === 'true'),
  categoria: z.enum(VALORES_CATEGORIA_CONTA_PAGAR).optional(),
  veiculoId: z.string().uuid().optional(),
}).strict()

function dataLocal(valor: string) {
  const data = new Date(`${valor}T00:00:00.000Z`)
  if (Number.isNaN(data.getTime()) || data.toISOString().slice(0, 10) !== valor) throw new Error('DATA_INVALIDA')
  return data
}

function serializar(conta: {
  id: string; descricao: string; fornecedor: string | null; vencimento: Date; valor: unknown; status: string
  linha_digitavel: string | null; origem_leitura: string; boleto_path: string | null; boleto_nome: string | null
  comprovante_path: string | null; comprovante_nome: string | null; pago_em: Date | null; criado_em: Date; atualizado_em: Date
  categoria: string | null; veiculoId: string | null; historicoVeiculoId: string | null
  custo?: { id: string } | null
  veiculo?: { id: string; placa: string; modelo: string } | null
}, empresaId: string) {
  const linha = decryptSensitive(conta.linha_digitavel, empresaId, 'contaPagar.linhaDigitavel') ?? ''
  return {
    id: conta.id,
    descricao: conta.descricao,
    fornecedor: conta.fornecedor,
    vencimento: conta.vencimento.toISOString().slice(0, 10),
    valor: Number(conta.valor),
    status: conta.status,
    linhaDigitavel: linha,
    linhaDigitavelFormatada: formatarLinhaDigitavel(linha),
    origemLeitura: conta.origem_leitura,
    categoria: conta.categoria,
    veiculo: conta.veiculo ?? null,
    manutencaoId: conta.historicoVeiculoId,
    custoId: conta.custo?.id ?? null,
    possuiBoleto: Boolean(conta.boleto_path),
    boletoNome: conta.boleto_nome,
    possuiComprovante: Boolean(conta.comprovante_path),
    comprovanteNome: conta.comprovante_nome,
    pagoEm: conta.pago_em,
    criadoEm: conta.criado_em,
    atualizadoEm: conta.atualizado_em,
    diasParaVencer: diasAteVencimento(conta.vencimento),
    nivel: nivelVencimento(conta.vencimento),
  }
}

export async function GET(request: NextRequest) {
  const auth = await requireEmpresaAuth(request, { modulo: 'CONTAS_PAGAR', acao: 'LEITURA' })
  if (auth.error || !auth.session || !auth.empresa) return NextResponse.json({ erro: auth.error }, { status: auth.status })
  const limited = await applyRateLimit(request, `contas-pagar-read:${auth.session.userId}`, RATE_LIMITS.REPORT_READ.limit, RATE_LIMITS.REPORT_READ.windowMs)
  if (limited) return limited

  const status = request.nextUrl.searchParams.get('status')
  const contas = await prisma.contaPagar.findMany({
    where: {
      empresaId: auth.empresaId!,
      ...(status === 'PENDENTE' || status === 'PAGO' || status === 'CANCELADO' ? { status } : {}),
    },
    orderBy: [{ status: 'asc' }, { vencimento: 'asc' }, { criado_em: 'desc' }],
    take: 500,
    include: {
      veiculo: { select: { id: true, placa: true, modelo: true } },
      custo: { select: { id: true } },
    },
  })
  return NextResponse.json({
    contas: contas.map((conta) => serializar(conta, auth.empresaId!)),
    capacidades: CAPACIDADES_CONTAS_PAGAR[auth.empresa.plano],
    integracoes: {
      custos: auth.empresa.modulos.includes('GESTAO'),
      frota: auth.empresa.modulos.includes('FROTA'),
    },
    portalFinanceiro: auth.empresa.portal_financeiro_url
      ? { nome: auth.empresa.portal_financeiro_nome || 'Portal financeiro', url: auth.empresa.portal_financeiro_url }
      : null,
  }, { headers: { 'Cache-Control': 'private, no-store' } })
}

export async function POST(request: NextRequest) {
  const auth = await requireEmpresaAuth(request, { modulo: 'CONTAS_PAGAR', acao: 'ESCRITA' })
  if (auth.error || !auth.session || !auth.empresa) return NextResponse.json({ erro: auth.error }, { status: auth.status })
  const limited = await applyRateLimit(request, `contas-pagar-upload:${auth.session.userId}`, RATE_LIMITS.FILE_UPLOAD.limit, RATE_LIMITS.FILE_UPLOAD.windowMs)
  if (limited) return limited

  let arquivoSalvo: string | null = null
  try {
    const form = await request.formData()
    const parsed = schema.safeParse({
      descricao: form.get('descricao'), fornecedor: form.get('fornecedor') || undefined,
      vencimento: form.get('vencimento'), valor: form.get('valor'),
      linhaDigitavel: form.get('linhaDigitavel') || undefined,
      origemLeitura: form.get('origemLeitura') || 'MANUAL',
      revisado: form.get('revisado') || 'false',
      categoria: form.get('categoria') || undefined,
      veiculoId: form.get('veiculoId') || undefined,
    })
    if (!parsed.success) return NextResponse.json({ erro: 'Revise a descrição, o vencimento e o valor.' }, { status: 400 })

    const capacidades = CAPACIDADES_CONTAS_PAGAR[auth.empresa.plano]
    if (parsed.data.origemLeitura !== 'MANUAL' && !capacidades.leituraAutomatica) {
      return NextResponse.json({ erro: 'A leitura automática está disponível nos planos Avançado e Enterprise.' }, { status: 403 })
    }
    if (parsed.data.origemLeitura !== 'MANUAL' && !parsed.data.revisado) {
      return NextResponse.json({ erro: 'Ateste a conferência dos dados extraídos antes de salvar.' }, { status: 422 })
    }
    if (parsed.data.categoria && !auth.empresa.modulos.includes('GESTAO')) {
      return NextResponse.json({ erro: 'O módulo Controle & Gestão precisa estar ativo para integrar a despesa.' }, { status: 403 })
    }
    if (categoriaContaPagarRequerVeiculo(parsed.data.categoria) && !parsed.data.veiculoId) {
      return NextResponse.json({ erro: 'Selecione o veículo relacionado à despesa operacional.' }, { status: 400 })
    }
    if (parsed.data.categoria === 'MANUTENCAO' && !auth.empresa.modulos.includes('FROTA')) {
      return NextResponse.json({ erro: 'O módulo Frota precisa estar ativo para integrar uma manutenção.' }, { status: 403 })
    }
    const linha = somenteDigitosBoleto(parsed.data.linhaDigitavel)
    if (linha && !linhaDigitavelValida(linha)) return NextResponse.json({ erro: 'A linha digitável não passou na validação. Confira o boleto antes de salvar.' }, { status: 422 })

    const veiculo = parsed.data.veiculoId
      ? await prisma.veiculo.findFirst({
          where: { id: parsed.data.veiculoId, empresaId: auth.empresaId! },
          select: { id: true, modelo: true, placa: true, quilometragem: true },
        })
      : null
    if (parsed.data.veiculoId && !veiculo) {
      return NextResponse.json({ erro: 'Veículo inválido para esta empresa.' }, { status: 400 })
    }

    const id = randomUUID()
    const vencimento = dataLocal(parsed.data.vencimento)
    const arquivo = form.get('boleto')
    const boleto = arquivo instanceof File && arquivo.size > 0
      ? await salvarArquivoContaPagar(auth.empresaId!, id, 'boleto', arquivo)
      : null
    arquivoSalvo = boleto?.caminho ?? null
    const conta = await executarComAuditoria({ usuarioId: auth.session.userId, origem: 'API' }, async (tx) => {
      const manutencao = parsed.data.categoria === 'MANUTENCAO' && veiculo
        ? await tx.historicoVeiculo.create({
            data: {
              data_agendada: vencimento,
              tipo: 'CORRETIVA',
              descricao: `Conta a pagar: ${parsed.data.descricao}`,
              custo: parsed.data.valor,
              km_atual: veiculo.quilometragem,
              status: 'PENDENTE',
              origem: 'FINANCEIRO',
              veiculoId: veiculo.id,
              empresaId: auth.empresaId!,
            },
          })
        : null

      const contaCriada = await tx.contaPagar.create({
        data: {
          id,
          descricao: parsed.data.descricao,
          fornecedor: parsed.data.fornecedor || null,
          vencimento,
          valor: parsed.data.valor,
          linha_digitavel: linha ? encryptSensitive(linha, auth.empresaId!, 'contaPagar.linhaDigitavel') : null,
          origem_leitura: parsed.data.origemLeitura,
          categoria: parsed.data.categoria,
          veiculoId: veiculo?.id,
          historicoVeiculoId: manutencao?.id,
          boleto_path: boleto?.caminho,
          boleto_nome: boleto?.nome,
          boleto_mime: boleto?.mime,
          boleto_tamanho: boleto?.tamanho,
          empresaId: auth.empresaId!,
          criadoPorId: auth.session.userId,
        },
      })

      if (parsed.data.categoria) {
        await tx.custo.create({
          data: {
            data: vencimento,
            ano: vencimento.getUTCFullYear(),
            mesIndex: vencimento.getUTCMonth(),
            semanaIndex: Math.min(4, Math.floor((vencimento.getUTCDate() - 1) / 7) + 1),
            categoria: parsed.data.categoria,
            descricao: `Boleto: ${parsed.data.descricao}`,
            valor: parsed.data.valor,
            formaPagamento: 'BOLETO',
            status: 'PENDENTE',
            veiculoId: veiculo?.id ?? null,
            empresaId: auth.empresaId!,
            contaPagarId: contaCriada.id,
          },
        })
      }

      return tx.contaPagar.findUniqueOrThrow({
        where: { id: contaCriada.id },
        include: {
          veiculo: { select: { id: true, placa: true, modelo: true } },
          custo: { select: { id: true } },
        },
      })
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
    return NextResponse.json({ conta: serializar(conta, auth.empresaId!), aviso: 'Confirme beneficiário, vencimento e valor no aplicativo do banco antes de pagar.' }, { status: 201 })
  } catch (error) {
    if (arquivoSalvo) await removerArquivosContaPagar([arquivoSalvo])
    if (error instanceof ArquivoContaPagarError) return NextResponse.json({ erro: error.message }, { status: error.status })
    if (error instanceof Error && error.message === 'DATA_INVALIDA') return NextResponse.json({ erro: 'Data de vencimento inválida.' }, { status: 400 })
    console.error('Erro ao cadastrar conta a pagar:', error)
    return NextResponse.json({ erro: 'Não foi possível cadastrar a conta.' }, { status: 500 })
  }
}

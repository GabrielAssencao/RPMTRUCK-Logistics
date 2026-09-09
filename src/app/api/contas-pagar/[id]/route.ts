import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { requireEmpresaAuth } from '@/lib/empresaAuth'
import { prisma } from '@/lib/prisma'
import { executarComAuditoria } from '@/lib/auditoria'
import { applyRateLimit, RATE_LIMITS } from '@/lib/rateLimit'
import { encryptSensitive } from '@/lib/fieldEncryption'
import { linhaDigitavelDoCodigoBarras, linhaDigitavelEstruturalmenteValida, linhaDigitavelValida, somenteDigitosBoleto } from '@/lib/financeiro/contasPagar'
import { ArquivoContaPagarError, removerArquivosContaPagar, salvarArquivoContaPagar } from '@/lib/financeiro/contasPagarStorage'

const editarSchema = z.object({
  descricao: z.string().trim().min(3).max(160),
  fornecedor: z.string().trim().max(160).optional(),
  vencimento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  valor: z.coerce.number().positive().max(999_999_999.99),
  linhaDigitavel: z.string().trim().max(80).optional(),
}).strict()

function dataLocal(valor: string) {
  const data = new Date(`${valor}T00:00:00.000Z`)
  if (Number.isNaN(data.getTime()) || data.toISOString().slice(0, 10) !== valor) return null
  return data
}

export async function PATCH(request: NextRequest, context: RouteContext<'/api/contas-pagar/[id]'>) {
  const auth = await requireEmpresaAuth(request, { modulo: 'CONTAS_PAGAR', acao: 'ESCRITA' })
  if (auth.error || !auth.session) return NextResponse.json({ erro: auth.error }, { status: auth.status })
  const limited = await applyRateLimit(request, `contas-pagar-write:${auth.session.userId}`, RATE_LIMITS.FILE_UPLOAD.limit, RATE_LIMITS.FILE_UPLOAD.windowMs)
  if (limited) return limited

  const { id } = await context.params
  let caminhoNovo: string | null = null
  try {
    const form = await request.formData()
    const acao = form.get('acao')
    if (acao !== 'PAGAR' && acao !== 'CANCELAR' && acao !== 'REABRIR' && acao !== 'EDITAR') return NextResponse.json({ erro: 'Ação inválida.' }, { status: 400 })
    const atual = await prisma.contaPagar.findFirst({
      where: { id, empresaId: auth.empresaId! },
      include: {
        custo: { select: { id: true, relatorioArquivoId: true } },
        historicoVeiculo: { select: { id: true, relatorioArquivoId: true } },
      },
    })
    if (!atual) return NextResponse.json({ erro: 'Conta não encontrada.' }, { status: 404 })

    if (acao === 'EDITAR') {
      if (atual.status === 'CANCELADO') return NextResponse.json({ erro: 'Contas canceladas são preservadas para auditoria e não podem ser editadas.' }, { status: 409 })
      if (atual.custo?.relatorioArquivoId || atual.historicoVeiculo?.relatorioArquivoId) {
        return NextResponse.json({ erro: 'Esta conta já faz parte de um relatório fechado e não pode ser alterada.' }, { status: 409 })
      }
      const parsed = editarSchema.safeParse({
        descricao: form.get('descricao'),
        fornecedor: form.get('fornecedor') || undefined,
        vencimento: form.get('vencimento'),
        valor: form.get('valor'),
        linhaDigitavel: form.get('linhaDigitavel') || undefined,
      })
      if (!parsed.success) return NextResponse.json({ erro: 'Revise a descrição, o vencimento e o valor.' }, { status: 400 })
      const vencimento = dataLocal(parsed.data.vencimento)
      if (!vencimento) return NextResponse.json({ erro: 'Data de vencimento inválida.' }, { status: 400 })
      const linha = linhaDigitavelDoCodigoBarras(somenteDigitosBoleto(parsed.data.linhaDigitavel))
      if (linha && (!linhaDigitavelEstruturalmenteValida(linha) || !linhaDigitavelValida(linha))) {
        return NextResponse.json({ erro: 'O código não passou na verificação. Confira todos os dígitos antes de salvar.' }, { status: 422 })
      }

      await executarComAuditoria({ usuarioId: auth.session.userId, origem: 'API' }, async (tx) => {
        const resultado = await tx.contaPagar.updateMany({
          where: { id, empresaId: auth.empresaId!, status: atual.status },
          data: {
            descricao: parsed.data.descricao,
            fornecedor: parsed.data.fornecedor || null,
            vencimento,
            valor: parsed.data.valor,
            linha_digitavel: linha ? encryptSensitive(linha, auth.empresaId!, 'contaPagar.linhaDigitavel') : null,
          },
        })
        if (resultado.count !== 1) throw new Error('JA_PROCESSADA')
        await tx.custo.updateMany({
          where: { contaPagarId: id, empresaId: auth.empresaId!, relatorioArquivoId: null },
          data: {
            data: vencimento,
            ano: vencimento.getUTCFullYear(),
            mesIndex: vencimento.getUTCMonth(),
            semanaIndex: Math.min(4, Math.floor((vencimento.getUTCDate() - 1) / 7) + 1),
            descricao: `Boleto: ${parsed.data.descricao}`,
            valor: parsed.data.valor,
          },
        })
        if (atual.historicoVeiculoId) {
          await tx.historicoVeiculo.updateMany({
            where: { id: atual.historicoVeiculoId, empresaId: auth.empresaId!, relatorioArquivoId: null },
            data: { data_agendada: vencimento, descricao: `Conta a pagar: ${parsed.data.descricao}`, custo: parsed.data.valor },
          })
        }
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
      return NextResponse.json({ sucesso: true, status: atual.status })
    }

    if (acao === 'REABRIR') {
      if (atual.status !== 'PAGO') return NextResponse.json({ erro: 'Somente uma conta paga pode ter a baixa revertida.' }, { status: 409 })
      if (atual.custo?.relatorioArquivoId) {
        return NextResponse.json({ erro: 'A despesa já faz parte de um relatório de auditoria e sua baixa não pode ser revertida.' }, { status: 409 })
      }
      const comprovanteAnterior = atual.comprovante_path
      await executarComAuditoria({ usuarioId: auth.session.userId, origem: 'API' }, async (tx) => {
        const resultado = await tx.contaPagar.updateMany({
          where: { id, empresaId: auth.empresaId!, status: 'PAGO' },
          data: {
            status: 'PENDENTE', pago_em: null, pagoPorId: null,
            comprovante_path: null, comprovante_nome: null,
            comprovante_mime: null, comprovante_tamanho: null,
          },
        })
        if (resultado.count !== 1) throw new Error('JA_PROCESSADA')
        await tx.custo.updateMany({
          where: { contaPagarId: id, empresaId: auth.empresaId! },
          data: { status: 'PENDENTE' },
        })
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
      await removerArquivosContaPagar([comprovanteAnterior])
      return NextResponse.json({ sucesso: true, status: 'PENDENTE' })
    }

    if (atual.status !== 'PENDENTE') return NextResponse.json({ erro: 'Esta conta já foi processada.' }, { status: 409 })

    if (acao === 'CANCELAR') {
      if (atual.custo?.relatorioArquivoId) {
        return NextResponse.json({ erro: 'A despesa já faz parte de um relatório de auditoria e não pode ser cancelada.' }, { status: 409 })
      }
      await executarComAuditoria({ usuarioId: auth.session.userId, origem: 'API' }, async (tx) => {
        const resultado = await tx.contaPagar.updateMany({ where: { id, empresaId: auth.empresaId!, status: 'PENDENTE' }, data: { status: 'CANCELADO' } })
        if (resultado.count !== 1) throw new Error('JA_PROCESSADA')
        if (atual.historicoVeiculoId) {
          await tx.historicoVeiculo.updateMany({
            where: { id: atual.historicoVeiculoId, empresaId: auth.empresaId!, status: 'PENDENTE' },
            data: { status: 'CANCELADA' },
          })
        }
        await tx.custo.deleteMany({ where: { contaPagarId: id, empresaId: auth.empresaId!, relatorioArquivoId: null } })
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
      return NextResponse.json({ sucesso: true, status: 'CANCELADO' })
    }

    const arquivo = form.get('comprovante')
    if (arquivo !== null && !(arquivo instanceof File)) {
      return NextResponse.json({ erro: 'O comprovante enviado é inválido.' }, { status: 400 })
    }
    const comprovante = arquivo instanceof File && arquivo.size > 0
      ? await salvarArquivoContaPagar(auth.empresaId!, id, 'comprovante', arquivo)
      : null
    caminhoNovo = comprovante?.caminho ?? null

    await executarComAuditoria({ usuarioId: auth.session.userId, origem: 'API' }, async (tx) => {
      const resultado = await tx.contaPagar.updateMany({
        where: { id, empresaId: auth.empresaId!, status: 'PENDENTE' },
        data: {
          status: 'PAGO', pago_em: new Date(), pagoPorId: auth.session!.userId,
          ...(comprovante ? {
            comprovante_path: comprovante.caminho, comprovante_nome: comprovante.nome,
            comprovante_mime: comprovante.mime, comprovante_tamanho: comprovante.tamanho,
          } : {}),
        },
      })
      if (resultado.count !== 1) throw new Error('JA_PROCESSADA')
      await tx.custo.updateMany({
        where: { contaPagarId: id, empresaId: auth.empresaId! },
        data: { status: 'PAGO' },
      })
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
    caminhoNovo = null
    return NextResponse.json({ sucesso: true, status: 'PAGO' })
  } catch (error) {
    if (caminhoNovo) await removerArquivosContaPagar([caminhoNovo])
    if (error instanceof ArquivoContaPagarError) return NextResponse.json({ erro: error.message }, { status: error.status })
    if (error instanceof Error && error.message === 'JA_PROCESSADA') return NextResponse.json({ erro: 'Esta conta já foi processada em outra sessão.' }, { status: 409 })
    console.error('Erro ao processar conta a pagar:', error)
    return NextResponse.json({ erro: 'Não foi possível processar a conta.' }, { status: 500 })
  }
}

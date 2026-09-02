import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { requireEmpresaAuth } from '@/lib/empresaAuth'
import { prisma } from '@/lib/prisma'
import { executarComAuditoria } from '@/lib/auditoria'
import { applyRateLimit, RATE_LIMITS } from '@/lib/rateLimit'
import { ArquivoContaPagarError, removerArquivosContaPagar, salvarArquivoContaPagar } from '@/lib/financeiro/contasPagarStorage'

export async function PATCH(request: NextRequest, context: RouteContext<'/api/contas-pagar/[id]'>) {
  const auth = await requireEmpresaAuth(request, { modulo: 'CONTAS_PAGAR', acao: 'ESCRITA' })
  if (auth.error || !auth.session) return NextResponse.json({ erro: auth.error }, { status: auth.status })
  const limited = await applyRateLimit(request, `contas-pagar-baixa:${auth.session.userId}`, RATE_LIMITS.FILE_UPLOAD.limit, RATE_LIMITS.FILE_UPLOAD.windowMs)
  if (limited) return limited

  const { id } = await context.params
  let caminhoNovo: string | null = null
  try {
    const form = await request.formData()
    const acao = form.get('acao')
    if (acao !== 'PAGAR' && acao !== 'CANCELAR' && acao !== 'REABRIR') return NextResponse.json({ erro: 'Ação inválida.' }, { status: 400 })
    const atual = await prisma.contaPagar.findFirst({
      where: { id, empresaId: auth.empresaId! },
      include: { custo: { select: { id: true, relatorioArquivoId: true } } },
    })
    if (!atual) return NextResponse.json({ erro: 'Conta não encontrada.' }, { status: 404 })

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

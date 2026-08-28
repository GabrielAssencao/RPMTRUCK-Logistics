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
    if (acao !== 'PAGAR' && acao !== 'CANCELAR') return NextResponse.json({ erro: 'Ação inválida.' }, { status: 400 })
    const atual = await prisma.contaPagar.findFirst({ where: { id, empresaId: auth.empresaId! } })
    if (!atual) return NextResponse.json({ erro: 'Conta não encontrada.' }, { status: 404 })
    if (atual.status !== 'PENDENTE') return NextResponse.json({ erro: 'Esta conta já foi processada.' }, { status: 409 })

    if (acao === 'CANCELAR') {
      await executarComAuditoria({ usuarioId: auth.session.userId, origem: 'API' }, async (tx) => {
        const resultado = await tx.contaPagar.updateMany({ where: { id, empresaId: auth.empresaId!, status: 'PENDENTE' }, data: { status: 'CANCELADO' } })
        if (resultado.count !== 1) throw new Error('JA_PROCESSADA')
        if (atual.historicoVeiculoId) {
          await tx.historicoVeiculo.updateMany({
            where: { id: atual.historicoVeiculoId, empresaId: auth.empresaId!, status: 'PENDENTE' },
            data: { status: 'CANCELADA' },
          })
        }
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
      return NextResponse.json({ sucesso: true, status: 'CANCELADO' })
    }

    const arquivo = form.get('comprovante')
    if (!(arquivo instanceof File) || arquivo.size <= 0) return NextResponse.json({ erro: 'Anexe o comprovante para confirmar a baixa.' }, { status: 400 })
    const comprovante = await salvarArquivoContaPagar(auth.empresaId!, id, 'comprovante', arquivo)
    caminhoNovo = comprovante.caminho

    await executarComAuditoria({ usuarioId: auth.session.userId, origem: 'API' }, async (tx) => {
      const resultado = await tx.contaPagar.updateMany({
        where: { id, empresaId: auth.empresaId!, status: 'PENDENTE' },
        data: {
          status: 'PAGO', pago_em: new Date(), pagoPorId: auth.session!.userId,
          comprovante_path: comprovante.caminho, comprovante_nome: comprovante.nome,
          comprovante_mime: comprovante.mime, comprovante_tamanho: comprovante.tamanho,
        },
      })
      if (resultado.count !== 1) throw new Error('JA_PROCESSADA')
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

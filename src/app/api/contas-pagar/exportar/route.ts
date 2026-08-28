import { NextRequest, NextResponse } from 'next/server'
import { requireEmpresaAuth } from '@/lib/empresaAuth'
import { decryptSensitive } from '@/lib/fieldEncryption'
import { prisma } from '@/lib/prisma'
import { CAPACIDADES_CONTAS_PAGAR } from '@/lib/contasPagar'
import { applyRateLimit, RATE_LIMITS } from '@/lib/rateLimit'

function csv(valor: unknown) {
  return `"${String(valor ?? '').replaceAll('"', '""')}"`
}

export async function GET(request: NextRequest) {
  const auth = await requireEmpresaAuth(request, { modulo: 'GESTAO', acao: 'GESTAO' })
  if (auth.error || !auth.session || !auth.empresa) return NextResponse.json({ erro: auth.error }, { status: auth.status })
  if (!CAPACIDADES_CONTAS_PAGAR[auth.empresa.plano].exportacaoLote) return NextResponse.json({ erro: 'A exportação em lote está disponível no plano Enterprise.' }, { status: 403 })
  const limited = await applyRateLimit(request, `contas-pagar-export:${auth.session.userId}`, RATE_LIMITS.REPORT_GENERATE.limit, RATE_LIMITS.REPORT_GENERATE.windowMs)
  if (limited) return limited
  const contas = await prisma.contaPagar.findMany({ where: { empresaId: auth.empresaId! }, orderBy: { vencimento: 'asc' }, take: 5_000 })
  const linhas = [
    ['Descrição', 'Fornecedor', 'Vencimento', 'Valor', 'Status', 'Linha digitável', 'Pago em'].map(csv).join(';'),
    ...contas.map((conta) => [
      conta.descricao, conta.fornecedor, conta.vencimento.toISOString().slice(0, 10), Number(conta.valor).toFixed(2), conta.status,
      decryptSensitive(conta.linha_digitavel, auth.empresaId!, 'contaPagar.linhaDigitavel') ?? '', conta.pago_em?.toISOString() ?? '',
    ].map(csv).join(';')),
  ]
  return new NextResponse(`\uFEFF${linhas.join('\r\n')}`, {
    headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="contas-a-pagar.csv"', 'Cache-Control': 'private, no-store' },
  })
}

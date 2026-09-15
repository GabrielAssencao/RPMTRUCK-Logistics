import { NextRequest, NextResponse } from 'next/server'
import { requireEmpresaAuth } from '@/lib/empresaAuth'
import { decryptSensitive } from '@/lib/fieldEncryption'
import { prisma } from '@/lib/prisma'
import { CAPACIDADES_CONTAS_PAGAR } from '@/lib/financeiro/contasPagar'
import { applyRateLimit, RATE_LIMITS } from '@/lib/rateLimit'
import { gerarBackupEmpresaExcel } from '@/lib/empresaBackupExcel'
import { EXCEL_MIME } from '@/lib/excelFormatting'

export async function GET(request: NextRequest) {
  const auth = await requireEmpresaAuth(request, { modulo: 'CONTAS_PAGAR', acao: 'GESTAO' })
  if (auth.error || !auth.session || !auth.empresa) return NextResponse.json({ erro: auth.error }, { status: auth.status })
  if (!CAPACIDADES_CONTAS_PAGAR[auth.empresa.plano].exportacaoLote) return NextResponse.json({ erro: 'A exportação em lote está disponível no plano Enterprise.' }, { status: 403 })
  const limited = await applyRateLimit(request, `contas-pagar-export:${auth.session.userId}`, RATE_LIMITS.REPORT_GENERATE.limit, RATE_LIMITS.REPORT_GENERATE.windowMs)
  if (limited) return limited
  const contas = await prisma.contaPagar.findMany({ where: { empresaId: auth.empresaId! }, orderBy: { vencimento: 'asc' }, take: 5_000 })
  const arquivo = await gerarBackupEmpresaExcel([{ nome: 'Contas a pagar', linhas: contas.map(conta => ({
    descricao: conta.descricao, fornecedor: conta.fornecedor, vencimento: conta.vencimento,
    valor: Number(conta.valor), status: conta.status,
    linha_digitavel: decryptSensitive(conta.linha_digitavel, auth.empresaId!, 'contaPagar.linhaDigitavel') ?? '', pago_em: conta.pago_em,
  })) }])
  return new NextResponse(new Uint8Array(arquivo), {
    headers: { 'Content-Type': EXCEL_MIME, 'Content-Disposition': 'attachment; filename="contas-a-pagar.xlsx"', 'Cache-Control': 'private, no-store' },
  })
}

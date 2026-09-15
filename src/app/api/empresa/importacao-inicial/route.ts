import { NextRequest, NextResponse } from 'next/server'
import { requireEmpresaAuth } from '@/lib/empresaAuth'
import { prisma } from '@/lib/prisma'
import { applyRateLimit } from '@/lib/rateLimit'
import { EXCEL_MIME } from '@/lib/excelFormatting'
import { gerarModeloImportacao, lerPlanilhaImportacao } from '@/lib/importacaoInicialExcel'
import { enviarImportacao } from '@/lib/importacaoInicial'
import { CABECALHOS_IMPORTACAO, lerUploadLimitado, respostaErroImportacao } from '@/lib/importacaoHttp'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = await requireEmpresaAuth(request, { acao: 'GESTAO' })
  if (auth.error || !auth.session || !auth.empresaId || !auth.empresa) return NextResponse.json({ erro: auth.error }, { status: auth.status })
  try {
    if (request.nextUrl.searchParams.get('modelo') === 'true') {
      const limited = await applyRateLimit(request, `import-modelo:${auth.session.userId}`, 20, 3600000)
      if (limited) return limited
      const data = await gerarModeloImportacao(auth.empresa.nome)
      return new NextResponse(new Uint8Array(data), { headers: { ...CABECALHOS_IMPORTACAO, 'Content-Type': EXCEL_MIME, 'Content-Disposition': 'attachment; filename="rpmtruck-importacao-inicial.xlsx"' } })
    }
    const registro = await prisma.importacaoInicial.findUnique({ where: { empresaId: auth.empresaId }, select: { status: true, resumo: true, checksum: true, motivo: true, atualizado_em: true, aprovado_em: true } })
    return NextResponse.json({ importacao: registro }, { headers: CABECALHOS_IMPORTACAO })
  } catch (error) { return respostaErroImportacao(error) }
}

export async function POST(request: NextRequest) {
  const auth = await requireEmpresaAuth(request, { acao: 'GESTAO' })
  if (auth.error || !auth.session || !auth.empresaId) return NextResponse.json({ erro: auth.error }, { status: auth.status })
  const limited = await applyRateLimit(request, `import-upload:${auth.empresaId}`, 10, 3600000)
  if (limited) return limited
  try {
    const lote = await lerPlanilhaImportacao(await lerUploadLimitado(request))
    const registro = await enviarImportacao(auth.empresaId, auth.session.userId, lote)
    return NextResponse.json({ importacao: registro }, { status: 201, headers: CABECALHOS_IMPORTACAO })
  } catch (error) { return respostaErroImportacao(error) }
}

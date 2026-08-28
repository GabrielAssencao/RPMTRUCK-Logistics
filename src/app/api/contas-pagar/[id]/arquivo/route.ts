import { NextRequest, NextResponse } from 'next/server'
import { requireEmpresaAuth } from '@/lib/empresaAuth'
import { prisma } from '@/lib/prisma'
import { applyRateLimit, RATE_LIMITS } from '@/lib/rateLimit'
import { criarUrlAssinadaContaPagar, ArquivoContaPagarError } from '@/lib/contasPagarStorage'

export async function GET(request: NextRequest, context: RouteContext<'/api/contas-pagar/[id]/arquivo'>) {
  const auth = await requireEmpresaAuth(request, { modulo: 'GESTAO', acao: 'LEITURA' })
  if (auth.error || !auth.session) return NextResponse.json({ erro: auth.error }, { status: auth.status })
  const limited = await applyRateLimit(request, `contas-pagar-arquivo:${auth.session.userId}`, RATE_LIMITS.REPORT_DOWNLOAD.limit, RATE_LIMITS.REPORT_DOWNLOAD.windowMs)
  if (limited) return limited
  const { id } = await context.params
  const tipo = request.nextUrl.searchParams.get('tipo')
  if (tipo !== 'boleto' && tipo !== 'comprovante') return NextResponse.json({ erro: 'Tipo de arquivo inválido.' }, { status: 400 })
  const conta = await prisma.contaPagar.findFirst({
    where: { id, empresaId: auth.empresaId! },
    select: { boleto_path: true, comprovante_path: true },
  })
  const caminho = tipo === 'boleto' ? conta?.boleto_path : conta?.comprovante_path
  if (!caminho) return NextResponse.json({ erro: 'Arquivo não encontrado.' }, { status: 404 })
  try {
    return NextResponse.json({ url: await criarUrlAssinadaContaPagar(caminho), expiraEmSegundos: 60 }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    if (error instanceof ArquivoContaPagarError) return NextResponse.json({ erro: error.message }, { status: error.status })
    return NextResponse.json({ erro: 'Não foi possível abrir o arquivo.' }, { status: 500 })
  }
}

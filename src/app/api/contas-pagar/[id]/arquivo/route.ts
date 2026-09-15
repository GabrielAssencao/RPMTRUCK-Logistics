import { NextRequest, NextResponse } from 'next/server'
import { requireEmpresaAuth } from '@/lib/empresaAuth'
import { prisma } from '@/lib/prisma'
import { applyRateLimit, RATE_LIMITS } from '@/lib/rateLimit'
import { criarUrlAssinadaContaPagar, ArquivoContaPagarError } from '@/lib/financeiro/contasPagarStorage'

export async function GET(request: NextRequest, context: RouteContext<'/api/contas-pagar/[id]/arquivo'>) {
  const auth = await requireEmpresaAuth(request, { modulo: 'CONTAS_PAGAR', acao: 'LEITURA' })
  if (auth.error || !auth.session) return NextResponse.json({ erro: auth.error }, { status: auth.status })
  const limited = await applyRateLimit(request, `contas-pagar-arquivo:${auth.session.userId}`, RATE_LIMITS.REPORT_DOWNLOAD.limit, RATE_LIMITS.REPORT_DOWNLOAD.windowMs)
  if (limited) return limited
  const { id } = await context.params
  const tipo = request.nextUrl.searchParams.get('tipo')
  const modo = request.nextUrl.searchParams.get('modo')
  if (tipo !== 'boleto' && tipo !== 'comprovante') return NextResponse.json({ erro: 'Tipo de arquivo inválido.' }, { status: 400 })
  if (modo && modo !== 'visualizar' && modo !== 'baixar') return NextResponse.json({ erro: 'Modo de acesso inválido.' }, { status: 400 })

  const conta = await prisma.contaPagar.findFirst({
    where: { id, empresaId: auth.empresaId! },
    select: {
      boleto_path: true, boleto_nome: true, boleto_mime: true, boleto_tamanho: true,
      comprovante_path: true, comprovante_nome: true, comprovante_mime: true, comprovante_tamanho: true,
    },
  })
  const arquivo = tipo === 'boleto'
    ? { caminho: conta?.boleto_path, nome: conta?.boleto_nome, mime: conta?.boleto_mime, tamanho: conta?.boleto_tamanho }
    : { caminho: conta?.comprovante_path, nome: conta?.comprovante_nome, mime: conta?.comprovante_mime, tamanho: conta?.comprovante_tamanho }
  if (!arquivo.caminho) return NextResponse.json({ erro: 'Arquivo não encontrado.' }, { status: 404 })

  try {
    const nome = arquivo.nome || `${tipo}.${arquivo.mime === 'application/pdf' ? 'pdf' : 'jpg'}`
    const url = await criarUrlAssinadaContaPagar(arquivo.caminho, modo === 'baixar' ? nome : undefined)
    if (modo) {
      const response = NextResponse.redirect(url, 307)
      response.headers.set('Cache-Control', 'private, no-store')
      return response
    }
    return NextResponse.json({ url, nome, mime: arquivo.mime, tamanho: arquivo.tamanho, expiraEmSegundos: 60 }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    if (error instanceof ArquivoContaPagarError) return NextResponse.json({ erro: error.message }, { status: error.status })
    return NextResponse.json({ erro: 'Não foi possível abrir o arquivo.' }, { status: 500 })
  }
}

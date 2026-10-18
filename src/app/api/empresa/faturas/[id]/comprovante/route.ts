import { NextRequest, NextResponse } from 'next/server'
import { requireEmpresaAuth } from '@/lib/empresaAuth'
import { prisma } from '@/lib/prisma'
import { applyRateLimit, RATE_LIMITS } from '@/lib/rateLimit'
import { lerFormularioLimitado } from '@/lib/requestBody'
import { ArquivoCobrancaPixError, criarUrlAssinadaCobrancaPix, removerArquivoCobrancaPix, salvarArquivoCobrancaPix } from '@/lib/financeiro/cobrancaPixStorage'
import { registrarArquivoSemVarredura } from '@/lib/antimalwareBacklog'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest, context: RouteContext<'/api/empresa/faturas/[id]/comprovante'>) {
  const auth = await requireEmpresaAuth(request, { acao: 'GESTAO' })
  if (auth.error || !auth.session?.empresaId) return NextResponse.json({ erro: auth.error }, { status: auth.status })
  const limited = await applyRateLimit(request, `fatura-arquivo:${auth.session.userId}`, RATE_LIMITS.REPORT_DOWNLOAD.limit, RATE_LIMITS.REPORT_DOWNLOAD.windowMs)
  if (limited) return limited
  const { id } = await context.params
  const fatura = await prisma.fatura.findFirst({ where: { id, empresaId: auth.session.empresaId }, select: { comprovantePath: true, comprovanteNome: true } })
  if (!fatura?.comprovantePath) return NextResponse.json({ erro: 'Comprovante não encontrado.' }, { status: 404 })
  try { return NextResponse.redirect(await criarUrlAssinadaCobrancaPix(fatura.comprovantePath, fatura.comprovanteNome ?? 'comprovante.pdf')) } catch (error) {
    if (error instanceof ArquivoCobrancaPixError) return NextResponse.json({ erro: error.message }, { status: error.status })
    return NextResponse.json({ erro: "Documento indisponivel." }, { status: 503 })
  }
}

export async function POST(request: NextRequest, context: RouteContext<'/api/empresa/faturas/[id]/comprovante'>) {
  const auth = await requireEmpresaAuth(request, { acao: 'GESTAO' })
  if (auth.error || !auth.session?.empresaId) return NextResponse.json({ erro: auth.error }, { status: auth.status })
  const limited = await applyRateLimit(request, `fatura-comprovante:${auth.session.userId}`, RATE_LIMITS.FILE_UPLOAD.limit, RATE_LIMITS.FILE_UPLOAD.windowMs)
  if (limited) return limited
  const { id } = await context.params
  try {
    const form = await lerFormularioLimitado(request)
    const arquivo = form.get('comprovante')
    if (!(arquivo instanceof File)) return NextResponse.json({ erro: 'Selecione o comprovante em PDF.' }, { status: 400 })
    const fatura = await prisma.fatura.findFirst({ where: { id, empresaId: auth.session.empresaId, status: 'PENDENTE' }, select: { id: true, comprovantePath: true } })
    if (!fatura) return NextResponse.json({ erro: 'Fatura pendente não encontrada.' }, { status: 404 })
    const salvo = await salvarArquivoCobrancaPix(arquivo, `${auth.session.empresaId}/${id}`, 'comprovante')
    try {
      await prisma.fatura.update({ where: { id }, data: { comprovantePath: salvo.caminho, comprovanteNome: salvo.nome, comprovanteMime: salvo.mime, comprovanteTamanho: salvo.tamanho, comprovanteEnviadoEm: new Date(), comprovanteEnviadoPorId: auth.session.userId } })
    } catch (erro) { await removerArquivoCobrancaPix(salvo.caminho); throw erro }
    await registrarArquivoSemVarredura({
      verificado: salvo.antimalwareVerificado, empresaId: auth.session.empresaId, usuarioId: auth.session.userId,
      bucket: 'cobrancas-pix-privadas', caminho: salvo.caminho, nome: salvo.nome, mime: salvo.mime,
      origem: 'FATURA_COMPROVANTE', origemId: id,
    })
    await removerArquivoCobrancaPix(fatura.comprovantePath)
    return NextResponse.json({ sucesso: true, mensagem: 'Comprovante enviado. O pagamento será confirmado pelo administrador.' })
  } catch (erro) {
    if (erro instanceof ArquivoCobrancaPixError) return NextResponse.json({ erro: erro.message }, { status: erro.status })
    console.error('Erro ao salvar comprovante Pix:', erro)
    return NextResponse.json({ erro: 'Não foi possível enviar o comprovante.' }, { status: 500 })
  }
}

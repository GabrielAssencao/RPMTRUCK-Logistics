import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { ImportacaoError } from '@/lib/importacaoInicial'
import { IMPORTACAO_MAX_BYTES, PlanilhaImportacaoError } from '@/lib/importacaoInicialExcel'
import { lerCorpoLimitado, RequestBodyError } from '@/lib/requestBody'

export async function lerUploadLimitado(request: Request) {
  if (!request.body) throw new PlanilhaImportacaoError('Envie uma planilha de até 2 MB.')
  try {
    return Buffer.from(await lerCorpoLimitado(request, IMPORTACAO_MAX_BYTES))
  } catch (error) {
    if (error instanceof RequestBodyError) throw new PlanilhaImportacaoError('A planilha excede o limite de 2 MB.')
    throw error
  }
}
export function respostaErroImportacao(error: unknown) {
  if (error instanceof PlanilhaImportacaoError) return NextResponse.json({ erro: error.message, erros: error.erros }, { status: 400 })
  if (error instanceof ImportacaoError) return NextResponse.json({ erro: error.message }, { status: error.status })
  if (error instanceof Prisma.PrismaClientKnownRequestError && ['P2002', 'P2034'].includes(error.code)) return NextResponse.json({ erro: 'Os dados mudaram ou há cadastros repetidos. Atualize a página e revise a planilha; nenhum registro deste lote foi incluído.' }, { status: 409 })
  return NextResponse.json({ erro: 'Não foi possível concluir a importação. Nenhum dado deste lote foi incluído. Tente novamente.' }, { status: 500 })
}
export const CABECALHOS_IMPORTACAO = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' }

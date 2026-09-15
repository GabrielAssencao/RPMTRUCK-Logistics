import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdminAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { applyRateLimit } from '@/lib/rateLimit'
import { decidirImportacao, lerLoteProtegido, validarContextoImportacao, ImportacaoError } from '@/lib/importacaoInicial'
import { CABECALHOS_IMPORTACAO, respostaErroImportacao } from '@/lib/importacaoHttp'
import { textoOperacional } from '@/lib/domainValidation'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
const decisaoSchema = z.object({ acao: z.enum(['APROVAR', 'REJEITAR']), checksum: z.string().regex(/^[a-f0-9]{64}$/), motivo: textoOperacional(5, 500).optional() }).strict().refine(v => v.acao !== 'REJEITAR' || Boolean(v.motivo), { message: 'Explique o que precisa ser corrigido.' })
type Context = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, context: Context) {
  const auth = await requireAdminAuth(request)
  if (auth.error || !auth.session) return NextResponse.json({ erro: auth.error }, { status: auth.status })
  const { id } = await context.params
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ erro: 'Empresa inválida.' }, { status: 400 })
  try {
    const empresa = await prisma.empresa.findFirst({ where: { id, excluidoEm: null }, select: { nome: true } })
    if (!empresa) return NextResponse.json({ erro: 'Empresa não encontrada.' }, { status: 404 })
    const registro = await prisma.importacaoInicial.findUnique({ where: { empresaId: id } })
    if (!registro) return NextResponse.json({ importacao: null }, { headers: CABECALHOS_IMPORTACAO })
    const { dados, ...metadata } = registro
    const lote = registro.status === 'PENDENTE' ? lerLoteProtegido(dados, id, registro.checksum) : null
    const problemas: string[] = []
    if (lote) try { await validarContextoImportacao(prisma, id, lote) } catch (error) { if (error instanceof ImportacaoError) problemas.push(error.message); else throw error }
    return NextResponse.json({ importacao: metadata, lote, problemas }, { headers: CABECALHOS_IMPORTACAO })
  } catch (error) { return respostaErroImportacao(error) }
}

export async function PATCH(request: NextRequest, context: Context) {
  const auth = await requireAdminAuth(request)
  if (auth.error || !auth.session) return NextResponse.json({ erro: auth.error }, { status: auth.status })
  const limited = await applyRateLimit(request, `import-review:${auth.session.userId}`, 30, 3600000)
  if (limited) return limited
  const { id } = await context.params
  const parsed = decisaoSchema.safeParse(await request.json().catch(() => null))
  if (!z.string().uuid().safeParse(id).success || !parsed.success) return NextResponse.json({ erro: parsed.error?.issues[0]?.message ?? 'Revise os dados da decisão.' }, { status: 400 })
  try {
    const registro = await decidirImportacao(id, auth.session.userId, parsed.data.checksum, parsed.data.acao === 'APROVAR', parsed.data.motivo)
    return NextResponse.json({ importacao: { status: registro.status, resumo: registro.resumo, checksum: registro.checksum } }, { headers: CABECALHOS_IMPORTACAO })
  } catch (error) { return respostaErroImportacao(error) }
}

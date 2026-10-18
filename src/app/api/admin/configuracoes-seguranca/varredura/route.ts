import { NextRequest, NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/auth'
import { processarFilaAntimalware } from '@/lib/antimalwareBacklog'
import { verificacaoAntimalwareObrigatoria } from '@/lib/antimalwarePolicy'
import { applyRateLimit, RATE_LIMITS } from '@/lib/rateLimit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const auth = await requireAdminAuth(request)
  if (auth.error || !auth.session) return NextResponse.json({ erro: auth.error }, { status: auth.status })
  const limited = await applyRateLimit(request, `admin-antimalware:${auth.session.userId}`, RATE_LIMITS.ADMIN_MUTATION.limit, RATE_LIMITS.ADMIN_MUTATION.windowMs)
  if (limited) return limited
  if (!await verificacaoAntimalwareObrigatoria()) return NextResponse.json({ erro: 'Reative a protecao antes de iniciar a varredura.' }, { status: 409 })
  try {
    return NextResponse.json(await processarFilaAntimalware(5), { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    console.error('Falha ao processar fila antimalware:', error)
    return NextResponse.json({ erro: 'Nao foi possivel processar a fila antimalware.' }, { status: 500 })
  }
}

import { timingSafeEqual } from 'node:crypto'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { executarLimpezaRetencao } from '@/lib/retencaoDados'
import { applyRateLimit, RATE_LIMITS } from '@/lib/rateLimit'
import { atualizarCobrancasMensais, emitirMensalidadesAutomaticas, enviarAvisosVencimentoMensalidades } from '@/lib/financeiro/cicloCobranca'
import { processarTransicoesPromocionaisRecorrencia } from '@/lib/financeiro/transicaoPromocaoRecorrencia'

import { limparLembretesConcluidos } from '@/lib/lembreteRetencao'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function segredoValido(request: NextRequest, segredo: string) {
  const esperado = Buffer.from(`Bearer ${segredo}`)
  const recebido = Buffer.from(request.headers.get('authorization') ?? '')
  return esperado.length === recebido.length && timingSafeEqual(esperado, recebido)
}

export async function GET(request: NextRequest) {
  const segredo = process.env.CRON_SECRET?.trim()
  if (!segredo || segredo.length < 32) {
    console.error('CRON_SECRET ausente ou inseguro; limpeza de retenção não executada.')
    return NextResponse.json({ erro: 'Rotina de retenção indisponível.' }, { status: 503 })
  }
  if (!segredoValido(request, segredo)) {
    return NextResponse.json({ erro: 'Não autorizado.' }, { status: 401 })
  }

  try {
    const limited = await applyRateLimit(request, 'retention-run', RATE_LIMITS.RETENTION_RUN.limit, RATE_LIMITS.RETENTION_RUN.windowMs)
    if (limited) return limited
    const cobrancas = await atualizarCobrancasMensais()
    const cobrancasAsaas = await emitirMensalidadesAutomaticas()
    const avisosPagamento = await enviarAvisosVencimentoMensalidades()
    const transicoesPromocionais = await processarTransicoesPromocionaisRecorrencia()
    const lembretesRemovidos = await limparLembretesConcluidos()
    const resultado = await executarLimpezaRetencao()
    return NextResponse.json({ ...resultado, cobrancas, cobrancasAsaas, avisosPagamento, transicoesPromocionais, lembretesRemovidos }, {
      status: resultado.falhasEmpresas > 0 || cobrancasAsaas.falhas > 0
        || transicoesPromocionais.falhas > 0 || transicoesPromocionais.falhasSuspensao > 0 ? 500 : 200,
      headers: { 'Cache-Control': 'private, no-store' },
    })
  } catch (error) {
    console.error('Falha na rotina interna de retenção:', error)
    return NextResponse.json(
      { erro: 'A rotina de retenção não foi concluída.' },
      { status: 500, headers: { 'Cache-Control': 'private, no-store' } },
    )
  }
}

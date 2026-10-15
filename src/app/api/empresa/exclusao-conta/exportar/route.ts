import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { requireEmpresaAuth } from '@/lib/empresaAuth'
import { gerarArquivoBackupEmpresa } from '@/lib/empresaBackup'
import { criarTokenBackupEmpresa } from '@/lib/empresaBackupToken'
import { applyRateLimit, RATE_LIMITS } from '@/lib/rateLimit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const auth = await requireEmpresaAuth(request, { acao: 'GESTAO' })
  if (auth.error || !auth.session || !auth.empresaId) return NextResponse.json({ erro: auth.error }, { status: auth.status })
  const limited = await applyRateLimit(request, `account-deletion-export:${auth.empresaId}:${auth.session.userId}`, RATE_LIMITS.REPORT_GENERATE.limit, RATE_LIMITS.REPORT_GENERATE.windowMs)
  if (limited) return limited

  const backup = await gerarArquivoBackupEmpresa(auth.empresaId)
  if (!backup) return NextResponse.json({ erro: 'Empresa não encontrada.' }, { status: 404 })
  const token = await criarTokenBackupEmpresa(auth.session.userId, auth.empresaId)
  const data = new Date().toISOString().slice(0, 10)

  return new NextResponse(new Uint8Array(backup.arquivo), {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="rpmtruck-backup-${data}.xlsx"`,
      'Content-Length': String(backup.arquivo.length),
      'X-RPMTruck-Backup-Token': token,
      'Cache-Control': 'private, no-store, max-age=0',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}

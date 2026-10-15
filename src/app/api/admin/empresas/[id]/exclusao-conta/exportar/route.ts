import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdminAuth } from '@/lib/auth'
import { gerarArquivoBackupEmpresa } from '@/lib/empresaBackup'
import { criarTokenBackupEmpresa } from '@/lib/empresaBackupToken'
import { prisma } from '@/lib/prisma'
import { applyRateLimit, RATE_LIMITS } from '@/lib/rateLimit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminAuth(request)
  if (auth.error || !auth.session) return NextResponse.json({ erro: auth.error }, { status: auth.status })
  const { id } = await props.params
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ erro: 'Empresa inválida.' }, { status: 400 })
  const limited = await applyRateLimit(request, `admin-account-deletion-export:${auth.session.userId}:${id}`, RATE_LIMITS.REPORT_GENERATE.limit, RATE_LIMITS.REPORT_GENERATE.windowMs)
  if (limited) return limited

  const backup = await gerarArquivoBackupEmpresa(id)
  if (!backup) return NextResponse.json({ erro: 'Empresa não encontrada ou já excluída.' }, { status: 404 })
  const token = await criarTokenBackupEmpresa(auth.session.userId, id)
  await prisma.auditoriaLog.create({ data: { tabela: 'empresas', acao: 'EXPORTACAO_PRE_EXCLUSAO', registroId: id, empresaId: id, usuarioId: auth.session.userId, origem: 'SUPERADMIN' } })
  const data = new Date().toISOString().slice(0, 10)

  return new NextResponse(new Uint8Array(backup.arquivo), { status: 200, headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': `attachment; filename="rpmtruck-encerramento-${data}-${id.slice(0, 8)}.xlsx"`, 'Content-Length': String(backup.arquivo.length), 'X-RPMTruck-Backup-Token': token, 'Cache-Control': 'private, no-store, max-age=0', 'X-Content-Type-Options': 'nosniff' } })
}

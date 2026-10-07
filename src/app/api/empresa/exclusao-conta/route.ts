import { OperacaoFinanceiraError } from '@/lib/financeiro/operacaoFinanceira'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireEmpresaAuth } from '@/lib/empresaAuth'
import { validarTokenBackupEmpresa } from '@/lib/empresaBackupToken'
import { executarExclusaoEmpresa } from '@/lib/empresaExclusao'
import { verifyPassword } from '@/lib/password'
import { prisma } from '@/lib/prisma'
import { applyRateLimit, RATE_LIMITS } from '@/lib/rateLimit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const CONFIRMACAO = 'EXCLUIR MINHA EMPRESA'
const schema = z.object({ senha: z.string().min(1).max(128), confirmacao: z.literal(CONFIRMACAO), backupToken: z.string().min(40).max(4_096), backupConfirmado: z.literal(true), retencoesAvaliadas: z.literal(true).optional() }).strict()

export async function POST(request: NextRequest) {
  const auth = await requireEmpresaAuth(request, { acao: 'GESTAO' })
  if (auth.error || !auth.session || !auth.empresaId) return NextResponse.json({ erro: auth.error }, { status: auth.status })
  const limited = await applyRateLimit(request, `account-deletion:${auth.empresaId}:${auth.session.userId}`, RATE_LIMITS.PASSWORD_RESET_ACCOUNT.limit, RATE_LIMITS.PASSWORD_RESET_ACCOUNT.windowMs)
  if (limited) return limited
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ erro: `Confirme o backup e digite exatamente “${CONFIRMACAO}”.` }, { status: 400 })
  if (!(await validarTokenBackupEmpresa(parsed.data.backupToken, auth.session.userId, auth.empresaId))) return NextResponse.json({ erro: 'O comprovante de backup expirou. Gere e baixe um novo arquivo Excel.' }, { status: 409 })
  const usuario = await prisma.usuario.findFirst({ where: { id: auth.session.userId, empresaId: auth.empresaId }, select: { senha_hash: true } })
  if (!usuario || !(await verifyPassword(parsed.data.senha, usuario.senha_hash))) return NextResponse.json({ erro: 'A senha informada está incorreta.' }, { status: 400 })

  try {
    const resultado = await executarExclusaoEmpresa({ empresaId: auth.empresaId, solicitadoPorId: auth.session.userId, origem: 'API', motivo: 'Conta excluída pelo gestor.' })
    if (!resultado.encontrado) return NextResponse.json({ erro: 'Empresa não encontrada ou já excluída.' }, { status: 404 })
    const response = NextResponse.json({ sucesso: true, storagePendente: resultado.storagePendente, protocolo: resultado.protocolo, mensagem: resultado.storagePendente ? 'Os dados foram removidos. A limpeza dos arquivos privados foi registrada para nova tentativa.' : 'Os dados operacionais, identificadores pessoais e arquivos privados foram removidos.' }, { status: resultado.storagePendente ? 202 : 200 })
    response.cookies.delete('rpmtruck_session')
    return response
  } catch (error) {
    if (error instanceof OperacaoFinanceiraError) return NextResponse.json({ erro: error.message }, { status: error.status })
    console.error('Falha no expurgo transacional da empresa:', error)
    return NextResponse.json({ erro: 'Não foi possível concluir a exclusão. Nenhum expurgo parcial do banco foi confirmado.' }, { status: 500 })
  }
}

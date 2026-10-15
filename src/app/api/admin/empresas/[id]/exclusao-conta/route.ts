import { OperacaoFinanceiraError } from '@/lib/financeiro/operacaoFinanceira'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdminAuth } from '@/lib/auth'
import { validarTokenBackupEmpresa } from '@/lib/empresaBackupToken'
import { executarExclusaoEmpresa } from '@/lib/empresaExclusao'
import { verifyPassword } from '@/lib/password'
import { prisma } from '@/lib/prisma'
import { applyRateLimit, RATE_LIMITS } from '@/lib/rateLimit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const schema = z.object({ senha: z.string().min(1).max(128), confirmacao: z.string().trim().min(10).max(220), backupToken: z.string().min(40).max(4_096), backupConfirmado: z.literal(true), retencoesAvaliadas: z.literal(true), motivo: z.string().trim().min(5).max(300) }).strict()

export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminAuth(request)
  if (auth.error || !auth.session) return NextResponse.json({ erro: auth.error }, { status: auth.status })
  const { id } = await props.params
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ erro: 'Empresa inválida.' }, { status: 400 })
  const limited = await applyRateLimit(request, `admin-account-deletion:${auth.session.userId}:${id}`, RATE_LIMITS.PASSWORD_RESET_ACCOUNT.limit, RATE_LIMITS.PASSWORD_RESET_ACCOUNT.windowMs)
  if (limited) return limited
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ erro: 'Preencha todas as confirmações de encerramento.' }, { status: 400 })

  const [empresa, administrador] = await Promise.all([
    prisma.empresa.findFirst({ where: { id, excluidoEm: null }, select: { nome: true } }),
    prisma.usuario.findFirst({ where: { id: auth.session.userId, empresaId: null, ativo: true, excluidoEm: null }, select: { senha_hash: true } }),
  ])
  if (!empresa) return NextResponse.json({ erro: 'Empresa não encontrada ou já excluída.' }, { status: 404 })
  const frase = `EXCLUIR ${empresa.nome}`
  if (parsed.data.confirmacao !== frase) return NextResponse.json({ erro: `Digite exatamente “${frase}”.` }, { status: 400 })
  if (!(await validarTokenBackupEmpresa(parsed.data.backupToken, auth.session.userId, id))) return NextResponse.json({ erro: 'O comprovante de exportação expirou. Gere e confira um novo arquivo.' }, { status: 409 })
  if (!administrador || !(await verifyPassword(parsed.data.senha, administrador.senha_hash))) return NextResponse.json({ erro: 'A senha do administrador está incorreta.' }, { status: 400 })

  try {
    const resultado = await executarExclusaoEmpresa({ empresaId: id, solicitadoPorId: auth.session.userId, origem: 'SUPERADMIN', motivo: `Conta encerrada pelo Superadmin: ${parsed.data.motivo}` })
    if (!resultado.encontrado) return NextResponse.json({ erro: 'Empresa não encontrada ou já excluída.' }, { status: 404 })
    return NextResponse.json({ sucesso: true, storagePendente: resultado.storagePendente, protocolo: resultado.protocolo, mensagem: resultado.storagePendente ? 'Dados removidos; a limpeza de arquivos privados ficou registrada para nova tentativa.' : 'Conta encerrada e dados operacionais removidos.' }, { status: resultado.storagePendente ? 202 : 200 })
  } catch (error) {
    if (error instanceof OperacaoFinanceiraError) return NextResponse.json({ erro: error.message }, { status: error.status })
    console.error('Falha na exclusão administrativa da empresa:', error)
    return NextResponse.json({ erro: 'Não foi possível concluir o encerramento. Nenhum expurgo parcial do banco foi confirmado.' }, { status: 500 })
  }
}

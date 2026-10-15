import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireEmpresaAuth } from '@/lib/empresaAuth'
import { iniciarDesafioMfa } from '@/lib/adminMfa'
import { prisma } from '@/lib/prisma'
import { decryptSensitive } from '@/lib/fieldEncryption'
import { verificarTotp } from '@/lib/totp'
import { applyRateLimit } from '@/lib/rateLimit'

function gestor(role?: string) { return role === 'GESTOR_EMPRESA' || role === 'GESTOR' }

export async function GET(request: NextRequest) {
  const auth = await requireEmpresaAuth(request, { acao: 'GESTAO' })
  if (auth.error || !auth.session || !gestor(auth.session.role)) return NextResponse.json({ erro: auth.error || 'Apenas o gestor pode configurar o MFA.' }, { status: auth.error ? auth.status : 403 })
  const state = await prisma.mfaAdmin.findUnique({ where: { usuarioId: auth.session.userId }, select: { ativadoEm: true, obrigatorio: true } })
  return NextResponse.json({ ativo: Boolean(state?.ativadoEm), obrigatorio: Boolean(state?.obrigatorio), diasConfianca: 7, acessosConfianca: 10 }, { headers: { 'Cache-Control': 'private, no-store' } })
}

export async function POST(request: NextRequest) {
  const auth = await requireEmpresaAuth(request, { acao: 'GESTAO' })
  if (auth.error || !auth.session || !auth.usuario || !gestor(auth.session.role)) return NextResponse.json({ erro: auth.error || 'Apenas o gestor pode configurar o MFA.' }, { status: auth.error ? auth.status : 403 })
  const limited = await applyRateLimit(request, `mfa-enroll:${auth.session.userId}`, 5, 15 * 60_000)
  if (limited) return limited
  const state = await prisma.mfaAdmin.findUnique({ where: { usuarioId: auth.session.userId }, select: { ativadoEm: true } })
  if (state?.ativadoEm) return NextResponse.json({ erro: 'O segundo fator já está ativo.' }, { status: 409 })
  return NextResponse.json(await iniciarDesafioMfa(auth.session.userId, auth.usuario.email, auth.usuario.sessaoVersao, true), { status: 202, headers: { 'Cache-Control': 'no-store' } })
}

export async function DELETE(request: NextRequest) {
  const auth = await requireEmpresaAuth(request, { acao: 'GESTAO' })
  if (auth.error || !auth.session || !gestor(auth.session.role)) return NextResponse.json({ erro: auth.error || 'Apenas o gestor pode configurar o MFA.' }, { status: auth.error ? auth.status : 403 })
  const limited = await applyRateLimit(request, `mfa-disable:${auth.session.userId}`, 5, 15 * 60_000)
  if (limited) return limited
  const parsed = z.object({ codigo: z.string().trim().regex(/^\d{6}$/) }).strict().safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ erro: 'Informe o código de 6 dígitos do autenticador.' }, { status: 400 })
  const state = await prisma.mfaAdmin.findUnique({ where: { usuarioId: auth.session.userId } })
  if (!state?.ativadoEm) return NextResponse.json({ erro: 'O segundo fator não está ativo.' }, { status: 409 })
  const counter = verificarTotp(decryptSensitive(state.segredo, auth.session.userId, 'mfa.segredo')!, parsed.data.codigo, state.ultimoContador)
  if (counter === null) return NextResponse.json({ erro: 'Código inválido ou já utilizado.' }, { status: 401 })
  await prisma.$transaction(async tx => {
    await tx.mfaAdmin.delete({ where: { usuarioId: auth.session!.userId } })
    await tx.dispositivoConfiavel.deleteMany({ where: { usuarioId: auth.session!.userId } })
    await tx.sessaoUsuario.updateMany({ where: { usuarioId: auth.session!.userId, revogadaEm: null }, data: { revogadaEm: new Date() } })
    await tx.usuario.update({ where: { id: auth.session!.userId }, data: { sessaoVersao: { increment: 1 } } })
  })
  return NextResponse.json({ sucesso: true, relogin: true })
}

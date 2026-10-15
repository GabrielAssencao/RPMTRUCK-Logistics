import { randomBytes } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { createSession, isAdminRole } from '@/lib/auth'
import { hashRecuperacao, iniciarDesafioMfa, lerDesafioMfa, MFA_COOKIE } from '@/lib/adminMfa'
import { decryptSensitive, encryptSensitive } from '@/lib/fieldEncryption'
import { verificarTotp, novoSegredoTotp } from '@/lib/totp'
import { applyRateLimit, getClientIp } from '@/lib/rateLimit'
import { pseudonymize, safeUserAgent, recordSecurityEvent } from '@/lib/securityEvents'
import { lerJsonLimitado, RequestBodyError } from '@/lib/requestBody'
import { proximaMeiaNoiteBrasilia } from '@/lib/brasiliaTime'
import { registrarDispositivoConfiavel, revogarDispositivosConfiaveis } from '@/lib/trustedDevice'
import { verificarAcessoFinanceiro } from '@/lib/financeiro/acessoFinanceiro'
import { podeRegularizarFinanceiro } from '@/lib/financeiro/situacaoFinanceira'

export async function POST(request: NextRequest) {
  const ip = getClientIp(request)
  const limited = await applyRateLimit(request, `mfa-ip:${ip}`, 20, 15 * 60000)
  if (limited) return limited
  const challenge = await lerDesafioMfa(request)
  if (!challenge) return NextResponse.json({ erro: 'Entre novamente para iniciar a verificação.' }, { status: 401 })
  const accountLimit = await applyRateLimit(request, `mfa-user:${challenge.usuarioId}`, 5, 5 * 60000)
  if (accountLimit) return accountLimit
  try {
    const parsed = z.object({ codigo: z.string().trim().min(6).max(40) }).strict().safeParse(await lerJsonLimitado(request))
    if (!parsed.success) return NextResponse.json({ erro: 'Informe o código do autenticador ou de recuperação.' }, { status: 400 })
    const user = await prisma.usuario.findUnique({ where: { id: challenge.usuarioId }, include: { mfaAdmin: true } })
    const state = user?.mfaAdmin
    if (!user || (!isAdminRole(user.role) && !state?.obrigatorio && !state?.ativadoEm) || !user.ativo || user.excluidoEm || user.exigeTrocaSenha || user.sessaoVersao !== challenge.versao
      || !state || state.desafioHash !== challenge.hash || !state.desafioExpiraEm || state.desafioExpiraEm <= new Date()) {
      return NextResponse.json({ erro: 'Verificação expirada. Entre novamente.' }, { status: 401 })
    }
    const counter = verificarTotp(decryptSensitive(state.segredo, user.id, 'mfa.segredo')!, parsed.data.codigo, state.ultimoContador)
    const recoveryHash = hashRecuperacao(user.id, parsed.data.codigo)
    const recovery = Boolean(state.ativadoEm && state.recuperacao.includes(recoveryHash))
    if (counter === null && !recovery) {
      await recordSecurityEvent({ tipo: 'LOGIN_FALHA', request, usuarioId: user.id, ip, contexto: { etapa: 'MFA' } })
      return NextResponse.json({ erro: 'Código inválido ou já utilizado.' }, { status: 401 })
    }
    if (recovery) {
      // Lost device: consume the recovery credential and require enrollment of a
      // new authenticator before creating a privileged session.
      const consumed = await prisma.$transaction(async tx => {
        const claim = await tx.mfaAdmin.updateMany({
        where: { usuarioId: user.id, desafioHash: challenge.hash, desafioExpiraEm: { gt: new Date() }, recuperacao: { has: recoveryHash } },
        data: { segredo: encryptSensitive(novoSegredoTotp(), user.id, 'mfa.segredo')!, ativadoEm: null,
          ultimoContador: -1, recuperacao: [], desafioHash: null, desafioExpiraEm: null },
        })
        if (claim.count !== 1) return null
        await tx.dispositivoConfiavel.updateMany({ where: { usuarioId: user.id, revogadoEm: null }, data: { revogadoEm: new Date() } })
        await tx.sessaoUsuario.updateMany({ where: { usuarioId: user.id, revogadaEm: null }, data: { revogadaEm: new Date() } })
        return tx.usuario.update({ where: { id: user.id }, data: { sessaoVersao: { increment: 1 } }, select: { sessaoVersao: true } })
      })
      if (!consumed) return NextResponse.json({ erro: 'Código já utilizado. Entre novamente.' }, { status: 409 })
      await recordSecurityEvent({ tipo: 'SESSAO_REVOGADA', request, usuarioId: user.id, ip, contexto: { etapa: 'MFA_RECUPERACAO' } })
      return NextResponse.json(await iniciarDesafioMfa(user.id, user.email, consumed.sessaoVersao), { status: 202, headers: { 'Cache-Control': 'no-store' } })
    }
    const codes = !state.ativadoEm ? Array.from({ length: 10 }, () => randomBytes(12).toString('hex').toUpperCase()) : []
    const expires = proximaMeiaNoiteBrasilia()
    const sessao = await prisma.$transaction(async tx => {
      const claim = await tx.mfaAdmin.updateMany({
        where: { usuarioId: user.id, desafioHash: challenge.hash, desafioExpiraEm: { gt: new Date() }, ultimoContador: state.ultimoContador,
          ...(recovery ? { recuperacao: { has: recoveryHash } } : {}) },
        data: { desafioHash: null, desafioExpiraEm: null, ativadoEm: state.ativadoEm ?? new Date(),
          ultimoContador: counter ?? state.ultimoContador,
          recuperacao: codes.length ? codes.map(code => hashRecuperacao(user.id, code)) : state.recuperacao.filter(hash => !recovery || hash !== recoveryHash) },
      })
      if (claim.count !== 1) return null
      return tx.sessaoUsuario.create({ data: { usuarioId: user.id, empresaId: user.empresaId, ipHash: pseudonymize(ip), userAgent: safeUserAgent(request), expiraEm: expires }, select: { id: true } })
    })
    if (!sessao) return NextResponse.json({ erro: 'Código já utilizado. Entre novamente.' }, { status: 409 })
    try {
      await createSession({ userId: user.id, email: user.email, role: user.role, empresaId: user.empresaId ?? undefined, sessionId: sessao.id, sessionVersion: user.sessaoVersao, mfaVerified: true }, expires)
    } catch (error) {
      await prisma.sessaoUsuario.delete({ where: { id: sessao.id } })
      throw error
    }
    await recordSecurityEvent({ tipo: 'LOGIN_SUCESSO', request, usuarioId: user.id, ip, contexto: { etapa: 'MFA', recuperacao: recovery } })
    let acessoSomentePlano = false
    if (user.empresaId) {
      const financeiro = await verificarAcessoFinanceiro(user.empresaId)
      acessoSomentePlano = financeiro.bloqueado && podeRegularizarFinanceiro(user.role, 'situacao' in financeiro ? financeiro.situacao : undefined)
    }
    const response = NextResponse.json({ sucesso: true, codigosRecuperacao: codes, usuario: { id: user.id, nome: user.nome, email: user.email, role: user.role, empresa: null, empresaInfo: null, acessoSomentePlano } }, { headers: { 'Cache-Control': 'no-store' } })
    if (!isAdminRole(user.role)) {
      await revogarDispositivosConfiaveis(user.id)
      await registrarDispositivoConfiavel(request, response, user.id)
    }
    response.cookies.set(MFA_COOKIE, '', { maxAge: 0, path: '/api/auth/mfa' })
    return response
  } catch (error) {
    if (error instanceof RequestBodyError) return NextResponse.json({ erro: error.message }, { status: error.status })
    console.error('Falha na verificação MFA')
    return NextResponse.json({ erro: 'Não foi possível concluir a verificação. Tente entrar novamente.' }, { status: 503 })
  }
}

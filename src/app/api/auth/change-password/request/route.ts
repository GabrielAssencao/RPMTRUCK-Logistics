import { after, type NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { executarComAuditoria } from '@/lib/auditoria'
import { notificarAdmins } from '@/lib/notificacoes'
import { criarSolicitacaoRedefinicaoSenha } from '@/lib/passwordResetRequests'
import { applyRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rateLimit'

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request)
  if (auth.error || !auth.session || !auth.usuario) {
    return NextResponse.json({ erro: auth.error }, { status: auth.status })
  }
  if (auth.session.role !== 'GESTOR_EMPRESA') {
    return NextResponse.json({ erro: 'Apenas o gestor pode solicitar esta alteração.' }, { status: 403 })
  }

  const bloqueioIp = await applyRateLimit(
    request,
    `password-change-request:${getClientIp(request)}`,
    RATE_LIMITS.PASSWORD_RESET_IP.limit,
    RATE_LIMITS.PASSWORD_RESET_IP.windowMs,
  )
  if (bloqueioIp) return bloqueioIp

  const bloqueioConta = await applyRateLimit(
    request,
    `password-change-request-account:${auth.session.userId}`,
    RATE_LIMITS.PASSWORD_RESET_ACCOUNT.limit,
    RATE_LIMITS.PASSWORD_RESET_ACCOUNT.windowMs,
  )
  if (bloqueioConta) return bloqueioConta

  const solicitacaoCriada = await executarComAuditoria(
    { usuarioId: auth.session.userId, origem: 'API' },
    (tx) => criarSolicitacaoRedefinicaoSenha(tx, auth.usuario!.email),
  )

  if (solicitacaoCriada) {
    const email = auth.usuario.email
    after(async () => {
      await notificarAdmins({
        titulo: 'Alteração de senha solicitada pelo gestor',
        mensagem: `O gestor ${email} solicitou autorização para redefinir a própria senha.`,
        modulo: 'SENHAS',
      }).catch((error) => console.error('Falha ao notificar alteração de senha do gestor:', error))
    })
  }

  return NextResponse.json({
    sucesso: true,
    mensagem: 'Solicitação enviada ao superadmin. Aguarde a liberação do código de uso único.',
  }, { status: 202, headers: { 'Cache-Control': 'no-store' } })
}

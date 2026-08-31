// src/app/api/auth/reset-request/route.ts
import { after, NextRequest, NextResponse } from 'next/server';
import { notificarAdmins } from '@/lib/notificacoes';
import { z } from 'zod';
import { applyRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rateLimit';
import { executarComAuditoria } from '@/lib/auditoria';
import { verifyBotToken } from '@/lib/botProtection';
import { recordSecurityEvent } from '@/lib/securityEvents';
import { criarSolicitacaoRedefinicaoSenha } from '@/lib/passwordResetRequests';

const schema = z.object({
  email: z.string().trim().email().max(254).toLowerCase(),
  turnstileToken: z.string().max(2048).optional(),
}).strict();

const respostaPublica = {
  sucesso: true,
  mensagem: 'Se o e-mail estiver cadastrado, a solicitação será encaminhada para análise.',
} as const;

function respostaAceita() {
  return NextResponse.json(respostaPublica, {
    status: 202,
    headers: { 'Cache-Control': 'no-store' },
  });
}

export async function POST(request: NextRequest) {
  try {
    const bloqueio = await applyRateLimit(request, `reset:${getClientIp(request)}`, RATE_LIMITS.PASSWORD_RESET_IP.limit, RATE_LIMITS.PASSWORD_RESET_IP.windowMs);
    if (bloqueio) return bloqueio;
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ erro: 'Informe um e-mail válido.' }, { status: 400 });
    const { email } = parsed.data;
    const bloqueioConta = await applyRateLimit(
      request,
      `reset-account:${email}`,
      RATE_LIMITS.PASSWORD_RESET_ACCOUNT.limit,
      RATE_LIMITS.PASSWORD_RESET_ACCOUNT.windowMs,
    );
    if (bloqueioConta) return bloqueioConta;
    const bot = await verifyBotToken({
      token: parsed.data.turnstileToken,
      remoteIp: getClientIp(request),
      expectedAction: 'password_reset',
    });
    if (!bot.success) {
      await recordSecurityEvent({ tipo: 'BOT_REJEITADO', request, email, ip: getClientIp(request) });
      return NextResponse.json({ erro: 'Verificação de segurança recusada.' }, { status: 403 });
    }

    // Conta existente e ausente percorrem a mesma fronteira transacional e as
    // mesmas consultas iniciais. Apenas uma conta real pode gerar persistência.
    const solicitacaoCriada = await executarComAuditoria(
      { origem: 'PUBLIC_API' },
      (tx) => criarSolicitacaoRedefinicaoSenha(tx, email),
    );
    if (solicitacaoCriada) {
      after(async () => {
        await notificarAdmins({
          titulo: 'Redefinição de senha pendente',
          mensagem: `Há uma nova solicitação de segurança para ${email}.`,
          modulo: 'SENHAS',
        }).catch((error) => console.error('Falha ao notificar redefinição pendente:', error));
      });
    }

    return respostaAceita();

  } catch (error) {
    console.error('Erro na rota reset-request:', error);
    return NextResponse.json({ erro: 'Falha interna ao processar requisição de segurança.' }, { status: 500 });
  }
}

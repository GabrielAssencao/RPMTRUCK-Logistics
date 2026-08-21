// src/app/api/auth/reset-request/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { notificarAdmins } from '@/lib/notificacoes';
import { z } from 'zod';
import { applyRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rateLimit';
import { prisma } from '@/lib/prisma';
import { executarComAuditoria } from '@/lib/auditoria';

const schema = z.object({ email: z.string().trim().email().max(254).toLowerCase() }).strict();

export async function POST(request: NextRequest) {
  try {
    const bloqueio = await applyRateLimit(request, `reset:${getClientIp(request)}`, RATE_LIMITS.PASSWORD_RESET.limit, RATE_LIMITS.PASSWORD_RESET.windowMs);
    if (bloqueio) return bloqueio;
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ erro: 'Informe um e-mail válido.' }, { status: 400 });
    const { email } = parsed.data;
    const bloqueioConta = await applyRateLimit(
      request,
      `reset-account:${email}`,
      RATE_LIMITS.PASSWORD_RESET.limit,
      RATE_LIMITS.PASSWORD_RESET.windowMs,
    );
    if (bloqueioConta) return bloqueioConta;

    // Verifica se o usuário de fato existe no ecossistema RPMTruck
    const usuarioExistente = await prisma.usuario.findUnique({
      where: { email }
    });

    if (!usuarioExistente) {
      // Por motivos de segurança contra raspagem de dados, não confirmamos se o e-mail é válido ou não
      return NextResponse.json({ sucesso: true, mensagem: 'Se o e-mail constar em nossa base, a solicitação foi encaminhada para a triagem.' }, { status: 200 });
    }

    // Cria o registro de reset pendente que aparecerá no painel administrativo
    const solicitacaoCriada = await executarComAuditoria({ origem: 'PUBLIC_API' }, async (tx) => {
      const ativa = await tx.resetSenha.findFirst({
        where: { email, status: { in: ['PENDENTE', 'APROVADO'] } },
        select: { id: true, status: true, token_expira_em: true },
        orderBy: { atualizado_em: 'desc' },
      });
      if (ativa?.status === 'PENDENTE') return false;
      if (
        ativa?.status === 'APROVADO' &&
        ativa.token_expira_em &&
        ativa.token_expira_em > new Date()
      ) {
        return false;
      }

      await tx.resetSenha.updateMany({
        where: { email, status: { in: ['PENDENTE', 'APROVADO'] } },
        data: {
          status: 'REJEITADO',
          token_hash: null,
          token_expira_em: null,
        },
      });
      await tx.resetSenha.create({ data: { email, status: 'PENDENTE' } });
      return true;
    });
    if (solicitacaoCriada) {
      await notificarAdmins({ titulo: 'Redefinição de senha pendente', mensagem: `Há uma nova solicitação de segurança para ${email}.`, modulo: 'SENHAS' });
    }

    return NextResponse.json({ 
      sucesso: true, 
      mensagem: 'Solicitação de segurança aberta com sucesso na fila do Admin.' 
    }, { status: 201 });

  } catch (error) {
    console.error('Erro na rota reset-request:', error);
    return NextResponse.json({ erro: 'Falha interna ao processar requisição de segurança.' }, { status: 500 });
  }
}

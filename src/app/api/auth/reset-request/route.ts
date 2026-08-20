// src/app/api/auth/reset-request/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { notificarAdmins } from '@/lib/notificacoes';
import { z } from 'zod';
import { applyRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rateLimit';
import { prisma } from '@/lib/prisma';

const schema = z.object({ email: z.string().trim().email().max(254).toLowerCase() }).strict();

export async function POST(request: NextRequest) {
  try {
    const bloqueio = applyRateLimit(request, `reset:${getClientIp(request)}`, RATE_LIMITS.PASSWORD_RESET.limit, RATE_LIMITS.PASSWORD_RESET.windowMs);
    if (bloqueio) return bloqueio;
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ erro: 'Informe um e-mail válido.' }, { status: 400 });
    const { email } = parsed.data;

    // Verifica se o usuário de fato existe no ecossistema RPMTruck
    const usuarioExistente = await prisma.usuario.findUnique({
      where: { email }
    });

    if (!usuarioExistente) {
      // Por motivos de segurança contra raspagem de dados, não confirmamos se o e-mail é válido ou não
      return NextResponse.json({ sucesso: true, mensagem: 'Se o e-mail constar em nossa base, a solicitação foi encaminhada para a triagem.' }, { status: 200 });
    }

    // Cria o registro de reset pendente que aparecerá no painel administrativo
    await prisma.resetSenha.create({
      data: {
        email,
        status: 'PENDENTE'
      }
    });
    await notificarAdmins({ titulo: 'Redefinição de senha pendente', mensagem: `Há uma nova solicitação de segurança para ${email}.`, modulo: 'SENHAS' });

    return NextResponse.json({ 
      sucesso: true, 
      mensagem: 'Solicitação de segurança aberta com sucesso na fila do Admin.' 
    }, { status: 201 });

  } catch (error) {
    console.error('Erro na rota reset-request:', error);
    return NextResponse.json({ erro: 'Falha interna ao processar requisição de segurança.' }, { status: 500 });
  }
}

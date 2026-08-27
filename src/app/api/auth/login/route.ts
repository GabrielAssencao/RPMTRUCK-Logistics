// src/app/api/auth/login/route.ts
import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashPassword, passwordNeedsRehash, verifyLoginPassword } from '@/lib/password';
import { createSession } from '@/lib/auth';
import { loginSchema } from '@/lib/validation';
import { applyRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rateLimit';
import { normalizarModulos, PLANOS_CONFIG } from '@/utils/planos';
import { verifyBotToken } from '@/lib/botProtection';
import { pseudonymize, recordSecurityEvent, safeUserAgent } from '@/lib/securityEvents';

export async function POST(request: NextRequest) {
  try {
    // 1. Rate limiting: protege contra força bruta
    const clientIp = getClientIp(request);
    const rateLimitResult = await applyRateLimit(
      request,
      `login:${clientIp}`,
      RATE_LIMITS.LOGIN_IP.limit,
      RATE_LIMITS.LOGIN_IP.windowMs
    );

    if (rateLimitResult) {
      return rateLimitResult;
    }

    // 2. Parsear e validar entrada com Zod
    const parsed = loginSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ erro: 'Dados de entrada inválidos.' }, { status: 400 });
    }
    const { email, senha, novaSenha, turnstileToken } = parsed.data;
    const accountRateLimit = await applyRateLimit(
      request,
      `login-account:${email}`,
      RATE_LIMITS.LOGIN_ACCOUNT.limit,
      RATE_LIMITS.LOGIN_ACCOUNT.windowMs
    );
    if (accountRateLimit) return accountRateLimit;

    const bot = await verifyBotToken({ token: turnstileToken, remoteIp: clientIp, expectedAction: 'login' });
    if (!bot.success) {
      await recordSecurityEvent({ tipo: 'BOT_REJEITADO', request, email, ip: clientIp });
      return NextResponse.json({ erro: 'Não foi possível validar a verificação de segurança.' }, { status: 403 });
    }

    // 3. Busca o usuário pelo e-mail
    const usuario = await prisma.usuario.findUnique({
      where: { email },
      include: {
        empresa: {
          select: {
            id: true,
            nome: true,
            status: true,
            plano: true,
            modulos: true,
          },
        },
      },
    });

    // 4. Mensagem genérica para segurança (impede enum de emails)
    // Executa bcrypt também para e-mails ausentes, evitando enumeração por tempo.
    const senhaValida = await verifyLoginPassword(senha, usuario?.senha_hash);

    if (!usuario || !senhaValida) {
      await recordSecurityEvent({
        tipo: 'LOGIN_FALHA', request, usuarioId: usuario?.id,
        empresaId: usuario?.empresaId, email, ip: clientIp,
      });
      return NextResponse.json(
        { erro: 'Credenciais de acesso inválidas.' },
        { status: 401 }
      );
    }

    if (usuario.empresaId && usuario.empresa?.status !== 'ATIVO') {
      return NextResponse.json(
        { erro: 'O acesso desta empresa está temporariamente suspenso.' },
        { status: 403 }
      );
    }

    let sessionVersion = usuario.sessaoVersao;
    if (usuario.exigeTrocaSenha) {
      const agora = new Date();
      if (!usuario.senhaTemporariaExpiraEm || usuario.senhaTemporariaExpiraEm <= agora) {
        return NextResponse.json(
          { erro: 'A senha temporária expirou. Solicite uma redefinição de senha.' },
          { status: 403 },
        );
      }

      if (!novaSenha) {
        return NextResponse.json(
          {
            trocaSenhaObrigatoria: true,
            mensagem: 'Defina uma senha permanente para concluir o primeiro acesso.',
          },
          { status: 428 },
        );
      }

      if (novaSenha === senha) {
        return NextResponse.json(
          { erro: 'A nova senha deve ser diferente da senha temporária.' },
          { status: 400 },
        );
      }

      const novoHash = await hashPassword(novaSenha);
      const atualizado = await prisma.$transaction(async (tx) => {
        const troca = await tx.usuario.updateMany({
          where: {
            id: usuario.id,
            senha_hash: usuario.senha_hash,
            exigeTrocaSenha: true,
            senhaTemporariaExpiraEm: { gt: agora },
          },
          data: {
            senha_hash: novoHash,
            exigeTrocaSenha: false,
            senhaTemporariaExpiraEm: null,
            sessaoVersao: { increment: 1 },
          },
        });
        if (troca.count !== 1) return false;
        await tx.sessaoUsuario.updateMany({
          where: { usuarioId: usuario.id, revogadaEm: null },
          data: { revogadaEm: agora },
        });
        return true;
      });
      if (!atualizado) {
        return NextResponse.json(
          { erro: 'A credencial temporária já foi utilizada. Entre novamente.' },
          { status: 409 },
        );
      }
      sessionVersion += 1;
    } else if (passwordNeedsRehash(usuario.senha_hash)) {
      await prisma.usuario.update({
        where: { id: usuario.id },
        data: { senha_hash: await hashPassword(senha) },
      });
    }

    // 7. Cria sessão segura com JWT em HttpOnly Cookie
    const expiraEm = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const sessao = await prisma.sessaoUsuario.create({
      data: {
        usuarioId: usuario.id,
        empresaId: usuario.empresaId,
        ipHash: pseudonymize(clientIp),
        userAgent: safeUserAgent(request),
        expiraEm,
      },
      select: { id: true },
    });
    try {
      await createSession({
        sessionId: sessao.id,
        userId: usuario.id,
        email: usuario.email,
        role: (usuario.role as 'ADMIN_RPM' | 'GESTOR_EMPRESA' | 'OPERADOR' | 'VISUALIZADOR') || 'OPERADOR',
        empresaId: usuario.empresaId || undefined,
        sessionVersion,
      }, expiraEm);
    } catch (error) {
      await prisma.sessaoUsuario.delete({ where: { id: sessao.id } }).catch(() => undefined);
      throw error;
    }
    await recordSecurityEvent({
      tipo: 'LOGIN_SUCESSO', request, usuarioId: usuario.id,
      empresaId: usuario.empresaId, email, ip: clientIp,
    });
    await prisma.sessaoUsuario.deleteMany({
      where: {
        OR: [
          { expiraEm: { lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
          { revogadaEm: { lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
        ],
      },
    });

    // 8. Retorna dados do usuário (sem senha)
    return NextResponse.json(
      {
        sucesso: true,
        usuario: {
          id: usuario.id,
          nome: usuario.nome,
          email: usuario.email,
          role: usuario.role,
          empresa: usuario.empresa
            ? {
                id: usuario.empresa.id,
                nome: usuario.empresa.nome,
                plano: usuario.empresa.plano,
                modulos: normalizarModulos(usuario.empresa.modulos),
                permissoes: PLANOS_CONFIG[usuario.empresa.plano],
              }
            : null,
          empresaInfo: usuario.empresa
            ? {
                id: usuario.empresa.id,
                nome: usuario.empresa.nome,
                plano: usuario.empresa.plano,
                modulos: normalizarModulos(usuario.empresa.modulos),
                permissoes: PLANOS_CONFIG[usuario.empresa.plano],
              }
            : null,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Erro no login:', error);
    return NextResponse.json(
      { erro: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// src/app/api/auth/login/route.ts
import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcrypt';
import { createSession } from '@/lib/auth';
import { loginSchema } from '@/lib/validation';
import { applyRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rateLimit';

export async function POST(request: NextRequest) {
  try {
    // 1. Rate limiting: protege contra força bruta
    const clientIp = getClientIp(request);
    const rateLimitResult = applyRateLimit(
      request,
      `login:${clientIp}`,
      RATE_LIMITS.LOGIN.limit,
      RATE_LIMITS.LOGIN.windowMs
    );

    if (rateLimitResult) {
      return rateLimitResult;
    }

    // 2. Parsear e validar entrada com Zod
    const body = await request.json();
    const { email, senha } = loginSchema.parse(body);

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
    if (!usuario) {
      return NextResponse.json(
        { erro: 'Credenciais de acesso inválidas.' },
        { status: 401 }
      );
    }

    // 5. Valida se a empresa está ativa
    if (usuario.empresaId && usuario.empresa?.status !== 'ATIVO') {
      return NextResponse.json(
        { erro: 'O acesso desta empresa está temporariamente suspenso.' },
        { status: 403 }
      );
    }

    // 6. Valida a senha com bcrypt
    const senhaValida = await bcrypt.compare(senha, usuario.senha_hash);

    if (!senhaValida) {
      return NextResponse.json(
        { erro: 'Credenciais de acesso inválidas.' },
        { status: 401 }
      );
    }

    // 7. Cria sessão segura com JWT em HttpOnly Cookie
    await createSession({
      userId: usuario.id,
      email: usuario.email,
      role: (usuario.role as 'ADMIN_RPM' | 'GESTOR_EMPRESA' | 'OPERADOR' | 'VISUALIZADOR') || 'OPERADOR',
      empresaId: usuario.empresaId || undefined,
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
                modulos: usuario.empresa.modulos,
              }
            : null,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof Error && error.message.includes('ZodError')) {
      return NextResponse.json(
        { erro: 'Dados de entrada inválidos' },
        { status: 400 }
      );
    }

    console.error('Erro no login:', error);
    return NextResponse.json(
      { erro: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
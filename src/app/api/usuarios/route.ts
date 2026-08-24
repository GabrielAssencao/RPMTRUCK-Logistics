// src/app/api/usuarios/route.ts
import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/password';
import { requireEmpresaAuth } from '@/lib/empresaAuth';
import { criarUsuarioSchema, validateInput } from '@/lib/validation';
import { applyRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rateLimit';
import { Prisma } from '@prisma/client';
import { criarUsuarioEmpresaComLimite, LimiteUsuariosError } from '@/lib/usuariosEmpresa';

/**
 * GET /api/usuarios
 * Lista usuários da empresa (ou todos se for ADMIN)
 */
export async function GET(request: NextRequest) {
  try {
    // 1. Autenticação obrigatória
    const { session, error, status } = await requireEmpresaAuth(request);

    if (error) {
      return NextResponse.json({ erro: error }, { status });
    }
    if (session?.role !== 'GESTOR_EMPRESA' && session?.role !== 'GESTOR') {
      return NextResponse.json({ erro: 'Apenas o gestor pode consultar usuários.' }, { status: 403 });
    }

    // 2. Busca usuários filtrando por empresaId (IDOR protection)
    const usuarios = await prisma.usuario.findMany({
      where: {
        empresaId: session!.empresaId,
      },
      select: {
        id: true,
        nome: true,
        email: true,
        role: true,
        criado_em: true,
      },
    });

    return NextResponse.json({ usuarios }, { status: 200 });
  } catch (error) {
    console.error('Erro ao listar usuários:', error);
    return NextResponse.json({ erro: 'Erro interno' }, { status: 500 });
  }
}

/**
 * POST /api/usuarios
 * Cria novo usuário (apenas ADMIN ou GESTOR da empresa)
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Rate limiting: protege signup contra força bruta
    const clientIp = getClientIp(request);
    const rateLimitResult = await applyRateLimit(
      request,
      `signup:${clientIp}`,
      RATE_LIMITS.PUBLIC_SIGNUP.limit,
      RATE_LIMITS.PUBLIC_SIGNUP.windowMs
    );

    if (rateLimitResult) {
      return rateLimitResult;
    }

    // 2. Autenticação obrigatória (ADMIN pode criar em qualquer empresa, GESTOR só na sua)
    const { session, error, status } = await requireEmpresaAuth(request);

    if (error) {
      return NextResponse.json({ erro: error }, { status });
    }
    if (session?.role !== 'GESTOR_EMPRESA' && session?.role !== 'GESTOR') {
      return NextResponse.json({ erro: 'Apenas o gestor pode criar usuários.' }, { status: 403 });
    }

    // 3. Parsear e validar entrada com Zod
    const body = await request.json();
    const validated = validateInput(criarUsuarioSchema, body);

    if (!validated.success) {
      return NextResponse.json({ erro: validated.error }, { status: 400 });
    }

    const { nome, email, senha, cargo } = validated.data;

    // 4. IDOR Protection: GESTOR só pode criar usuários na sua empresa
    const empresaAlvo = session!.empresaId!;

    if (cargo === 'ADMIN_RPM' || cargo === 'GESTOR_EMPRESA') {
      return NextResponse.json({ erro: 'Perfil não permitido para criação delegada.' }, { status: 403 });
    }

    // 5. Verifica se e-mail já existe
    const usuarioExistente = await prisma.usuario.findUnique({
      where: { email },
    });

    if (usuarioExistente) {
      return NextResponse.json({ erro: 'Email já registrado' }, { status: 400 });
    }

    // 6. Hash da senha com bcrypt
    const senhaCriptografada = await hashPassword(senha);

    // 7. Cria o usuário
    const novoUsuario = await criarUsuarioEmpresaComLimite({
      empresaId: empresaAlvo,
      nome,
      email,
      senhaHash: senhaCriptografada,
      role: cargo ?? 'OPERADOR',
      criadoPorId: session!.userId,
    });

    return NextResponse.json({ usuario: novoUsuario }, { status: 201 });
  } catch (error) {
    if (error instanceof LimiteUsuariosError) {
      return NextResponse.json({ erro: error.message }, { status: 409 });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') return NextResponse.json({ erro: 'Email já registrado' }, { status: 409 });
      if (error.code === 'P2034') return NextResponse.json({ erro: 'Cadastro concorrente detectado. Tente novamente.' }, { status: 409 });
    }
    console.error('Erro ao criar usuário:', error);
    return NextResponse.json({ erro: 'Erro interno' }, { status: 500 });
  }
}

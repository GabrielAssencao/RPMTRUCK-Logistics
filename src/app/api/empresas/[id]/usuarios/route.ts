// src/app/api/empresas/[id]/usuarios/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminAuth } from '@/lib/auth';
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { hashPassword } from '@/lib/password';
import { criarNotificacao } from '@/lib/notificacoes';
import { Prisma } from '@prisma/client';
import { criarUsuarioEmpresaComLimite, EmpresaNaoEncontradaError, LimiteUsuariosError } from '@/lib/usuariosEmpresa';

const criarSchema = z.object({ nome: z.string().trim().min(3).max(100), email: z.string().email().toLowerCase(), senha: z.string().min(8).max(128), role: z.enum(['GESTOR_EMPRESA', 'OPERADOR', 'VISUALIZADOR']) });

export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const auth = await requireAdminAuth(request);
  if (auth.error || !auth.session) return NextResponse.json({ erro: auth.error }, { status: auth.status });
  try {
    const { id } = params;

    // Busca todos os usuários vinculados a esta empresa
    const usuarios = await prisma.usuario.findMany({
      where: {
        empresaId: id
      },
      select: {
        id: true,
        nome: true,
        email: true,
        role: true,
        criado_em: true,
        atualizado_em: true
      },
      orderBy: {
        nome: 'asc'
      }
    });

    return NextResponse.json(usuarios, { status: 200 });
  } catch (error) {
    console.error('Erro ao buscar usuários da empresa:', error);
    return NextResponse.json(
      { erro: 'Erro interno ao buscar usuários.' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const auth = await requireAdminAuth(request);
  if (auth.error || !auth.session) return NextResponse.json({ erro: auth.error }, { status: auth.status });
  const parsed = criarSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ erro: 'Dados do usuário inválidos.' }, { status: 400 });
  try {
    const usuario = await criarUsuarioEmpresaComLimite({
      empresaId: params.id,
      nome: parsed.data.nome,
      email: parsed.data.email,
      senhaHash: await hashPassword(parsed.data.senha),
      role: parsed.data.role,
      criadoPorId: auth.session.userId,
    });
    await criarNotificacao({ titulo: 'Acesso criado pelo SuperAdmin', mensagem: `Seu perfil ${usuario.role.replace('_', ' ')} está disponível.`, modulo: 'USUARIOS', empresaId: params.id, usuarioId: usuario.id });
    return NextResponse.json(usuario, { status: 201 });
  } catch (cause) {
    if (cause instanceof EmpresaNaoEncontradaError) return NextResponse.json({ erro: cause.message }, { status: 404 });
    if (cause instanceof LimiteUsuariosError) return NextResponse.json({ erro: cause.message }, { status: 409 });
    if (cause instanceof Prisma.PrismaClientKnownRequestError && cause.code === 'P2034') {
      return NextResponse.json({ erro: 'Cadastro concorrente detectado. Tente novamente.' }, { status: 409 });
    }
    return NextResponse.json({ erro: 'E-mail já cadastrado.' }, { status: 409 });
  }
}

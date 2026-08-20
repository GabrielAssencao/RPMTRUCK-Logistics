// src/app/api/empresas/[id]/usuarios/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminAuth } from '@/lib/auth';
import { NextRequest } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { PLANOS_CONFIG } from '@/utils/planos';
import { criarNotificacao } from '@/lib/notificacoes';

const criarSchema = z.object({ nome: z.string().trim().min(3).max(100), email: z.string().email().toLowerCase(), senha: z.string().min(8).max(128), role: z.enum(['GESTOR_EMPRESA', 'OPERADOR', 'VISUALIZADOR']) });

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdminAuth(request);
  if (auth.error || !auth.session) return NextResponse.json({ erro: auth.error }, { status: auth.status });
  const parsed = criarSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ erro: 'Dados do usuário inválidos.' }, { status: 400 });
  const empresa = await prisma.empresa.findUnique({ where: { id: params.id }, include: { _count: { select: { usuarios: true } } } });
  if (!empresa) return NextResponse.json({ erro: 'Empresa não encontrada.' }, { status: 404 });
  const limite = PLANOS_CONFIG[empresa.plano].usuariosBase + empresa.usuarios_adicionais;
  if (empresa._count.usuarios >= limite) return NextResponse.json({ erro: `Limite de ${limite} usuários atingido.` }, { status: 400 });
  try {
    const usuario = await prisma.usuario.create({ data: { nome: parsed.data.nome, email: parsed.data.email, senha_hash: await bcrypt.hash(parsed.data.senha, 10), role: parsed.data.role, empresaId: empresa.id }, select: { id: true, nome: true, email: true, role: true, criado_em: true } });
    await criarNotificacao({ titulo: 'Acesso criado pelo SuperAdmin', mensagem: `Seu perfil ${usuario.role.replace('_', ' ')} está disponível.`, modulo: 'USUARIOS', empresaId: empresa.id, usuarioId: usuario.id });
    return NextResponse.json(usuario, { status: 201 });
  } catch { return NextResponse.json({ erro: 'E-mail já cadastrado.' }, { status: 409 }); }
}

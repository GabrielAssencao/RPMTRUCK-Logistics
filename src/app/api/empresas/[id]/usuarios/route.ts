// src/app/api/empresas/[id]/usuarios/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminAuth } from '@/lib/auth';
import { NextRequest } from 'next/server';

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

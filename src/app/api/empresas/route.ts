// src/app/api/empresas/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { PlanoTipo, StatusEmpresa } from '@prisma/client';
import { requireAdminAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// ─── LISTAR TODAS AS EMPRESAS (GET) ───
export async function GET(request: NextRequest) {
  const auth = await requireAdminAuth(request);
  if (auth.error || !auth.session) return NextResponse.json({ erro: auth.error }, { status: auth.status });
  try {
    const empresas = await prisma.empresa.findMany({
      include: {
        _count: {
          select: {
            usuarios: true,
            veiculos_frota: true
          }
        }
      },
      orderBy: { criado_em: 'desc' }
    });

    return NextResponse.json(empresas, { status: 200 });
  } catch (error) {
    console.error('Erro ao listar empresas no Admin:', error);
    return NextResponse.json({ erro: 'Falha ao buscar empresas cadastradas.' }, { status: 500 });
  }
}

// ─── ATUALIZAR PLANO / PARÂMETROS DA EMPRESA (PUT) ───
export async function PUT(request: NextRequest) {
  const auth = await requireAdminAuth(request);
  if (auth.error || !auth.session) return NextResponse.json({ erro: auth.error }, { status: auth.status });
  try {
    const body = await request.json();
    const { id, nome, status, plano, usuarios_adicionais, veiculos_adicionais, modulos } = body;

    if (!id) {
      return NextResponse.json({ erro: 'ID da empresa não informado para atualização.' }, { status: 400 });
    }

    // Atualiza os parâmetros financeiros e de cota do cliente no banco
    const empresaAtualizada = await prisma.empresa.update({
      where: { id },
      data: {
        nome,
        status: status as StatusEmpresa,
        plano: plano as PlanoTipo,
        usuarios_adicionais: parseInt(usuarios_adicionais) || 0,
        veiculos_adicionais: parseInt(veiculos_adicionais) || 0,
        modulos: Array.isArray(modulos) ? modulos : undefined
      }
    });

    return NextResponse.json({ sucesso: true, empresa: empresaAtualizada }, { status: 200 });
  } catch (error) {
    console.error('Erro ao atualizar dados da empresa:', error);
    return NextResponse.json({ erro: 'Erro interno ao salvar modificações da empresa.' }, { status: 500 });
  }
}

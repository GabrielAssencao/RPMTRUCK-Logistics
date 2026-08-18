// src/app/api/auth/reset-request/route.ts
import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json({ erro: 'O e-mail é obrigatório para abrir o chamado de recuperação.' }, { status: 400 });
    }

    // Verifica se o usuário de fato existe no ecossistema RPMTruck
    const usuarioExistente = await prisma.usuario.findUnique({
      where: { email: email.toLowerCase().trim() }
    });

    if (!usuarioExistente) {
      // Por motivos de segurança contra raspagem de dados, não confirmamos se o e-mail é válido ou não
      return NextResponse.json({ sucesso: true, mensagem: 'Se o e-mail constar em nossa base, a solicitação foi encaminhada para a triagem.' }, { status: 200 });
    }

    // Cria o registro de reset pendente que aparecerá no painel administrativo
    await prisma.resetSenha.create({
      data: {
        email: email.toLowerCase().trim(),
        status: 'PENDENTE'
      }
    });

    return NextResponse.json({ 
      sucesso: true, 
      mensagem: 'Solicitação de segurança aberta com sucesso na fila do Admin.' 
    }, { status: 201 });

  } catch (error) {
    console.error('Erro na rota reset-request:', error);
    return NextResponse.json({ erro: 'Falha interna ao processar requisição de segurança.' }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}
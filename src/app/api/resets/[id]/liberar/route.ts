// src/app/api/resets/[id]/liberar/route.ts
import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import { requireAdminAuth } from '@/lib/auth';
import { NextRequest } from 'next/server';

const prisma = new PrismaClient();

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireAdminAuth(request);
  if (auth.error || !auth.session) return NextResponse.json({ erro: auth.error }, { status: auth.status });
  const { id } = params;

  try {
    // 1. Localiza a requisição de reset de senha
    const chamadoReset = await prisma.resetSenha.findUnique({
      where: { id }
    });

    if (!chamadoReset) {
      return NextResponse.json({ erro: 'Chamado de segurança não localizado.' }, { status: 404 });
    }

    if (chamadoReset.status !== 'PENDENTE') {
      return NextResponse.json({ erro: 'Este reset de credenciais já foi processado ou revogado.' }, { status: 400 });
    }

    // 2. Gera a String do Token Temporário para Cópia (Igual ao formato do Front)
    const chaveTemporaria = `RPM-${Math.floor(100000 + Math.random() * 900000)}`;
    
    // Criptografa a nova senha provisória para salvar no cadastro do usuário
    const salt = await bcrypt.genSalt(10);
    const novaSenhaHash = await bcrypt.hash(chaveTemporaria, salt);

    // 3. Executa a TRANSACTION de atualização de segurança
    await prisma.$transaction([
      // Atualiza o log do reset para concluído e anexa a chave para auditoria do Admin
      prisma.resetSenha.update({
        where: { id },
        data: {
          status: 'CONCLUIDO',
          chave: chaveTemporaria
        }
      }),
      // Força a alteração da senha real do usuário alvo na tabela de credenciais
      prisma.usuario.update({
        where: { email: chamadoReset.email },
        data: { senha_hash: novaSenhaHash }
      })
    ]);

    // O retorno entrega a chave limpa para o Admin copiar com o botão "LIBERAR RESET"
    return NextResponse.json({
      sucesso: true,
      chave: chaveTemporaria,
      mensagem: 'Nova senha aplicada e injetada no cadastro do usuário.'
    }, { status: 200 });

  } catch (error) {
    console.error('Erro ao processar liberação de reset:', error);
    return NextResponse.json({ erro: 'Erro interno ao reconfigurar chaves no banco.' }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

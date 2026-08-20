// src/app/api/resets/[id]/liberar/route.ts
import { NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { requireAdminAuth } from '@/lib/auth';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

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
    const chaveTemporaria = `RPM-${randomBytes(6).toString('base64url')}`;
    
    // Criptografa a nova senha provisória para salvar no cadastro do usuário
    const salt = await bcrypt.genSalt(10);
    const novaSenhaHash = await bcrypt.hash(chaveTemporaria, salt);

    // 3. Executa a TRANSACTION de atualização de segurança
    await prisma.$transaction(async (tx) => {
      const usuario = await tx.usuario.findUnique({
        where: { email: chamadoReset.email },
        select: { id: true, empresaId: true },
      });
      if (!usuario) throw new Error('Usuário do reset não encontrado.');
      // Atualiza o log do reset para concluído e anexa a chave para auditoria do Admin
      await tx.resetSenha.update({
        where: { id },
        data: {
          status: 'CONCLUIDO',
          chave: chaveTemporaria
        }
      });
      // Força a alteração da senha real do usuário alvo na tabela de credenciais
      await tx.usuario.update({
        where: { email: chamadoReset.email },
        data: { senha_hash: novaSenhaHash }
      });
      await tx.notificacao.create({
        data: {
          titulo: 'Senha temporária liberada',
          mensagem: 'O SuperAdmin concluiu sua solicitação de redefinição de senha.',
          modulo: 'GERAL',
          empresaId: usuario.empresaId,
          usuarioId: usuario.id,
        },
      });
    });

    // O retorno entrega a chave limpa para o Admin copiar com o botão "LIBERAR RESET"
    return NextResponse.json({
      sucesso: true,
      chave: chaveTemporaria,
      mensagem: 'Nova senha aplicada e injetada no cadastro do usuário.'
    }, { status: 200 });

  } catch (error) {
    console.error('Erro ao processar liberação de reset:', error);
    return NextResponse.json({ erro: 'Erro interno ao reconfigurar chaves no banco.' }, { status: 500 });
  }
}

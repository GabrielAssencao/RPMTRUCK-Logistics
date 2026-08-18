import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminAuth } from '@/lib/auth';

// PATCH: Atualiza status (ex: ativo/inativo)
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdminAuth(req);
  if (auth.error || !auth.session) return NextResponse.json({ erro: auth.error }, { status: auth.status });
  try {
    const { id } = params;
    const { role } = await req.json();

    if (!['GESTOR_EMPRESA', 'OPERADOR', 'VISUALIZADOR'].includes(role)) {
      return NextResponse.json({ erro: 'Perfil de usuário inválido.' }, { status: 400 });
    }

    const usuarioAtualizado = await prisma.usuario.update({
      where: { id },
      data: { role }
    });

    return NextResponse.json(usuarioAtualizado, { status: 200 });
  } catch (error) {
    return NextResponse.json({ erro: 'Erro ao atualizar usuário.' }, { status: 500 });
  }
}

// DELETE: Remove usuário
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdminAuth(req);
  if (auth.error || !auth.session) return NextResponse.json({ erro: auth.error }, { status: auth.status });
  try {
    const { id } = params;
    await prisma.usuario.delete({ where: { id } });
    return NextResponse.json({ mensagem: 'Usuário removido.' }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ erro: 'Erro ao deletar usuário.' }, { status: 500 });
  }
}

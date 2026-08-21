import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdminAuth } from '@/lib/auth'
import { executarComAuditoria } from '@/lib/auditoria'

const schema = z.object({ nome: z.string().trim().min(3).max(100).optional(), email: z.string().email().toLowerCase().optional(), role: z.enum(['GESTOR_EMPRESA', 'OPERADOR', 'VISUALIZADOR']).optional() })

export async function PATCH(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const auth = await requireAdminAuth(request);if (auth.error || !auth.session) return NextResponse.json({ erro: auth.error }, { status: auth.status })
  const parsed = schema.safeParse(await request.json());if (!parsed.success) return NextResponse.json({ erro: 'Dados do usuário inválidos.' }, { status: 400 })
  const revogarSessao = parsed.data.email !== undefined || parsed.data.role !== undefined
  try {
    return NextResponse.json(await executarComAuditoria({ usuarioId: auth.session.userId, origem: 'SUPERADMIN' }, (tx) => tx.usuario.update({
      where: { id: params.id },
      data: {
        ...parsed.data,
        ...(revogarSessao ? { sessaoVersao: { increment: 1 } } : {}),
      },
      select: { id: true, nome: true, email: true, role: true },
    })))
  } catch {
    return NextResponse.json({ erro: 'Usuário não encontrado ou e-mail já utilizado.' }, { status: 409 })
  }
}

export async function DELETE(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const auth = await requireAdminAuth(request);if (auth.error || !auth.session) return NextResponse.json({ erro: auth.error }, { status: auth.status })
  if (params.id === auth.session.userId) return NextResponse.json({ erro: 'Você não pode excluir a própria conta.' }, { status: 400 })
  try { await executarComAuditoria({ usuarioId: auth.session.userId, origem: 'SUPERADMIN' }, (tx) => tx.usuario.delete({ where: { id: params.id } })); return NextResponse.json({ sucesso: true }) } catch { return NextResponse.json({ erro: 'Usuário possui registros vinculados e não pode ser excluído.' }, { status: 409 }) }
}

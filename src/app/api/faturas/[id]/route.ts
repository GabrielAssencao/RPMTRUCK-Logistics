import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdminAuth } from '@/lib/auth'
import { executarComAuditoria } from '@/lib/auditoria'
const schema = z.object({ valor: z.coerce.number().min(0).optional(), status: z.enum(['PENDENTE', 'PAGO']).optional(), comprovanteUrl: z.string().url().nullable().optional() })
export async function PATCH(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const auth = await requireAdminAuth(request);if (auth.error || !auth.session) return NextResponse.json({ erro: auth.error }, { status: auth.status });const parsed = schema.safeParse(await request.json());if (!parsed.success) return NextResponse.json({ erro: 'Alteração inválida.' }, { status: 400 });return NextResponse.json(await executarComAuditoria({ usuarioId: auth.session.userId, origem: 'SUPERADMIN' }, (tx) => tx.fatura.update({ where: { id: params.id }, data: parsed.data })))
}

import { NextRequest, NextResponse } from 'next/server'
import { requireEmpresaAuth } from '@/lib/empresaAuth'
import { z } from 'zod'
import { nomeOperacional } from '@/lib/domainValidation'
import { executarComAuditoria } from '@/lib/auditoria'
import { encryptionConfigured, exposeEmpresa, protectEmpresa } from '@/lib/fieldEncryption'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = await requireEmpresaAuth(request)
  if (auth.error || !auth.session || !auth.empresa) {
    return NextResponse.json({ erro: auth.error }, { status: auth.status })
  }

  const usuario = auth.usuario
  if (!usuario) {
    return NextResponse.json({ erro: 'Usuário não pertence mais a esta empresa.' }, { status: 403 })
  }

  return NextResponse.json(
    {
      usuario: {
        id: usuario.id,
        email: usuario.email,
        role: usuario.role,
        acessoDashboardGeral: usuario.acessoDashboardGeral,
        senhaAlteradaEm: usuario.senhaAlteradaEm,
      },
      empresa: auth.empresa,
    },
    { headers: { 'Cache-Control': 'private, no-store' } },
  )
}

const atualizarPerfilSchema = z.object({
  nome: nomeOperacional(2, 150),
  cnpj: z.string().trim().regex(/^\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}$/).nullable().optional(),
  email: z.string().trim().email().max(254).toLowerCase(),
  telefone: z.string().trim().regex(/^\+?[\d\s().-]{10,20}$/).nullable().optional(),
}).strict()

export async function PATCH(request: NextRequest) {
  const auth = await requireEmpresaAuth(request)
  if (auth.error || !auth.session?.empresaId) return NextResponse.json({ erro: auth.error }, { status: auth.status })
  if (!['GESTOR_EMPRESA', 'GESTOR'].includes(auth.session.role)) return NextResponse.json({ erro: 'Apenas o gestor pode alterar o perfil da empresa.' }, { status: 403 })
  const parsed = atualizarPerfilSchema.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ erro: 'Dados da empresa inválidos.' }, { status: 400 })
  try {
    const empresaId = auth.session.empresaId
    if (parsed.data.cnpj && encryptionConfigured()) {
      const empresas = await prisma.empresa.findMany({
        where: { id: { not: empresaId } },
        select: { id: true, cnpj: true, telefone: true },
      })
      const cnpjNovo = parsed.data.cnpj.replace(/\D/g, '')
      if (empresas.some((item) => exposeEmpresa(item).cnpj?.replace(/\D/g, '') === cnpjNovo)) {
        return NextResponse.json({ erro: 'CNPJ já utilizado por outra empresa.' }, { status: 409 })
      }
    }
    const empresa = await executarComAuditoria({ usuarioId: auth.session.userId }, (tx) => tx.empresa.update({
      where: { id: empresaId },
      data: protectEmpresa(parsed.data, empresaId),
    }))
    return NextResponse.json({ empresa: exposeEmpresa(empresa) })
  } catch {
    return NextResponse.json({ erro: 'CNPJ ou e-mail já utilizado por outra empresa.' }, { status: 409 })
  }
}

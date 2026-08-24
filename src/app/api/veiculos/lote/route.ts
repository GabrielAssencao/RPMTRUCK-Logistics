import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { executarComAuditoria } from '@/lib/auditoria'
import { requireEmpresaAuth } from '@/lib/empresaAuth'
import { prisma } from '@/lib/prisma'
import { applyRateLimit, RATE_LIMITS } from '@/lib/rateLimit'

const idsSchema = z.array(z.string().uuid()).min(1).max(100)
const atualizarLoteSchema = z.object({
  ids: idsSchema,
  status: z.enum(['OPERACIONAL', 'OFICINA', 'INATIVO']),
}).strict()
const excluirLoteSchema = z.object({ ids: idsSchema }).strict()

export async function PATCH(request: NextRequest) {
  const auth = await requireEmpresaAuth(request, { modulo: 'FROTA', acao: 'ESCRITA' })
  if (auth.error || !auth.session?.empresaId) {
    return NextResponse.json({ erro: auth.error }, { status: auth.status })
  }
  const limited = await applyRateLimit(request, `bulk:${auth.session.userId}`, RATE_LIMITS.BULK_MUTATION.limit, RATE_LIMITS.BULK_MUTATION.windowMs)
  if (limited) return limited

  const parsed = atualizarLoteSchema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json({ erro: 'Seleção ou status inválido para atualização em lote.' }, { status: 400 })
  }

  const ids = [...new Set(parsed.data.ids)]
  const empresaId = auth.session.empresaId
  const veiculos = await prisma.veiculo.findMany({
    where: { id: { in: ids }, empresaId },
    select: { id: true, modelo: true, placa: true, status: true },
  })
  if (veiculos.length !== ids.length) {
    return NextResponse.json({ erro: 'A seleção contém veículos inexistentes ou de outra empresa.' }, { status: 404 })
  }

  const alterados = veiculos.filter(veiculo => veiculo.status !== parsed.data.status)
  if (alterados.length > 0) {
    await executarComAuditoria({ usuarioId: auth.session.userId }, tx => tx.veiculo.updateMany({
      where: { id: { in: alterados.map(veiculo => veiculo.id) }, empresaId },
      data: { status: parsed.data.status },
    }))

    await prisma.notificacao.createMany({
      data: alterados.map(veiculo => ({
        titulo: 'Status da frota alterado',
        mensagem: `${veiculo.modelo} (${veiculo.placa}): ${parsed.data.status}.`,
        modulo: 'FROTA',
        empresaId,
        usuarioId: auth.session!.userId,
        veiculoId: veiculo.id,
      })),
    })
  }

  return NextResponse.json({ atualizados: alterados.map(veiculo => veiculo.id) })
}

export async function DELETE(request: NextRequest) {
  const auth = await requireEmpresaAuth(request, { modulo: 'FROTA', acao: 'ESCRITA' })
  if (auth.error || !auth.session?.empresaId) {
    return NextResponse.json({ erro: auth.error }, { status: auth.status })
  }
  if (!['GESTOR_EMPRESA', 'GESTOR'].includes(auth.session.role)) {
    return NextResponse.json({ erro: 'Apenas o gestor pode remover veículos.' }, { status: 403 })
  }
  const limited = await applyRateLimit(request, `bulk:${auth.session.userId}`, RATE_LIMITS.BULK_MUTATION.limit, RATE_LIMITS.BULK_MUTATION.windowMs)
  if (limited) return limited

  const parsed = excluirLoteSchema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json({ erro: 'Seleção inválida para exclusão em lote.' }, { status: 400 })
  }

  const ids = [...new Set(parsed.data.ids)]
  const veiculos = await prisma.veiculo.findMany({
    where: { id: { in: ids }, empresaId: auth.session.empresaId },
    select: { id: true },
  })
  const encontrados = new Set(veiculos.map(veiculo => veiculo.id))
  const removidos: string[] = []
  const falhas = ids.filter(id => !encontrados.has(id))

  for (const veiculo of veiculos) {
    try {
      await executarComAuditoria(
        { usuarioId: auth.session.userId },
        tx => tx.veiculo.delete({ where: { id: veiculo.id } }),
      )
      removidos.push(veiculo.id)
    } catch {
      falhas.push(veiculo.id)
    }
  }

  return NextResponse.json({ removidos, falhas })
}

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireEmpresaAuth } from '@/lib/empresaAuth'
import { removerFotoMotorista } from '@/lib/motoristaFotos'
import { prisma } from '@/lib/prisma'

const schema = z.object({
  veiculoId: z.string().uuid().nullable().optional(),
  status: z.enum(['DISPONIVEL', 'EM_ROTA', 'ALERTA', 'FERIAS']).optional(),
}).strict()

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireEmpresaAuth(request, { modulo: 'FROTA' })
  if (auth.error || !auth.session?.empresaId) {
    return NextResponse.json({ erro: auth.error }, { status: auth.status })
  }
  const motorista = await prisma.motorista.findFirst({
    where: { id: params.id, empresaId: auth.session.empresaId },
  })
  if (!motorista) return NextResponse.json({ erro: 'Motorista não encontrado.' }, { status: 404 })

  const parsed = schema.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ erro: 'Alteração inválida.' }, { status: 400 })
  if (parsed.data.veiculoId) {
    const veiculo = await prisma.veiculo.findFirst({
      where: { id: parsed.data.veiculoId, empresaId: auth.session.empresaId },
      select: { id: true },
    })
    if (!veiculo) return NextResponse.json({ erro: 'Veículo inválido.' }, { status: 400 })
  }
  if (parsed.data.veiculoId) {
    await prisma.motorista.updateMany({
      where: {
        empresaId: auth.session.empresaId,
        veiculoId: parsed.data.veiculoId,
        id: { not: motorista.id },
      },
      data: { veiculoId: null },
    })
  }

  return NextResponse.json(await prisma.motorista.update({
    where: { id: motorista.id },
    data: parsed.data,
    include: { veiculo: true },
  }))
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireEmpresaAuth(request, { modulo: 'FROTA' })
  if (auth.error || !auth.session?.empresaId) {
    return NextResponse.json({ erro: auth.error }, { status: auth.status })
  }
  if (!['GESTOR_EMPRESA', 'GESTOR'].includes(auth.session.role)) {
    return NextResponse.json({ erro: 'Apenas o gestor pode excluir motoristas.' }, { status: 403 })
  }

  const motorista = await prisma.motorista.findFirst({
    where: { id: params.id, empresaId: auth.session.empresaId },
    select: { id: true, foto_url: true },
  })
  if (!motorista) return NextResponse.json({ erro: 'Motorista não encontrado.' }, { status: 404 })

  await prisma.motorista.delete({ where: { id: motorista.id } })
  await removerFotoMotorista(motorista.foto_url).catch((error) => {
    console.error('Falha ao remover foto órfã de motorista:', error)
  })
  return NextResponse.json({ sucesso: true })
}

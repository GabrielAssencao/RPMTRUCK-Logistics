import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireEmpresaAuth } from '@/lib/empresaAuth'
import { criarNotificacao } from '@/lib/notificacoes'
import { prisma } from '@/lib/prisma'
import { nomeOperacional, placaSchema, quilometragemSchema } from '@/lib/domainValidation'
import { CadastroVeiculoError, criarVeiculoEmpresaComLimite } from '@/lib/veiculosEmpresa'

const veiculoSchema = z.object({
  modelo: nomeOperacional(2, 100),
  tipo: z.enum(['Cavalo Mecânico', 'Bitrem', 'Sider', 'Baú', 'Refrigerado']),
  placa: placaSchema,
  ano: z.coerce.number().int().min(1950).max(new Date().getFullYear() + 1).optional().nullable(),
  quilometragem: quilometragemSchema.default(0),
  status: z.enum(['OPERACIONAL', 'OFICINA', 'INATIVO']).default('OPERACIONAL'),
  localizacaoId: z.string().uuid().optional().nullable(),
}).strict()

export async function GET(request: NextRequest) {
  const auth = await requireEmpresaAuth(request, { modulo: 'FROTA' })
  if (auth.error || !auth.session?.empresaId) return NextResponse.json({ erro: auth.error }, { status: auth.status })

  const veiculos = await prisma.veiculo.findMany({
    where: { empresaId: auth.session.empresaId },
    include: { localizacao: { select: { id: true, nome: true, cidadeUF: true } }, motoristas: { select: { id: true, nome: true } } },
    orderBy: { criado_em: 'desc' },
  })
  return NextResponse.json(veiculos)
}

export async function POST(request: NextRequest) {
  const auth = await requireEmpresaAuth(request, { modulo: 'FROTA', acao: 'ESCRITA' })
  if (auth.error || !auth.session?.empresaId || !auth.empresa) return NextResponse.json({ erro: auth.error }, { status: auth.status })

  const parsed = veiculoSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ erro: parsed.error.issues[0]?.message ?? 'Dados do veículo inválidos.' }, { status: 400 })

  const empresaId = auth.session.empresaId

  try {
    const novoVeiculo = await criarVeiculoEmpresaComLimite({ usuarioId: auth.session.userId, empresaId, dados: parsed.data })
    await criarNotificacao({ titulo: 'Veículo cadastrado', mensagem: `${novoVeiculo.modelo} (${novoVeiculo.placa}) foi adicionado à frota.`, modulo: 'FROTA', empresaId, usuarioId: auth.session.userId, veiculoId: novoVeiculo.id })
    return NextResponse.json(novoVeiculo, { status: 201 })
  } catch (cause) {
    if (cause instanceof CadastroVeiculoError) return NextResponse.json({ erro: cause.message }, { status: cause.status })
    console.error('Erro ao criar veículo:', cause)
    return NextResponse.json({ erro: 'Não foi possível criar o veículo. Verifique se a placa já existe.' }, { status: 409 })
  }
}

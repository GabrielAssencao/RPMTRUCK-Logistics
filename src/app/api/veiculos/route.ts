import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireEmpresaAuth } from '@/lib/empresaAuth'
import { criarNotificacao } from '@/lib/notificacoes'
import { prisma } from '@/lib/prisma'
import { nomeOperacional, placaSchema, quilometragemSchema } from '@/lib/domainValidation'
import { executarComAuditoria } from '@/lib/auditoria'

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

  const parsed = veiculoSchema.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ erro: 'Dados do veículo inválidos.' }, { status: 400 })

  const empresaId = auth.session.empresaId
  const limiteVeiculos = auth.empresa.permissoes.veiculosBase + auth.empresa.veiculos_adicionais
  if (await prisma.veiculo.count({ where: { empresaId } }) >= limiteVeiculos) {
    return NextResponse.json({ erro: `Limite do plano atingido (${limiteVeiculos} veículos).` }, { status: 400 })
  }
  if (parsed.data.localizacaoId) {
    const localizacao = await prisma.localizacao.findFirst({ where: { id: parsed.data.localizacaoId, empresaId }, select: { id: true } })
    if (!localizacao) return NextResponse.json({ erro: 'Localização inválida.' }, { status: 400 })
  }

  try {
    const novoVeiculo = await executarComAuditoria({ usuarioId: auth.session.userId }, async (tx) => {
      const veiculo = await tx.veiculo.create({
        data: { ...parsed.data, empresaId },
        include: { localizacao: true, motoristas: { select: { id: true, nome: true } } },
      })
      await tx.leituraQuilometragem.create({
        data: { quilometragem: veiculo.quilometragem, origem: 'CADASTRO_VEICULO', veiculoId: veiculo.id, empresaId },
      })
      return veiculo
    })
    await criarNotificacao({ titulo: 'Veículo cadastrado', mensagem: `${novoVeiculo.modelo} (${novoVeiculo.placa}) foi adicionado à frota.`, modulo: 'FROTA', empresaId, usuarioId: auth.session.userId, veiculoId: novoVeiculo.id })
    return NextResponse.json(novoVeiculo, { status: 201 })
  } catch (cause) {
    console.error('Erro ao criar veículo:', cause)
    return NextResponse.json({ erro: 'Não foi possível criar o veículo. Verifique se a placa já existe.' }, { status: 409 })
  }
}

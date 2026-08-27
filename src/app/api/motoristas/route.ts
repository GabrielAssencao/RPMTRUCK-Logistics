import { Prisma } from '@prisma/client'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireEmpresaAuth } from '@/lib/empresaAuth'
import {
  criarUrlsAssinadasFotos,
  FotoMotoristaError,
  removerFotoMotorista,
  salvarFotoMotorista,
} from '@/lib/motoristaFotos'
import { criarNotificacao } from '@/lib/notificacoes'
import { prisma } from '@/lib/prisma'
import { dataIsoSchema, nomePessoa } from '@/lib/domainValidation'
import { executarComAuditoria } from '@/lib/auditoria'
import { encryptionConfigured, exposeMotorista, protectMotorista } from '@/lib/fieldEncryption'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const schema = z.object({
  nome: nomePessoa(3, 120),
  cpf: z.string().trim().regex(/^\d{11}$/, 'O CPF deve ter 11 números.').nullable(),
  rg: z.string().trim().regex(/^\d{9}$/, 'O RG deve ter 9 números.').nullable(),
  cnh: z.string().trim().regex(/^\d{11}$/, 'A CNH deve ter 11 números.'),
  categoria: z.enum(['A', 'B', 'C', 'D', 'E', 'AB', 'AC', 'AD', 'AE']),
  validade: dataIsoSchema,
  status: z.enum(['DISPONIVEL', 'EM_ROTA', 'ALERTA', 'FERIAS']).default('DISPONIVEL'),
  veiculoId: z.string().uuid().nullable(),
}).strict()

function valorTexto(formData: FormData, campo: string) {
  const valor = formData.get(campo)
  return typeof valor === 'string' ? valor : ''
}

function valorOpcional(formData: FormData, campo: string) {
  const valor = valorTexto(formData, campo).trim()
  return valor || null
}

function valorDocumentoNumericoOpcional(formData: FormData, campo: string) {
  const valor = valorTexto(formData, campo).trim()
  if (!valor) return null
  return /^[\d.-]+$/.test(valor) ? valor.replace(/\D/g, '') : valor
}

function podeGerenciarMotoristas(role: string) {
  return role === 'GESTOR_EMPRESA' || role === 'GESTOR' || role === 'OPERADOR'
}

export async function GET(request: NextRequest) {
  const auth = await requireEmpresaAuth(request, { modulo: 'FROTA' })
  if (auth.error || !auth.session?.empresaId) {
    return NextResponse.json({ erro: auth.error }, { status: auth.status })
  }

  const [motoristas, veiculos] = await prisma.$transaction([
    prisma.motorista.findMany({
      where: { empresaId: auth.session.empresaId },
      include: { veiculo: { select: { id: true, modelo: true, placa: true } } },
      orderBy: { nome: 'asc' },
    }),
    prisma.veiculo.findMany({
      where: { empresaId: auth.session.empresaId },
      include: { motoristas: { select: { id: true } } },
      orderBy: { modelo: 'asc' },
    }),
  ])

  const urls = await criarUrlsAssinadasFotos(motoristas.map((motorista) => motorista.foto_url))
  return NextResponse.json({
    motoristas: motoristas.map((motorista) => ({
      ...exposeMotorista(motorista),
      foto_url: motorista.foto_url?.startsWith('http')
        ? motorista.foto_url
        : urls.get(motorista.foto_url ?? '') ?? null,
    })),
    veiculos,
  })
}

export async function POST(request: NextRequest) {
  const auth = await requireEmpresaAuth(request, { modulo: 'FROTA', acao: 'ESCRITA' })
  if (auth.error || !auth.session?.empresaId) {
    return NextResponse.json({ erro: auth.error }, { status: auth.status })
  }
  if (!podeGerenciarMotoristas(auth.session.role)) {
    return NextResponse.json({ erro: 'Seu perfil não pode cadastrar motoristas.' }, { status: 403 })
  }

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ erro: 'Formulário inválido.' }, { status: 400 })
  }

  const parsed = schema.safeParse({
    nome: valorTexto(formData, 'nome'),
    cpf: valorDocumentoNumericoOpcional(formData, 'cpf'),
    rg: valorDocumentoNumericoOpcional(formData, 'rg'),
    cnh: valorTexto(formData, 'cnh'),
    categoria: valorTexto(formData, 'categoria'),
    validade: valorTexto(formData, 'validade'),
    status: valorTexto(formData, 'status') || 'DISPONIVEL',
    veiculoId: valorOpcional(formData, 'veiculoId'),
  })
  if (!parsed.success) {
    return NextResponse.json({ erro: 'Revise os dados cadastrais do motorista.' }, { status: 400 })
  }

  const validade = new Date(`${parsed.data.validade}T12:00:00`)
  if (Number.isNaN(validade.getTime())) {
    return NextResponse.json({ erro: 'Informe uma validade de CNH válida.' }, { status: 400 })
  }

  if (parsed.data.veiculoId) {
    const veiculo = await prisma.veiculo.findFirst({
      where: { id: parsed.data.veiculoId, empresaId: auth.session.empresaId },
      select: { id: true },
    })
    if (!veiculo) return NextResponse.json({ erro: 'Veículo inválido.' }, { status: 400 })
  }

  const fotoEntrada = formData.get('foto')
  const foto = fotoEntrada instanceof File && fotoEntrada.size > 0 ? fotoEntrada : null
  const empresaId = auth.session.empresaId
  const usuarioId = auth.session.userId
  let motorista: Awaited<ReturnType<typeof prisma.motorista.create>> | null = null
  let caminhoFoto: string | null = null

  try {
    if (encryptionConfigured()) {
      const existentes = await prisma.motorista.findMany({
        where: { empresaId },
        select: { empresaId: true, cpf: true, rg: true, cnh: true },
      })
      const cpfNovo = parsed.data.cpf?.replace(/\D/g, '') || null
      const cnhNova = parsed.data.cnh.replace(/\D/g, '')
      const duplicado = existentes.some((item) => {
        const exposto = exposeMotorista(item)
        return (cpfNovo && exposto.cpf?.replace(/\D/g, '') === cpfNovo)
          || exposto.cnh.replace(/\D/g, '') === cnhNova
      })
      if (duplicado) return NextResponse.json({ erro: 'CPF ou CNH já cadastrado para esta empresa.' }, { status: 409 })
    }

    motorista = await executarComAuditoria({ usuarioId }, (tx) => tx.motorista.create({
      data: {
        ...protectMotorista(parsed.data, empresaId),
        validade,
        foto_url: null,
        empresaId,
      },
    }))

    if (foto) {
      const motoristaId = motorista.id
      const upload = await salvarFotoMotorista(empresaId, motoristaId, foto)
      caminhoFoto = upload.caminho
      motorista = await executarComAuditoria({ usuarioId }, (tx) => tx.motorista.update({
        where: { id: motoristaId },
        data: { foto_url: caminhoFoto },
      }))
    }

    await criarNotificacao({
      titulo: 'Motorista cadastrado',
      mensagem: `${motorista.nome} foi adicionado à equipe.`,
      modulo: 'MOTORISTAS',
      empresaId,
      usuarioId,
    }).catch((error) => console.error('Falha ao notificar cadastro de motorista:', error))

    return NextResponse.json(exposeMotorista(motorista), { status: 201 })
  } catch (error) {
    if (caminhoFoto) {
      await removerFotoMotorista(caminhoFoto).catch((cause) => console.error('Falha ao compensar upload de foto:', cause))
    }
    if (motorista) {
      await executarComAuditoria({ usuarioId }, (tx) => tx.motorista.delete({ where: { id: motorista!.id } })).catch((cause) => console.error('Falha ao compensar cadastro de motorista:', cause))
    }
    if (error instanceof FotoMotoristaError) {
      return NextResponse.json({ erro: error.message }, { status: error.status })
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json({ erro: 'CPF ou CNH já cadastrado para esta empresa.' }, { status: 409 })
    }
    console.error('Erro ao cadastrar motorista:', error)
    return NextResponse.json({ erro: 'Não foi possível cadastrar o motorista.' }, { status: 500 })
  }
}

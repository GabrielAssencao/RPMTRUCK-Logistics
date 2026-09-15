import { Prisma } from '@prisma/client'
import { NextRequest, NextResponse } from 'next/server'
import { executarComAuditoria } from '@/lib/auditoria'
import { requireEmpresaAuth } from '@/lib/empresaAuth'
import { blindIndex, encryptSensitive, encryptionConfigured, exposeMotorista } from '@/lib/fieldEncryption'
import { removerFotoMotorista } from '@/lib/motoristaFotos'
import { atualizacaoMotoristaSchema } from '@/lib/motoristaValidation'
import { prisma } from '@/lib/prisma'
import { normalizarDocumentoIdentidade, normalizarRegistroCNH, somenteNumeros } from '@/utils/documentos'

export async function PATCH(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const auth = await requireEmpresaAuth(request, { modulo: 'FROTA', acao: 'GESTAO' })
  if (auth.error || !auth.session?.empresaId) {
    return NextResponse.json({ erro: auth.error }, { status: auth.status })
  }

  const motorista = await prisma.motorista.findFirst({ where: { id: params.id, empresaId: auth.session.empresaId } })
  if (!motorista) return NextResponse.json({ erro: 'Motorista não encontrado.' }, { status: 404 })

  let entrada: unknown
  try {
    entrada = await request.json()
  } catch {
    return NextResponse.json({ erro: 'Dados de alteração inválidos.' }, { status: 400 })
  }

  if (entrada && typeof entrada === 'object' && !Array.isArray(entrada)) {
    const dados = entrada as Record<string, unknown>
    if (typeof dados.cpf === 'string' && /^[\d.\-\s]+$/.test(dados.cpf)) dados.cpf = somenteNumeros(dados.cpf)
    if (typeof dados.rg === 'string') dados.rg = dados.rg.trim() ? normalizarDocumentoIdentidade(dados.rg) : null
    if (typeof dados.cnh === 'string' && /^[\d.\-\s]+$/.test(dados.cnh)) dados.cnh = normalizarRegistroCNH(dados.cnh)
  }

  const parsed = atualizacaoMotoristaSchema.safeParse(entrada)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    return NextResponse.json({
      erro: issue?.message ?? 'Revise os dados cadastrais do motorista.',
      campo: typeof issue?.path[0] === 'string' ? issue.path[0] : undefined,
    }, { status: 400 })
  }

  const empresaId = auth.session.empresaId
  const dados = parsed.data
  if (dados.veiculoId) {
    const veiculo = await prisma.veiculo.findFirst({ where: { id: dados.veiculoId, empresaId }, select: { id: true } })
    if (!veiculo) return NextResponse.json({ erro: 'Veículo inválido.' }, { status: 400 })
  }

  try {
    if (encryptionConfigured() && (dados.cpf !== undefined || dados.cnh !== undefined)) {
      const cpfHash = dados.cpf !== undefined ? blindIndex(dados.cpf, empresaId, 'motorista.cpf') : null
      const cnhHash = dados.cnh !== undefined ? blindIndex(dados.cnh, empresaId, 'motorista.cnh') : null
      const duplicado = await prisma.motorista.findFirst({
        where: {
          empresaId,
          id: { not: motorista.id },
          OR: [
            ...(cpfHash ? [{ cpfHash }] : []),
            ...(cnhHash ? [{ cnhHash }] : []),
          ],
        },
        select: { cpfHash: true, cnhHash: true },
      })
      if (duplicado?.cpfHash && duplicado.cpfHash === cpfHash) {
        return NextResponse.json({ erro: 'CPF já cadastrado para esta empresa.', campo: 'cpf' }, { status: 409 })
      }
      if (duplicado?.cnhHash && duplicado.cnhHash === cnhHash) {
        return NextResponse.json({ erro: 'CNH já cadastrada para esta empresa.', campo: 'cnh' }, { status: 409 })
      }
    }

    const persistencia: Prisma.MotoristaUpdateInput = {
      ...(dados.nome !== undefined ? { nome: dados.nome } : {}),
      ...(dados.categoria !== undefined ? { categoria: dados.categoria } : {}),
      ...(dados.status !== undefined ? { status: dados.status } : {}),
      ...(dados.validade !== undefined ? { validade: new Date(`${dados.validade}T12:00:00`) } : {}),
      ...(dados.cpf !== undefined ? {
        cpf: encryptSensitive(dados.cpf, empresaId, 'motorista.cpf'),
        cpfHash: blindIndex(dados.cpf, empresaId, 'motorista.cpf'),
      } : {}),
      ...(dados.rg !== undefined ? { rg: encryptSensitive(dados.rg, empresaId, 'motorista.rg') } : {}),
      ...(dados.cnh !== undefined ? {
        cnh: encryptSensitive(dados.cnh, empresaId, 'motorista.cnh'),
        cnhHash: blindIndex(dados.cnh, empresaId, 'motorista.cnh'),
      } : {}),
      ...(dados.veiculoId !== undefined ? {
        veiculo: dados.veiculoId ? { connect: { id: dados.veiculoId } } : { disconnect: true },
      } : {}),
    }

    const atualizado = await executarComAuditoria({ usuarioId: auth.session.userId }, async (tx) => {
      if (dados.veiculoId) {
        await tx.motorista.updateMany({
          where: { empresaId, veiculoId: dados.veiculoId, id: { not: motorista.id } },
          data: { veiculoId: null },
        })
      }
      return tx.motorista.update({ where: { id: motorista.id }, data: persistencia, include: { veiculo: true } })
    })

    return NextResponse.json(exposeMotorista(atualizado))
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const alvo = String(error.meta?.target ?? '').toLowerCase()
      const campo = alvo.includes('cpf') ? 'cpf' : alvo.includes('cnh') ? 'cnh' : undefined
      return NextResponse.json({
        erro: campo === 'cpf' ? 'CPF já cadastrado para esta empresa.' : campo === 'cnh' ? 'CNH já cadastrada para esta empresa.' : 'CPF ou CNH já cadastrado para esta empresa.',
        campo,
      }, { status: 409 })
    }
    console.error('Erro ao atualizar motorista:', error)
    return NextResponse.json({ erro: 'Não foi possível atualizar o motorista.' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const auth = await requireEmpresaAuth(request, { modulo: 'FROTA', acao: 'GESTAO' })
  if (auth.error || !auth.session?.empresaId) {
    return NextResponse.json({ erro: auth.error }, { status: auth.status })
  }
  const motorista = await prisma.motorista.findFirst({
    where: { id: params.id, empresaId: auth.session.empresaId },
    select: { id: true, foto_url: true },
  })
  if (!motorista) return NextResponse.json({ erro: 'Motorista não encontrado.' }, { status: 404 })

  await executarComAuditoria({ usuarioId: auth.session.userId }, (tx) => tx.motorista.delete({ where: { id: motorista.id } }))
  await removerFotoMotorista(motorista.foto_url).catch((error) => console.error('Falha ao remover foto órfã de motorista:', error))
  return NextResponse.json({ sucesso: true })
}

import { NextRequest, NextResponse } from 'next/server'
import { requireEmpresaAuth } from '@/lib/empresaAuth'
import {
  criarUrlsAssinadasFotos,
  FotoMotoristaError,
  removerFotoMotorista,
  salvarFotoMotorista,
} from '@/lib/motoristaFotos'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function podeGerenciarMotoristas(role: string) {
  return role === 'GESTOR_EMPRESA' || role === 'GESTOR' || role === 'OPERADOR'
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireEmpresaAuth(request, { modulo: 'FROTA' })
  if (auth.error || !auth.session?.empresaId) {
    return NextResponse.json({ erro: auth.error }, { status: auth.status })
  }
  if (!podeGerenciarMotoristas(auth.session.role)) {
    return NextResponse.json({ erro: 'Seu perfil não pode alterar fotos de motoristas.' }, { status: 403 })
  }

  const motorista = await prisma.motorista.findFirst({
    where: { id: params.id, empresaId: auth.session.empresaId },
    select: { id: true, foto_url: true },
  })
  if (!motorista) return NextResponse.json({ erro: 'Motorista não encontrado.' }, { status: 404 })

  try {
    const formData = await request.formData()
    const foto = formData.get('foto')
    if (!(foto instanceof File) || foto.size === 0) {
      return NextResponse.json({ erro: 'Selecione uma foto.' }, { status: 400 })
    }

    const upload = await salvarFotoMotorista(auth.session.empresaId, motorista.id, foto)
    await prisma.motorista.update({
      where: { id: motorista.id },
      data: { foto_url: upload.caminho },
    })
    if (motorista.foto_url && motorista.foto_url !== upload.caminho) {
      await removerFotoMotorista(motorista.foto_url).catch((error) => console.error('Falha ao remover foto anterior:', error))
    }

    const urls = await criarUrlsAssinadasFotos([upload.caminho])
    return NextResponse.json({
      fotoUrl: urls.get(upload.caminho) ?? null,
      largura: upload.largura,
      altura: upload.altura,
      tamanho: upload.tamanho,
    })
  } catch (error) {
    if (error instanceof FotoMotoristaError) {
      return NextResponse.json({ erro: error.message }, { status: error.status })
    }
    console.error('Erro ao atualizar foto do motorista:', error)
    return NextResponse.json({ erro: 'Não foi possível atualizar a foto.' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireEmpresaAuth(request, { modulo: 'FROTA' })
  if (auth.error || !auth.session?.empresaId) {
    return NextResponse.json({ erro: auth.error }, { status: auth.status })
  }
  if (!podeGerenciarMotoristas(auth.session.role)) {
    return NextResponse.json({ erro: 'Seu perfil não pode remover fotos de motoristas.' }, { status: 403 })
  }

  const motorista = await prisma.motorista.findFirst({
    where: { id: params.id, empresaId: auth.session.empresaId },
    select: { id: true, foto_url: true },
  })
  if (!motorista) return NextResponse.json({ erro: 'Motorista não encontrado.' }, { status: 404 })

  await prisma.motorista.update({ where: { id: motorista.id }, data: { foto_url: null } })
  await removerFotoMotorista(motorista.foto_url).catch((error) => {
    console.error('Foto removida do cadastro, mas permaneceu órfã no Storage:', error)
  })
  return NextResponse.json({ sucesso: true })
}


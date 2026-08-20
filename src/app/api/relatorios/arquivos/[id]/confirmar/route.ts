import { NextRequest, NextResponse } from 'next/server'
import { requireEmpresaAuth } from '@/lib/empresaAuth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

function gestorAutorizado(role: string) {
  return role === 'GESTOR_EMPRESA' || role === 'GESTOR'
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireEmpresaAuth(request)
  if (auth.error || !auth.session || !auth.empresaId) {
    return NextResponse.json({ erro: auth.error }, { status: auth.status })
  }
  if (!gestorAutorizado(auth.session.role)) {
    return NextResponse.json({ erro: 'Apenas o gestor pode confirmar a guarda do arquivo.' }, { status: 403 })
  }

  const arquivo = await prisma.relatorioArquivo.findFirst({
    where: { id: params.id, empresaId: auth.empresaId },
    select: { id: true, status: true, baixado_em: true },
  })
  if (!arquivo) return NextResponse.json({ erro: 'Relatório não encontrado.' }, { status: 404 })
  if (!arquivo.baixado_em || arquivo.status === 'PRONTO_DOWNLOAD') {
    return NextResponse.json({ erro: 'Faça o download antes de confirmar a guarda do arquivo.' }, { status: 409 })
  }
  if (arquivo.status === 'ARQUIVO_REMOVIDO' || arquivo.status === 'DADOS_PURGADOS') {
    return NextResponse.json({ erro: 'Este processo de arquivamento já foi concluído.' }, { status: 409 })
  }

  const confirmado = await prisma.relatorioArquivo.update({
    where: { id: arquivo.id },
    data: {
      status: 'CONFIRMADO_GESTOR',
      confirmado_em: new Date(),
      confirmadoPorId: auth.session.userId,
    },
  })
  return NextResponse.json(confirmado)
}

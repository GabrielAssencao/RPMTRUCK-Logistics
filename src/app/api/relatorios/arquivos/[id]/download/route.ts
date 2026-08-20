import { NextRequest, NextResponse } from 'next/server'
import { requireEmpresaAuth } from '@/lib/empresaAuth'
import { prisma } from '@/lib/prisma'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireEmpresaAuth(request)
  if (auth.error || !auth.session || !auth.empresaId) {
    return NextResponse.json({ erro: auth.error }, { status: auth.status })
  }

  const arquivo = await prisma.relatorioArquivo.findFirst({
    where: { id: params.id, empresaId: auth.empresaId },
    select: { id: true, caminho_storage: true, bucket: true, status: true, arquivo_removido_em: true },
  })
  if (!arquivo) {
    return NextResponse.json({ erro: 'Relatório não encontrado.' }, { status: 404 })
  }
  if (arquivo.arquivo_removido_em || arquivo.status === 'ARQUIVO_REMOVIDO') {
    return NextResponse.json({ erro: 'O arquivo temporário já foi removido após a confirmação do gestor.' }, { status: 410 })
  }

  try {
    const { data, error } = await getSupabaseAdmin()
      .storage
      .from(arquivo.bucket)
      .createSignedUrl(arquivo.caminho_storage, 60)

    if (error || !data?.signedUrl) {
      console.error('Erro ao assinar download do relatório:', error?.message)
      return NextResponse.json({ erro: 'Não foi possível liberar o download.' }, { status: 502 })
    }

    await prisma.relatorioArquivo.update({
      where: { id: arquivo.id },
      data: {
        status: arquivo.status === 'PRONTO_DOWNLOAD' ? 'DOWNLOAD_REGISTRADO' : undefined,
        baixado_em: new Date(),
        baixadoPorId: auth.session.userId,
      },
    })

    return NextResponse.json(
      { url: data.signedUrl, expira_em_segundos: 60 },
      { headers: { 'Cache-Control': 'private, no-store' } },
    )
  } catch (error) {
    console.error('Erro ao acessar Storage:', error)
    return NextResponse.json({ erro: 'Storage privado não configurado no servidor.' }, { status: 500 })
  }
}

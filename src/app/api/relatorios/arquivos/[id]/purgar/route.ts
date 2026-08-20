import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireEmpresaAuth } from '@/lib/empresaAuth'
import { notificarUsuariosDaEmpresa } from '@/lib/notificacoes'
import { prisma } from '@/lib/prisma'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const schema = z.object({ confirmacao: z.literal('EXCLUIR DADOS ARQUIVADOS') })

function gestorAutorizado(role: string) {
  return role === 'GESTOR_EMPRESA' || role === 'GESTOR'
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireEmpresaAuth(request)
  if (auth.error || !auth.session || !auth.empresaId || !auth.empresa) {
    return NextResponse.json({ erro: auth.error }, { status: auth.status })
  }
  if (!gestorAutorizado(auth.session.role)) {
    return NextResponse.json({ erro: 'Apenas o gestor pode concluir a limpeza dos dados.' }, { status: 403 })
  }

  const parsed = schema.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ erro: 'Confirmação de segurança inválida.' }, { status: 400 })

  const arquivo = await prisma.relatorioArquivo.findFirst({
    where: { id: params.id, empresaId: auth.empresaId },
  })
  if (!arquivo) return NextResponse.json({ erro: 'Relatório não encontrado.' }, { status: 404 })
  if (!arquivo.gerado_automaticamente) {
    return NextResponse.json({ erro: 'Arquivos enviados manualmente não autorizam exclusão de dados.' }, { status: 409 })
  }
  if (!arquivo.confirmado_em || !['CONFIRMADO_GESTOR', 'DADOS_PURGADOS'].includes(arquivo.status)) {
    return NextResponse.json({ erro: 'O gestor ainda não confirmou a guarda do arquivo baixado.' }, { status: 409 })
  }

  const elegivelEm = new Date(arquivo.periodo_fim)
  elegivelEm.setUTCFullYear(elegivelEm.getUTCFullYear() + auth.empresa.permissoes.historicoAnos)
  if (elegivelEm > new Date()) {
    return NextResponse.json({
      erro: `O histórico online deste período deve ser mantido até ${elegivelEm.toLocaleDateString('pt-BR', { timeZone: 'UTC' })}.`,
      elegivel_em: elegivelEm,
    }, { status: 409 })
  }

  let removidos = { containers: 0, custos: 0, manutencoes: 0 }
  if (arquivo.status === 'CONFIRMADO_GESTOR') {
    removidos = await prisma.$transaction(async (tx) => {
      const [containers, custos, manutencoes] = await Promise.all([
        tx.container.deleteMany({ where: { empresaId: auth.empresaId!, relatorioArquivoId: arquivo.id } }),
        tx.custo.deleteMany({ where: { empresaId: auth.empresaId!, relatorioArquivoId: arquivo.id } }),
        tx.historicoVeiculo.deleteMany({ where: { empresaId: auth.empresaId!, relatorioArquivoId: arquivo.id } }),
      ])
      const agora = new Date()
      await tx.movimentacaoContainerPermanente.updateMany({
        where: { empresaId: auth.empresaId!, relatorioArquivoId: arquivo.id },
        data: { detalhes_purgados_em: agora },
      })
      await tx.relatorioArquivo.update({
        where: { id: arquivo.id },
        data: { status: 'DADOS_PURGADOS', dados_purgados_em: agora },
      })
      return {
        containers: containers.count,
        custos: custos.count,
        manutencoes: manutencoes.count,
      }
    })
  }

  const remocao = await getSupabaseAdmin().storage.from(arquivo.bucket).remove([arquivo.caminho_storage])
  if (remocao.error) {
    console.error('Dados purgados, mas arquivo temporário não foi removido:', remocao.error.message)
    return NextResponse.json({
      sucesso: true,
      removidos,
      aviso: 'Os dados foram limpos, mas o arquivo ainda precisa ser removido do Storage.',
    }, { status: 202 })
  }

  await prisma.relatorioArquivo.update({
    where: { id: arquivo.id },
    data: { status: 'ARQUIVO_REMOVIDO', arquivo_removido_em: new Date() },
  })
  await notificarUsuariosDaEmpresa(auth.empresaId, {
    titulo: 'Arquivamento concluído',
    mensagem: `Os detalhes de ${arquivo.periodo_inicio.toLocaleDateString('pt-BR')} a ${arquivo.periodo_fim.toLocaleDateString('pt-BR')} foram removidos. O histórico permanente dos containers foi preservado.`,
    modulo: 'RELATORIOS',
  }, ['GESTOR_EMPRESA']).catch((error) => console.error('Falha ao notificar conclusão do arquivamento:', error))

  return NextResponse.json({ sucesso: true, removidos, arquivo_removido: true })
}

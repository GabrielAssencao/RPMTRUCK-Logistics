import { createHash, randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireEmpresaAuth } from '@/lib/empresaAuth'
import { gerarRelatorioOperacionalExcel } from '@/lib/relatoriosExcel'
import {
  getRelatoriosSoftLimitBytes,
  RELATORIO_MAX_FILE_BYTES,
  RELATORIOS_BUCKET,
} from '@/lib/relatoriosStorage'
import { notificarUsuariosDaEmpresa } from '@/lib/notificacoes'
import { prisma } from '@/lib/prisma'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'
import { executarComAuditoria } from '@/lib/auditoria'
import { applyRateLimit, RATE_LIMITS } from '@/lib/rateLimit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const schema = z.object({
  inicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  fim: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

function gestorAutorizado(role: string) {
  return role === 'GESTOR_EMPRESA' || role === 'GESTOR'
}

export async function POST(request: NextRequest) {
  const auth = await requireEmpresaAuth(request)
  if (auth.error || !auth.session || !auth.empresaId || !auth.empresa) {
    return NextResponse.json({ erro: auth.error }, { status: auth.status })
  }
  if (!gestorAutorizado(auth.session.role)) {
    return NextResponse.json({ erro: 'Apenas o gestor pode gerar arquivos de auditoria.' }, { status: 403 })
  }
  const limited = await applyRateLimit(
    request,
    `report-generate:${auth.empresaId}:${auth.session.userId}`,
    RATE_LIMITS.REPORT_GENERATE.limit,
    RATE_LIMITS.REPORT_GENERATE.windowMs,
  )
  if (limited) return limited

  const parsed = schema.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ erro: 'Período inválido.' }, { status: 400 })

  const periodoInicio = new Date(`${parsed.data.inicio}T00:00:00.000Z`)
  const periodoFim = new Date(`${parsed.data.fim}T23:59:59.999Z`)
  const periodoDias = Math.floor((periodoFim.getTime() - periodoInicio.getTime()) / 86_400_000) + 1
  if (periodoFim < periodoInicio || periodoDias > auth.empresa.permissoes.historicoAnos * 366) {
    return NextResponse.json(
      { erro: `O plano permite arquivos com até ${auth.empresa.permissoes.historicoAnos} ano(s) por período.` },
      { status: 403 },
    )
  }
  if (periodoInicio > new Date()) {
    return NextResponse.json({ erro: 'Não é possível gerar um relatório de um período futuro.' }, { status: 400 })
  }

  const duplicado = await prisma.relatorioArquivo.findFirst({
    where: {
      empresaId: auth.empresaId,
      gerado_automaticamente: true,
      periodo_inicio: periodoInicio,
      periodo_fim: periodoFim,
      arquivo_removido_em: null,
    },
    select: { id: true },
  })
  if (duplicado) {
    return NextResponse.json({ erro: 'Já existe um arquivo automático disponível para este período.' }, { status: 409 })
  }

  const [containers, custos, manutencoes, usuario] = await prisma.$transaction([
    prisma.container.findMany({
      where: { empresaId: auth.empresaId, data: { gte: periodoInicio, lte: periodoFim }, relatorioArquivoId: null },
      include: {
        veiculo: { select: { placa: true, modelo: true } },
        motorista: { select: { nome: true } },
      },
      orderBy: [{ data: 'asc' }, { codigo: 'asc' }],
    }),
    prisma.custo.findMany({
      where: { empresaId: auth.empresaId, data: { gte: periodoInicio, lte: periodoFim }, relatorioArquivoId: null },
      include: {
        veiculo: { select: { placa: true, modelo: true } },
        motorista: { select: { nome: true } },
      },
      orderBy: { data: 'asc' },
    }),
    prisma.historicoVeiculo.findMany({
      where: { empresaId: auth.empresaId, data_agendada: { gte: periodoInicio, lte: periodoFim }, relatorioArquivoId: null },
      include: { veiculo: { select: { placa: true, modelo: true } } },
      orderBy: { data_agendada: 'asc' },
    }),
    prisma.usuario.findUnique({ where: { id: auth.session.userId }, select: { nome: true } }),
  ])

  const movimentacoesPermanentes = await prisma.movimentacaoContainerPermanente.findMany({
    where: {
      empresaId: auth.empresaId,
      data_operacao: { gte: periodoInicio, lte: periodoFim },
      relatorioArquivoId: null,
    },
    select: {
      id: true,
      codigo_container: true,
      terminal_origem: true,
      terminal_destino: true,
      data_operacao: true,
    },
    orderBy: [{ data_operacao: 'asc' }, { codigo_container: 'asc' }],
  })

  if (movimentacoesPermanentes.length === 0 && containers.length === 0 && custos.length === 0 && manutencoes.length === 0) {
    return NextResponse.json({ erro: 'Não há dados operacionais nesse período.' }, { status: 422 })
  }

  const arquivoId = randomUUID()
  const geradoEm = new Date()
  const relatorio = await gerarRelatorioOperacionalExcel({
    arquivoId,
    empresa: {
      nome: auth.empresa.nome,
      cnpj: auth.empresa.cnpj,
      plano: auth.empresa.plano,
    },
    periodoInicio,
    periodoFim,
    geradoEm,
    geradoPor: usuario?.nome || 'Gestor da empresa',
    movimentacoesPermanentes,
    containers,
    custos,
    manutencoes,
  })

  if (relatorio.conteudo.length > RELATORIO_MAX_FILE_BYTES) {
    return NextResponse.json({ erro: 'O arquivo gerado ultrapassou 10 MB. Selecione um período menor.' }, { status: 413 })
  }

  const usoGlobal = await prisma.relatorioArquivo.aggregate({
    where: { arquivo_removido_em: null },
    _sum: { tamanho_bytes: true },
  })
  if ((usoGlobal._sum.tamanho_bytes ?? 0) + relatorio.conteudo.length > getRelatoriosSoftLimitBytes()) {
    return NextResponse.json(
      { erro: 'O limite preventivo do Storage foi atingido. Confirme e remova arquivos já baixados antes de gerar outro.' },
      { status: 507 },
    )
  }

  const checksumArquivo = createHash('sha256').update(relatorio.conteudo).digest('hex')
  const nomeArquivo = `rpmtruck-operacional-${parsed.data.inicio}-a-${parsed.data.fim}.xlsx`
  const caminho = `${auth.empresaId}/${periodoInicio.getUTCFullYear()}/${arquivoId}.xlsx`
  const supabase = getSupabaseAdmin()
  const upload = await supabase.storage.from(RELATORIOS_BUCKET).upload(caminho, relatorio.conteudo, {
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    cacheControl: '0',
    upsert: false,
  })
  if (upload.error) {
    console.error('Erro ao armazenar Excel automático:', upload.error.message)
    return NextResponse.json({ erro: 'Não foi possível salvar o Excel no bucket privado.' }, { status: 502 })
  }

  try {
    const registro = await executarComAuditoria({ usuarioId: auth.session.userId }, async (tx) => {
      const criado = await tx.relatorioArquivo.create({
        data: {
          id: arquivoId,
          nome_arquivo: nomeArquivo,
          caminho_storage: caminho,
          bucket: RELATORIOS_BUCKET,
          mime_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          tamanho_bytes: relatorio.conteudo.length,
          checksum_sha256: checksumArquivo,
          periodo_inicio: periodoInicio,
          periodo_fim: periodoFim,
          tipo: 'OPERACIONAL',
          status: 'PRONTO_DOWNLOAD',
          gerado_automaticamente: true,
          resumo_registros: { ...relatorio.resumo, checksumDados: relatorio.checksumDados },
          empresaId: auth.empresaId!,
          criadoPorId: auth.session!.userId,
        },
      })
      await tx.movimentacaoContainerPermanente.updateMany({
        where: {
          empresaId: auth.empresaId!,
          id: { in: movimentacoesPermanentes.map((movimentacao) => movimentacao.id) },
        },
        data: {
          relatorioArquivoId: criado.id,
          checksum_arquivo: checksumArquivo,
          arquivado_em: geradoEm,
        },
      })
      await tx.container.updateMany({
        where: { id: { in: containers.map((container) => container.id) }, relatorioArquivoId: null },
        data: { relatorioArquivoId: criado.id },
      })
      await tx.custo.updateMany({
        where: { id: { in: custos.map((custo) => custo.id) }, relatorioArquivoId: null },
        data: { relatorioArquivoId: criado.id },
      })
      await tx.historicoVeiculo.updateMany({
        where: { id: { in: manutencoes.map((manutencao) => manutencao.id) }, relatorioArquivoId: null },
        data: { relatorioArquivoId: criado.id },
      })
      return criado
    })

    await notificarUsuariosDaEmpresa(auth.empresaId, {
      titulo: 'Excel operacional pronto',
      mensagem: `O arquivo de ${parsed.data.inicio} a ${parsed.data.fim} está pronto para download e conferência.`,
      modulo: 'RELATORIOS',
    }, ['GESTOR_EMPRESA']).catch((error) => console.error('Falha ao notificar relatório pronto:', error))

    return NextResponse.json(registro, { status: 201 })
  } catch (error) {
    await supabase.storage.from(RELATORIOS_BUCKET).remove([caminho])
    console.error('Erro ao registrar Excel automático:', error)
    return NextResponse.json({ erro: 'O Excel foi gerado, mas não pôde ser registrado.' }, { status: 500 })
  }
}

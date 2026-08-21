import { createHash, randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { TipoRelatorioArquivo } from '@prisma/client'
import { requireEmpresaAuth } from '@/lib/empresaAuth'
import { prisma } from '@/lib/prisma'
import {
  getRelatoriosSoftLimitBytes,
  isRelatorioMimeType,
  RELATORIO_MAX_FILE_BYTES,
  RELATORIO_MIME_TYPES,
  RELATORIOS_BUCKET,
  sanitizarNomeArquivo,
  validarConteudoRelatorio,
} from '@/lib/relatoriosStorage'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'
import { notificarAdmins, notificarUsuariosDaEmpresa } from '@/lib/notificacoes'
import { executarComAuditoria } from '@/lib/auditoria'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const TIPOS_RELATORIO = new Set(Object.values(TipoRelatorioArquivo))

function parseDate(value: FormDataEntryValue | null): Date | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const date = new Date(`${value}T00:00:00.000Z`)
  return Number.isNaN(date.getTime()) ? null : date
}

function gestorAutorizado(role?: string) {
  return role === 'GESTOR_EMPRESA' || role === 'GESTOR'
}

async function avisarCapacidade(empresaId: string, empresaNome: string, percentual: number) {
  const nivel = percentual >= 90 ? 90 : percentual >= 80 ? 80 : percentual >= 70 ? 70 : percentual >= 60 ? 60 : 0
  if (!nivel) return
  const titulo = `Capacidade do Supabase em ${nivel}%`
  const desde = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const existente = await prisma.notificacao.findFirst({
    where: { empresaId, titulo, criado_em: { gte: desde } },
    select: { id: true },
  })
  if (existente) return

  const mensagem = nivel >= 90
    ? 'Uso crítico. Evite novos arquivos grandes e planeje a migração para o Supabase Pro.'
    : nivel >= 80
      ? 'Uso crítico. Baixe e confirme os arquivos elegíveis para liberar espaço com segurança.'
      : nivel >= 70
        ? 'Inicie o arquivamento preventivo dos períodos elegíveis e acompanhe o crescimento do projeto.'
        : 'O projeto atingiu o primeiro nível de atenção. Revise banco e Storage antes que se aproximem do limite.'

  await Promise.all([
    notificarUsuariosDaEmpresa(empresaId, { titulo, mensagem, modulo: 'RELATORIOS' }, ['GESTOR_EMPRESA']),
    notificarAdmins({ titulo, mensagem: `${empresaNome}: ${mensagem}`, modulo: 'RELATORIOS' }),
  ])
}

export async function GET(request: NextRequest) {
  const auth = await requireEmpresaAuth(request)
  if (auth.error || !auth.session || !auth.empresaId || !auth.empresa) {
    return NextResponse.json({ erro: auth.error }, { status: auth.status })
  }

  const [arquivos, usoEmpresa, usoGlobal, tamanhoBanco] = await Promise.all([
    prisma.relatorioArquivo.findMany({
      where: { empresaId: auth.empresaId },
      select: {
        id: true,
        nome_arquivo: true,
        mime_type: true,
        tamanho_bytes: true,
        checksum_sha256: true,
        periodo_inicio: true,
        periodo_fim: true,
        tipo: true,
        status: true,
        gerado_automaticamente: true,
        resumo_registros: true,
        baixado_em: true,
        confirmado_em: true,
        dados_purgados_em: true,
        arquivo_removido_em: true,
        criado_em: true,
      },
      orderBy: { criado_em: 'desc' },
      take: 100,
    }),
    prisma.relatorioArquivo.aggregate({
      where: { empresaId: auth.empresaId, arquivo_removido_em: null },
      _sum: { tamanho_bytes: true },
    }),
    prisma.relatorioArquivo.aggregate({
      where: { arquivo_removido_em: null },
      _sum: { tamanho_bytes: true },
    }),
    prisma.$queryRaw<Array<{ bytes: bigint }>>`SELECT pg_database_size(current_database())::bigint AS bytes`,
  ])

  const limiteBancoBytes = 500 * 1024 * 1024
  const bancoBytes = Number(tamanhoBanco[0]?.bytes ?? 0)
  const usoGlobalBytes = usoGlobal._sum.tamanho_bytes ?? 0
  const limiteStorageBytes = getRelatoriosSoftLimitBytes()
  const percentualBanco = limiteBancoBytes ? Math.round((bancoBytes / limiteBancoBytes) * 1000) / 10 : 0
  const percentualStorage = limiteStorageBytes ? Math.round((usoGlobalBytes / limiteStorageBytes) * 1000) / 10 : 0
  const agora = new Date()
  const arquivosComRetencao = arquivos.map((arquivo) => {
    const elegivelEm = new Date(arquivo.periodo_fim)
    elegivelEm.setUTCFullYear(elegivelEm.getUTCFullYear() + auth.empresa!.permissoes.historicoAnos)
    return {
      ...arquivo,
      elegivel_purga_em: elegivelEm,
      pode_purgar: arquivo.gerado_automaticamente
        && arquivo.status === 'CONFIRMADO_GESTOR'
        && elegivelEm <= agora,
    }
  })

  await avisarCapacidade(auth.empresaId, auth.empresa.nome, Math.max(percentualBanco, percentualStorage))
    .catch((error) => console.error('Falha ao emitir alerta de capacidade:', error))

  return NextResponse.json({
    arquivos: arquivosComRetencao,
    permissoes: { pode_gerenciar: gestorAutorizado(auth.session.role) },
    armazenamento: {
      uso_bytes: usoEmpresa._sum.tamanho_bytes ?? 0,
      uso_global_bytes: usoGlobalBytes,
      limite_interno_bytes: limiteStorageBytes,
      banco_uso_bytes: bancoBytes,
      banco_limite_bytes: limiteBancoBytes,
      banco_percentual: percentualBanco,
      storage_percentual: percentualStorage,
    },
  })
}

export async function POST(request: NextRequest) {
  const auth = await requireEmpresaAuth(request)
  if (auth.error || !auth.session || !auth.empresaId || !auth.empresa) {
    return NextResponse.json({ erro: auth.error }, { status: auth.status })
  }
  if (!gestorAutorizado(auth.session.role)) {
    return NextResponse.json({ erro: 'Apenas o gestor pode arquivar relatórios.' }, { status: 403 })
  }

  try {
    const formData = await request.formData()
    const arquivo = formData.get('arquivo')
    const periodoInicio = parseDate(formData.get('periodo_inicio'))
    const periodoFim = parseDate(formData.get('periodo_fim'))
    const tipoValue = formData.get('tipo')

    if (!(arquivo instanceof File) || !periodoInicio || !periodoFim || typeof tipoValue !== 'string') {
      return NextResponse.json({ erro: 'Arquivo, tipo e período são obrigatórios.' }, { status: 400 })
    }
    if (!TIPOS_RELATORIO.has(tipoValue as TipoRelatorioArquivo)) {
      return NextResponse.json({ erro: 'Tipo de relatório inválido.' }, { status: 400 })
    }
    if (periodoInicio > periodoFim) {
      return NextResponse.json({ erro: 'O início do período deve ser anterior ao fim.' }, { status: 400 })
    }

    const periodoDias = Math.floor((periodoFim.getTime() - periodoInicio.getTime()) / 86_400_000) + 1
    if (periodoDias > auth.empresa.permissoes.historicoAnos * 366) {
      return NextResponse.json(
        { erro: `O plano permite relatórios de até ${auth.empresa.permissoes.historicoAnos} ano(s).` },
        { status: 403 },
      )
    }
    if (arquivo.size <= 0 || arquivo.size > RELATORIO_MAX_FILE_BYTES) {
      return NextResponse.json({ erro: 'O arquivo deve ter no máximo 10 MB.' }, { status: 413 })
    }
    if (!isRelatorioMimeType(arquivo.type)) {
      return NextResponse.json({ erro: 'Formato permitido: PDF, XLS, XLSX ou CSV.' }, { status: 415 })
    }

    const uso = await prisma.relatorioArquivo.aggregate({
      where: { arquivo_removido_em: null },
      _sum: { tamanho_bytes: true },
    })
    const usoAtual = uso._sum.tamanho_bytes ?? 0
    if (usoAtual + arquivo.size > getRelatoriosSoftLimitBytes()) {
      return NextResponse.json(
        { erro: 'O limite interno do Storage Free foi atingido. Exporte os arquivos antes de continuar.' },
        { status: 507 },
      )
    }

    const conteudo = Buffer.from(await arquivo.arrayBuffer())
    if (!validarConteudoRelatorio(conteudo, arquivo.type)) {
      return NextResponse.json({ erro: 'O conteúdo do arquivo não corresponde ao formato informado.' }, { status: 415 })
    }
    const checksum = createHash('sha256').update(conteudo).digest('hex')
    const extensao = RELATORIO_MIME_TYPES[arquivo.type]
    const caminho = `${auth.empresaId}/${periodoInicio.getUTCFullYear()}/${randomUUID()}.${extensao}`
    const nomeArquivo = sanitizarNomeArquivo(arquivo.name)
    const supabase = getSupabaseAdmin()
    const upload = await supabase.storage.from(RELATORIOS_BUCKET).upload(caminho, conteudo, {
      contentType: arquivo.type,
      cacheControl: '0',
      upsert: false,
    })

    if (upload.error) {
      console.error('Erro ao enviar relatório ao Storage:', upload.error.message)
      return NextResponse.json(
        { erro: 'Não foi possível arquivar o relatório. Confirme se a migração criou o bucket privado.' },
        { status: 502 },
      )
    }

    try {
      const registro = await executarComAuditoria({ usuarioId: auth.session.userId }, (tx) => tx.relatorioArquivo.create({
        data: {
          nome_arquivo: nomeArquivo,
          caminho_storage: caminho,
          bucket: RELATORIOS_BUCKET,
          mime_type: arquivo.type,
          tamanho_bytes: arquivo.size,
          checksum_sha256: checksum,
          periodo_inicio: periodoInicio,
          periodo_fim: periodoFim,
          tipo: tipoValue as TipoRelatorioArquivo,
          status: 'PRONTO_DOWNLOAD',
          gerado_automaticamente: false,
          empresaId: auth.empresaId,
          criadoPorId: auth.session.userId,
        },
      }))

      return NextResponse.json(registro, { status: 201 })
    } catch (error) {
      await supabase.storage.from(RELATORIOS_BUCKET).remove([caminho])
      throw error
    }
  } catch (error) {
    console.error('Erro ao arquivar relatório:', error)
    const message = error instanceof Error && error.message === 'SUPABASE_STORAGE_NOT_CONFIGURED'
      ? 'Configure NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no servidor.'
      : 'Erro interno ao arquivar relatório.'
    return NextResponse.json({ erro: message }, { status: 500 })
  }
}

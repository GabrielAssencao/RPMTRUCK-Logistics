import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireEmpresaAuth } from '@/lib/empresaAuth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const filtrosSchema = z.object({
  busca: z.string().trim().max(80).default(''),
  pagina: z.coerce.number().int().min(1).max(10_000).default(1),
})

export async function GET(request: NextRequest) {
  const auth = await requireEmpresaAuth(request, { modulo: 'FROTA' })
  if (auth.error || !auth.session?.empresaId) {
    return NextResponse.json({ erro: auth.error }, { status: auth.status })
  }

  const parsed = filtrosSchema.safeParse({
    busca: request.nextUrl.searchParams.get('busca') ?? '',
    pagina: request.nextUrl.searchParams.get('pagina') ?? '1',
  })
  if (!parsed.success) return NextResponse.json({ erro: 'Filtros inválidos.' }, { status: 400 })

  const porPagina = 25
  const where = {
    empresaId: auth.session.empresaId,
    ...(parsed.data.busca
      ? {
          OR: [
            { codigo_container: { contains: parsed.data.busca, mode: 'insensitive' as const } },
            { terminal_origem: { contains: parsed.data.busca, mode: 'insensitive' as const } },
            { terminal_destino: { contains: parsed.data.busca, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  }

  const [registros, total] = await prisma.$transaction([
    prisma.movimentacaoContainerPermanente.findMany({
      where,
      select: {
        id: true,
        codigo_container: true,
        terminal_origem: true,
        terminal_destino: true,
        data_operacao: true,
        versao: true,
        registro_atual: true,
        checksum_arquivo: true,
        arquivado_em: true,
        detalhes_purgados_em: true,
        relatorioArquivo: {
          select: { id: true, nome_arquivo: true, arquivo_removido_em: true },
        },
      },
      orderBy: [{ data_operacao: 'desc' }, { codigo_container: 'asc' }],
      skip: (parsed.data.pagina - 1) * porPagina,
      take: porPagina,
    }),
    prisma.movimentacaoContainerPermanente.count({ where }),
  ])

  return NextResponse.json({
    registros: registros.map((registro) => ({
      id: registro.id,
      codigo: registro.codigo_container,
      origem: registro.terminal_origem,
      destino: registro.terminal_destino,
      data: registro.data_operacao.toISOString().slice(0, 10),
      versao: registro.versao,
      registroAtual: registro.registro_atual,
      checksumArquivo: registro.checksum_arquivo,
      arquivadoEm: registro.arquivado_em,
      detalhesPurgadosEm: registro.detalhes_purgados_em,
      arquivo: registro.relatorioArquivo,
    })),
    paginacao: {
      pagina: parsed.data.pagina,
      porPagina,
      total,
      totalPaginas: Math.max(1, Math.ceil(total / porPagina)),
    },
  })
}

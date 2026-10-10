import { NextRequest, NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { applyRateLimit, RATE_LIMITS } from '@/lib/rateLimit'
import { z } from 'zod'
import { SESSION_ONLINE_WINDOW_MS } from '@/lib/sessionPresence'
import { getDatabaseSoftLimitBytes } from '@/lib/storageCapacity'
import { getRelatoriosSoftLimitBytes } from '@/lib/relatoriosStorage'
import { Prisma } from '@prisma/client'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = await requireAdminAuth(request)
  if (auth.error || !auth.session) {
    return NextResponse.json({ erro: auth.error }, { status: auth.status })
  }

  const limited = await applyRateLimit(
    request,
    `admin-security:${auth.session.userId}`,
    RATE_LIMITS.ADMIN_READ.limit,
    RATE_LIMITS.ADMIN_READ.windowMs,
  )
  if (limited) return limited

  const tamanhoPagina = 20
  const paginasSchema = z.object({
    SESSOES: z.coerce.number().int().min(1).max(100000),
    EVENTOS: z.coerce.number().int().min(1).max(100000),
    AUDITORIA: z.coerce.number().int().min(1).max(100000),
    EXCLUSOES: z.coerce.number().int().min(1).max(100000),
  })
  const paginas = paginasSchema.safeParse(Object.fromEntries(
    ['SESSOES', 'EVENTOS', 'AUDITORIA', 'EXCLUSOES'].map(secao => [secao, request.nextUrl.searchParams.get(`pagina${secao}`) ?? '1']),
  ))
  if (!paginas.success) return NextResponse.json({ erro: 'Página inválida.' }, { status: 400 })
  const paginar = (secao: keyof typeof paginas.data) => ({ skip: (paginas.data[secao] - 1) * tamanhoPagina, take: tamanhoPagina + 1 })

  const filtros = z.object({
    empresaId: z.union([z.literal('SISTEMA'), z.string().uuid()]).nullable(),
    periodo: z.enum(['24H', '7D', '30D', '90D']).default('7D'),
    tipoEvento: z.enum(['TODOS', 'LOGIN_SUCESSO', 'LOGIN_FALHA', 'LOGOUT', 'RATE_LIMIT', 'BOT_REJEITADO', 'SESSAO_REVOGADA']).default('TODOS'),
    busca: z.string().trim().max(80).default(''),
  }).safeParse({
    empresaId: request.nextUrl.searchParams.get('empresaId'),
    periodo: request.nextUrl.searchParams.get('periodo') || undefined,
    tipoEvento: request.nextUrl.searchParams.get('tipoEvento') || undefined,
    busca: request.nextUrl.searchParams.get('busca') || undefined,
  })
  if (!filtros.success) return NextResponse.json({ erro: 'Filtros de segurança inválidos.' }, { status: 400 })

  if (filtros.data.empresaId && filtros.data.empresaId !== 'SISTEMA') {
    const empresaExiste = await prisma.empresa.findUnique({ where: { id: filtros.data.empresaId }, select: { id: true } })
    if (!empresaExiste) return NextResponse.json({ erro: 'Empresa não encontrada.' }, { status: 404 })
  }
  const porEmpresa = filtros.data.empresaId === 'SISTEMA'
    ? { empresaId: null }
    : filtros.data.empresaId
      ? { empresaId: filtros.data.empresaId }
      : {}

  const agora = new Date()
  const ativoDesde = new Date(agora.getTime() - SESSION_ONLINE_WINDOW_MS)
  const ultimas24h = new Date(agora.getTime() - 24 * 60 * 60 * 1000)
  const diasPeriodo = { '24H': 1, '7D': 7, '30D': 30, '90D': 90 }[filtros.data.periodo]
  const desde = new Date(agora.getTime() - diasPeriodo * 24 * 60 * 60 * 1000)
  const busca = filtros.data.busca
  const ipBuscado = busca.replace(/^IP#/i, '').trim().toLowerCase()
  const buscaIpValida = /^[a-f0-9]{6,64}$/.test(ipBuscado)
  const usuariosEncontrados = busca
    ? await prisma.usuario.findMany({
        where: { OR: [{ nome: { contains: busca, mode: 'insensitive' } }, { email: { contains: busca, mode: 'insensitive' } }] },
        select: { id: true },
        take: 200,
      })
    : []
  const usuarioIdsBusca = usuariosEncontrados.map((item) => item.id)
  const filtroUsuarioRelacao: Prisma.UsuarioWhereInput = busca
    ? { OR: [{ nome: { contains: busca, mode: 'insensitive' } }, { email: { contains: busca, mode: 'insensitive' } }] }
    : {}
  const filtroAuditoriaBusca: Prisma.AuditoriaLogWhereInput = busca
    ? {
        OR: [
          { tabela: { contains: busca, mode: 'insensitive' } },
          { acao: { contains: busca, mode: 'insensitive' } },
          { origem: { contains: busca, mode: 'insensitive' } },
          { registroId: { contains: busca, mode: 'insensitive' } },
          ...(usuarioIdsBusca.length ? [{ usuarioId: { in: usuarioIdsBusca } }] : []),
        ],
      }
    : {}
  const filtroEventoBusca: Prisma.EventoSegurancaWhereInput = busca
    ? {
        OR: [
          { usuario: { is: filtroUsuarioRelacao } },
          ...(buscaIpValida ? [{ ipHash: { startsWith: ipBuscado } }] : []),
        ],
      }
    : {}
  const filtroSessaoBusca: Prisma.SessaoUsuarioWhereInput = busca
    ? {
        OR: [
          { usuario: { is: filtroUsuarioRelacao } },
          ...(buscaIpValida ? [{ ipHash: { startsWith: ipBuscado } }] : []),
        ],
      }
    : {}
  const tipoEvento = filtros.data.tipoEvento === 'TODOS' ? {} : { tipo: filtros.data.tipoEvento }
  const empresaGeoSql = filtros.data.empresaId === 'SISTEMA'
    ? Prisma.sql`AND empresa_id IS NULL`
    : filtros.data.empresaId
      ? Prisma.sql`AND empresa_id = ${filtros.data.empresaId}::uuid`
      : Prisma.empty

  const [sessoes, eventos, auditoria, exclusoes, falhasLogin, loginsSucesso, bloqueiosRateLimit, sessoesAtivas, eventos24h, limitesAtivos, acessosPorUsuario, origensSuspeitas, tamanhoBanco, usoRelatorios, geoEstados, geoCobertura, empresas] = await Promise.all([
    prisma.sessaoUsuario.findMany({
      where: { ...porEmpresa, ...filtroSessaoBusca, revogadaEm: null, expiraEm: { gt: agora }, ultimaAtividade: { gte: ativoDesde } },
      orderBy: [{ ultimaAtividade: 'desc' }, { id: 'desc' }],
      ...paginar('SESSOES'),
      select: {
        id: true,
        criadoEm: true,
        ultimaAtividade: true,
        expiraEm: true,
        ipHash: true,
        userAgent: true,
        usuario: { select: { id: true, nome: true, email: true, role: true } },
        empresa: { select: { id: true, nome: true } },
      },
    }),
    prisma.eventoSeguranca.findMany({
      where: { ...porEmpresa, ...filtroEventoBusca, ...tipoEvento, criadoEm: { gte: desde } },
      orderBy: [{ criadoEm: 'desc' }, { id: 'desc' }],
      ...paginar('EVENTOS'),
      select: {
        id: true,
        tipo: true,
        criadoEm: true,
        ipHash: true,
        userAgent: true,
        usuario: { select: { id: true, nome: true, email: true } },
        empresa: { select: { id: true, nome: true } },
      },
    }),
    prisma.auditoriaLog.findMany({
      where: { ...porEmpresa, ...filtroAuditoriaBusca, criadoEm: { gte: desde } },
      orderBy: [{ criadoEm: 'desc' }, { id: 'desc' }],
      ...paginar('AUDITORIA'),
      select: {
        id: true,
        tabela: true,
        acao: true,
        registroId: true,
        empresaId: true,
        usuarioId: true,
        origem: true,
        criadoEm: true,
      },
    }),
    filtros.data.empresaId === 'SISTEMA'
      ? Promise.resolve([])
      : prisma.exclusaoEmpresaJob.findMany({
          where: {
            ...(filtros.data.empresaId ? { empresaId: filtros.data.empresaId } : {}),
            criadoEm: { gte: desde },
            ...(busca ? { OR: [{ protocolo: { contains: busca, mode: 'insensitive' as const } }, { status: { contains: busca, mode: 'insensitive' as const } }] } : {}),
          },
          orderBy: [{ criadoEm: 'desc' }, { id: 'desc' }],
          ...paginar('EXCLUSOES'),
          select: {
            id: true,
            protocolo: true,
            empresaId: true,
            status: true,
            resumo: true,
            politicaVersao: true,
            criadoEm: true,
            concluidoEm: true,
            reterAte: true,
          },
        }),
    prisma.eventoSeguranca.count({ where: { ...porEmpresa, tipo: 'LOGIN_FALHA', criadoEm: { gte: ultimas24h } } }),
    prisma.eventoSeguranca.count({ where: { ...porEmpresa, tipo: 'LOGIN_SUCESSO', criadoEm: { gte: ultimas24h } } }),
    prisma.eventoSeguranca.count({ where: { ...porEmpresa, tipo: 'RATE_LIMIT', criadoEm: { gte: ultimas24h } } }),
    prisma.sessaoUsuario.count({ where: { ...porEmpresa, revogadaEm: null, expiraEm: { gt: agora }, ultimaAtividade: { gte: ativoDesde } } }),
    prisma.eventoSeguranca.count({ where: { ...porEmpresa, criadoEm: { gte: ultimas24h } } }),
    prisma.rateLimit.count({ where: { expiraEm: { gt: agora } } }),
    prisma.eventoSeguranca.groupBy({
      by: ['usuarioId'],
      where: { ...porEmpresa, tipo: 'LOGIN_SUCESSO', usuarioId: { not: null }, criadoEm: { gte: ultimas24h } },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 5,
    }),
    prisma.eventoSeguranca.groupBy({
      by: ['ipHash'],
      where: { ...porEmpresa, tipo: { in: ['LOGIN_FALHA', 'RATE_LIMIT'] }, ipHash: { not: null }, criadoEm: { gte: ultimas24h } },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 5,
    }),
    prisma.$queryRaw<Array<{ bytes: bigint }>>`SELECT pg_database_size(current_database())::bigint AS bytes`,
    prisma.relatorioArquivo.aggregate({ where: { arquivo_removido_em: null }, _sum: { tamanho_bytes: true } }),
    prisma.$queryRaw<Array<{ uf: string; acessos: number; alertas: number }>>(Prisma.sql`
      SELECT
        UPPER(contexto #>> '{geo,region}') AS uf,
        COUNT(*) FILTER (WHERE tipo = 'LOGIN_SUCESSO')::integer AS acessos,
        COUNT(*) FILTER (WHERE tipo IN ('LOGIN_FALHA', 'RATE_LIMIT', 'BOT_REJEITADO'))::integer AS alertas
      FROM eventos_seguranca
      WHERE criado_em >= ${desde}
        ${empresaGeoSql}
        AND contexto #>> '{geo,country}' = 'BR'
        AND UPPER(contexto #>> '{geo,region}') ~ '^[A-Z]{2}$'
        AND tipo IN ('LOGIN_SUCESSO', 'LOGIN_FALHA', 'RATE_LIMIT', 'BOT_REJEITADO')
      GROUP BY UPPER(contexto #>> '{geo,region}')
    `),
    prisma.$queryRaw<Array<{ total: number; geolocalizados: number }>>(Prisma.sql`
      SELECT
        COUNT(*)::integer AS total,
        COUNT(*) FILTER (
          WHERE contexto #>> '{geo,country}' = 'BR'
            AND UPPER(contexto #>> '{geo,region}') ~ '^[A-Z]{2}$'
        )::integer AS geolocalizados
      FROM eventos_seguranca
      WHERE criado_em >= ${desde}
        ${empresaGeoSql}
        AND tipo IN ('LOGIN_SUCESSO', 'LOGIN_FALHA', 'RATE_LIMIT', 'BOT_REJEITADO')
    `),
    prisma.empresa.findMany({ orderBy: { nome: 'asc' }, select: { id: true, nome: true, excluidoEm: true } }),
  ])

  const userIds = [...new Set(auditoria.map((item) => item.usuarioId).filter((id): id is string => Boolean(id)))]
  const companyIds = [...new Set(auditoria.map((item) => item.empresaId).filter((id): id is string => Boolean(id)))]
  const idsRanking = acessosPorUsuario.map((item) => item.usuarioId).filter((id): id is string => Boolean(id))
  const [usuariosAuditoria, empresasAuditoria, usuariosRanking] = await Promise.all([
    prisma.usuario.findMany({ where: { id: { in: userIds } }, select: { id: true, nome: true, email: true } }),
    prisma.empresa.findMany({ where: { id: { in: companyIds } }, select: { id: true, nome: true } }),
    prisma.usuario.findMany({ where: { id: { in: idsRanking } }, select: { id: true, nome: true, email: true, empresa: { select: { nome: true } } } }),
  ])
  const usuariosPorId = new Map(usuariosAuditoria.map((item) => [item.id, item]))
  const empresasPorId = new Map(empresasAuditoria.map((item) => [item.id, item]))
  const usuariosRankingPorId = new Map(usuariosRanking.map((item) => [item.id, item]))
  const exclusaoPorEmpresa = new Map<string, (typeof exclusoes)[number]>()
  for (const exclusao of exclusoes) {
    if (!exclusaoPorEmpresa.has(exclusao.empresaId)) exclusaoPorEmpresa.set(exclusao.empresaId, exclusao)
  }

  const identificarEmpresa = (empresa: { id: string; nome: string; excluidoEm?: Date | null }) => {
    if (!empresa.excluidoEm && empresa.nome !== 'Empresa removida') return { id: empresa.id, nome: empresa.nome }
    const exclusao = exclusaoPorEmpresa.get(empresa.id)
    const referencia = exclusao?.protocolo || `ID ${empresa.id.slice(0, 8)}`
    const data = empresa.excluidoEm?.toISOString().slice(0, 10)
    return { id: empresa.id, nome: `Empresa removida · ${referencia}${data ? ` · ${data}` : ''}` }
  }

  return NextResponse.json(
    {
      resumo: {
        sessoesAtivas,
        loginsSucesso24h: loginsSucesso,
        falhasLogin24h: falhasLogin,
        bloqueiosRateLimit24h: bloqueiosRateLimit,
        eventosSeguranca24h: eventos24h,
        mediaEventosHora24h: Math.round((eventos24h / 24) * 10) / 10,
        taxaSucessoLogin24h: loginsSucesso + falhasLogin > 0 ? Math.round((loginsSucesso / (loginsSucesso + falhasLogin)) * 1000) / 10 : null,
        limitesAtivos,
      },
      capacidade: {
        bancoUsoBytes: Number(tamanhoBanco[0]?.bytes ?? 0),
        bancoLimiteBytes: getDatabaseSoftLimitBytes(),
        relatoriosUsoBytes: usoRelatorios._sum.tamanho_bytes ?? 0,
        relatoriosLimiteBytes: getRelatoriosSoftLimitBytes(),
      },
      rankings: {
        acessos: acessosPorUsuario.map((item) => {
          const usuario = item.usuarioId ? usuariosRankingPorId.get(item.usuarioId) : null
          return { usuarioId: item.usuarioId, nome: usuario?.nome || 'Usuário removido', email: usuario?.email || null, empresa: usuario?.empresa?.nome || 'RPMTruck', total: item._count.id }
        }),
        origensSuspeitas: origensSuspeitas.map((item) => ({ ipCorrelacao: item.ipHash?.slice(0, 12) || 'desconhecido', total: item._count.id })),
      },
      geografia: {
        estados: geoEstados,
        total: geoCobertura[0]?.total ?? 0,
        geolocalizados: geoCobertura[0]?.geolocalizados ?? 0,
        fonte: 'VERCEL_GEOIP_UF',
      },
      filtros: { periodo: filtros.data.periodo, tipoEvento: filtros.data.tipoEvento, busca },
      presenca: { verificadoEm: agora, onlineWindowMs: SESSION_ONLINE_WINDOW_MS },
      empresas: empresas.map(identificarEmpresa),
      paginacao: {
        SESSOES: { pagina: paginas.data.SESSOES, temProxima: sessoes.length > tamanhoPagina },
        EVENTOS: { pagina: paginas.data.EVENTOS, temProxima: eventos.length > tamanhoPagina },
        AUDITORIA: { pagina: paginas.data.AUDITORIA, temProxima: auditoria.length > tamanhoPagina },
        EXCLUSOES: { pagina: paginas.data.EXCLUSOES, temProxima: exclusoes.length > tamanhoPagina },
      },
      sessoes: sessoes.slice(0, tamanhoPagina).map((sessao) => ({
        ...sessao,
        atual: sessao.id === auth.session?.sessionId,
        ipCorrelacao: sessao.ipHash?.slice(0, 12) || null,
        ipHash: undefined,
      })),
      eventos: eventos.slice(0, tamanhoPagina).map((evento) => ({
        ...evento,
        ipCorrelacao: evento.ipHash?.slice(0, 12) || null,
        ipHash: undefined,
      })),
      auditoria: auditoria.slice(0, tamanhoPagina).map((item) => ({
        ...item,
        usuario: item.usuarioId ? usuariosPorId.get(item.usuarioId) || null : null,
        empresa: item.empresaId
          ? empresasPorId.has(item.empresaId)
            ? identificarEmpresa(empresasPorId.get(item.empresaId)!)
            : null
          : null,
      })),
      exclusoes: exclusoes.slice(0, tamanhoPagina).map((exclusao) => ({
        id: exclusao.id,
        protocolo: exclusao.protocolo,
        status: exclusao.status,
        resumo: exclusao.resumo,
        politicaVersao: exclusao.politicaVersao,
        criadoEm: exclusao.criadoEm,
        concluidoEm: exclusao.concluidoEm,
        reterAte: exclusao.reterAte,
      })),
    },
    { headers: { 'Cache-Control': 'private, no-store' } },
  )
}

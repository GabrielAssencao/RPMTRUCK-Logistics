import { NextRequest, NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { applyRateLimit, RATE_LIMITS } from '@/lib/rateLimit'
import { z } from 'zod'

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

  const filtroInformado = request.nextUrl.searchParams.get('empresaId')
  const filtroSchema = z.union([z.literal('SISTEMA'), z.string().uuid()]).nullable()
  const filtro = filtroSchema.safeParse(filtroInformado)
  if (!filtro.success) return NextResponse.json({ erro: 'Filtro de empresa inválido.' }, { status: 400 })

  if (filtro.data && filtro.data !== 'SISTEMA') {
    const empresaExiste = await prisma.empresa.findUnique({ where: { id: filtro.data }, select: { id: true } })
    if (!empresaExiste) return NextResponse.json({ erro: 'Empresa não encontrada.' }, { status: 404 })
  }
  const porEmpresa = filtro.data === 'SISTEMA'
    ? { empresaId: null }
    : filtro.data
      ? { empresaId: filtro.data }
      : {}

  const agora = new Date()
  const ativoDesde = new Date(agora.getTime() - 5 * 60 * 1000)
  const ultimas24h = new Date(agora.getTime() - 24 * 60 * 60 * 1000)

  const [sessoes, eventos, auditoria, exclusoes, falhasLogin, bloqueiosRateLimit, sessoesAtivas, empresas] = await Promise.all([
    prisma.sessaoUsuario.findMany({
      where: { ...porEmpresa, revogadaEm: null, expiraEm: { gt: agora }, ultimaAtividade: { gte: ativoDesde } },
      orderBy: { ultimaAtividade: 'desc' },
      take: 50,
      select: {
        id: true,
        criadoEm: true,
        ultimaAtividade: true,
        expiraEm: true,
        userAgent: true,
        usuario: { select: { id: true, nome: true, email: true, role: true } },
        empresa: { select: { id: true, nome: true } },
      },
    }),
    prisma.eventoSeguranca.findMany({
      where: porEmpresa,
      orderBy: { criadoEm: 'desc' },
      take: 50,
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
      where: porEmpresa,
      orderBy: { criadoEm: 'desc' },
      take: 50,
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
    filtro.data === 'SISTEMA'
      ? Promise.resolve([])
      : prisma.exclusaoEmpresaJob.findMany({
          where: filtro.data ? { empresaId: filtro.data } : undefined,
          orderBy: { criadoEm: 'desc' },
          take: 50,
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
    prisma.eventoSeguranca.count({ where: { ...porEmpresa, tipo: 'RATE_LIMIT', criadoEm: { gte: ultimas24h } } }),
    prisma.sessaoUsuario.count({ where: { ...porEmpresa, revogadaEm: null, expiraEm: { gt: agora }, ultimaAtividade: { gte: ativoDesde } } }),
    prisma.empresa.findMany({ orderBy: { nome: 'asc' }, select: { id: true, nome: true, excluidoEm: true } }),
  ])

  const userIds = [...new Set(auditoria.map((item) => item.usuarioId).filter((id): id is string => Boolean(id)))]
  const companyIds = [...new Set(auditoria.map((item) => item.empresaId).filter((id): id is string => Boolean(id)))]
  const [usuariosAuditoria, empresasAuditoria] = await Promise.all([
    prisma.usuario.findMany({ where: { id: { in: userIds } }, select: { id: true, nome: true, email: true } }),
    prisma.empresa.findMany({ where: { id: { in: companyIds } }, select: { id: true, nome: true } }),
  ])
  const usuariosPorId = new Map(usuariosAuditoria.map((item) => [item.id, item]))
  const empresasPorId = new Map(empresasAuditoria.map((item) => [item.id, item]))
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
      resumo: { sessoesAtivas, falhasLogin24h: falhasLogin, bloqueiosRateLimit24h: bloqueiosRateLimit },
      empresas: empresas.map(identificarEmpresa),
      sessoes,
      eventos: eventos.map((evento) => ({
        ...evento,
        ipCorrelacao: evento.ipHash?.slice(0, 12) || null,
        ipHash: undefined,
      })),
      auditoria: auditoria.map((item) => ({
        ...item,
        usuario: item.usuarioId ? usuariosPorId.get(item.usuarioId) || null : null,
        empresa: item.empresaId
          ? empresasPorId.has(item.empresaId)
            ? identificarEmpresa(empresasPorId.get(item.empresaId)!)
            : null
          : null,
      })),
      exclusoes: exclusoes.map((exclusao) => ({
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

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdminAuth } from '@/lib/auth'
import { executarComAuditoria } from '@/lib/auditoria'
import { CONFIGURACAO_GLOBAL_ID } from '@/lib/antimalwarePolicy'
import { prisma } from '@/lib/prisma'
import { applyRateLimit, RATE_LIMITS } from '@/lib/rateLimit'
import { lerJsonLimitado, RequestBodyError } from '@/lib/requestBody'
import { processarFilaAntimalware } from '@/lib/antimalwareBacklog'

export const dynamic = 'force-dynamic'

const CONFIRMACAO_DESATIVACAO = 'DESATIVAR_VERIFICACAO_ANTIMALWARE'
const atualizacaoSchema = z.object({
  verificacaoAntimalwareObrigatoria: z.boolean(),
  confirmacao: z.string().max(64).optional(),
}).strict()

export async function GET(request: NextRequest) {
  const auth = await requireAdminAuth(request)
  if (auth.error || !auth.session) return NextResponse.json({ erro: auth.error }, { status: auth.status })

  const limited = await applyRateLimit(
    request,
    `admin-read:${auth.session.userId}:configuracoes-seguranca`,
    RATE_LIMITS.ADMIN_READ.limit,
    RATE_LIMITS.ADMIN_READ.windowMs,
  )
  if (limited) return limited

  const [configuracao, pendentes, incidentes] = await Promise.all([
    prisma.configuracaoSistema.findUnique({
      where: { id: CONFIGURACAO_GLOBAL_ID },
      select: { verificacaoAntimalwareObrigatoria: true, atualizadoEm: true },
    }),
    prisma.arquivoAntimalware.count({ where: { status: { in: ['PENDENTE', 'FALHA', 'EM_ANALISE'] } } }),
    prisma.arquivoAntimalware.findMany({ where: { status: 'BLOQUEADO' }, orderBy: { verificadoEm: 'desc' }, take: 20 }),
  ])
  const empresaIds = [...new Set(incidentes.map(item => item.empresaId))]
  const usuarioIds = [...new Set(incidentes.map(item => item.usuarioId).filter((id): id is string => Boolean(id)))]
  const [empresas, usuarios] = await Promise.all([
    prisma.empresa.findMany({ where: { id: { in: empresaIds } }, select: { id: true, nome: true } }),
    prisma.usuario.findMany({ where: { id: { in: usuarioIds } }, select: { id: true, nome: true, email: true } }),
  ])
  const empresasPorId = new Map(empresas.map(item => [item.id, item.nome]))
  const usuariosPorId = new Map(usuarios.map(item => [item.id, item]))

  return NextResponse.json({
    verificacaoAntimalwareObrigatoria: configuracao?.verificacaoAntimalwareObrigatoria ?? true,
    atualizadoEm: configuracao?.atualizadoEm ?? null,
    pendentes,
    incidentes: incidentes.map(item => ({
      id: item.id, nome: item.nome, origem: item.origem, detalhe: item.detalhe,
      verificadoEm: item.verificadoEm, empresa: empresasPorId.get(item.empresaId) ?? 'Empresa removida',
      usuario: item.usuarioId ? usuariosPorId.get(item.usuarioId) ?? null : null,
    })),
  }, { headers: { 'Cache-Control': 'private, no-store' } })
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdminAuth(request)
  if (auth.error || !auth.session) return NextResponse.json({ erro: auth.error }, { status: auth.status })

  const limited = await applyRateLimit(
    request,
    `admin-mutation:${auth.session.userId}:configuracoes-seguranca`,
    RATE_LIMITS.ADMIN_MUTATION.limit,
    RATE_LIMITS.ADMIN_MUTATION.windowMs,
  )
  if (limited) return limited

  try {
    const parsed = atualizacaoSchema.safeParse(await lerJsonLimitado(request))
    if (!parsed.success) return NextResponse.json({ erro: 'Configuracao de seguranca invalida.' }, { status: 400 })
    if (!parsed.data.verificacaoAntimalwareObrigatoria && parsed.data.confirmacao !== CONFIRMACAO_DESATIVACAO) {
      return NextResponse.json({ erro: 'Confirme explicitamente a liberacao temporaria de PDFs.' }, { status: 400 })
    }

    const configuracao = await executarComAuditoria(
      { usuarioId: auth.session.userId, origem: 'SUPERADMIN' },
      (tx) => tx.configuracaoSistema.upsert({
        where: { id: CONFIGURACAO_GLOBAL_ID },
        create: {
          id: CONFIGURACAO_GLOBAL_ID,
          verificacaoAntimalwareObrigatoria: parsed.data.verificacaoAntimalwareObrigatoria,
        },
        update: { verificacaoAntimalwareObrigatoria: parsed.data.verificacaoAntimalwareObrigatoria },
        select: { verificacaoAntimalwareObrigatoria: true, atualizadoEm: true },
      }),
    )

    const fila = configuracao.verificacaoAntimalwareObrigatoria
      ? await processarFilaAntimalware(5)
      : null
    return NextResponse.json({ sucesso: true, ...configuracao, fila }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    if (error instanceof RequestBodyError) return NextResponse.json({ erro: error.message }, { status: error.status })
    console.error('Falha ao atualizar a politica antimalware:', error)
    return NextResponse.json({ erro: 'Nao foi possivel atualizar a protecao de documentos.' }, { status: 500 })
  }
}

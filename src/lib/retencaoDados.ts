import 'server-only'

import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import {
  MESES_RETENCAO_AUDITORIA_SISTEMA,
  MESES_RETENCAO_SEGURANCA,
  MESES_RETENCAO_TOMBSTONE,
  subtrairAnosUtc,
  subtrairMesesUtc,
} from '@/lib/retencao'

async function autorizarLimpeza(tx: Prisma.TransactionClient) {
  await tx.$queryRaw`SELECT set_config('rpm.retention_cleanup', 'authorized', true)`
}

export interface ResultadoLimpezaRetencao {
  eventosRemovidos: number
  sessoesRemovidas: number
  auditoriasRemovidas: number
  comprovantesRemovidos: number
  empresasRemovidas: number
  falhasEmpresas: number
}

export async function executarLimpezaRetencao(agora = new Date()): Promise<ResultadoLimpezaRetencao> {
  const corteSeguranca = subtrairMesesUtc(agora, MESES_RETENCAO_SEGURANCA)
  const corteAuditoriaSistema = subtrairMesesUtc(agora, MESES_RETENCAO_AUDITORIA_SISTEMA)
  const corteTombstone = subtrairMesesUtc(agora, MESES_RETENCAO_TOMBSTONE)
  const corteEssencial = subtrairAnosUtc(agora, 1)
  const corteAvancado = subtrairAnosUtc(agora, 2)
  const corteEnterprise = subtrairAnosUtc(agora, 3)

  const gerais = await prisma.$transaction(async (tx) => {
    await autorizarLimpeza(tx)

    const eventos = await tx.eventoSeguranca.deleteMany({ where: { criadoEm: { lt: corteSeguranca } } })
    const sessoes = await tx.sessaoUsuario.deleteMany({
      where: {
        OR: [
          { expiraEm: { lt: corteSeguranca } },
          { revogadaEm: { not: null, lt: corteSeguranca } },
        ],
      },
    })
    const auditoriaSistema = await tx.$executeRaw`
        DELETE FROM public.auditoria_logs
        WHERE empresa_id IS NULL
          AND criado_em < ${corteAuditoriaSistema}
      `
    const auditoriaEmpresas = await tx.$executeRaw`
        DELETE FROM public.auditoria_logs AS auditoria
        USING public.empresas AS empresa
        WHERE auditoria.empresa_id = empresa.id
          AND empresa.excluido_em IS NULL
          AND (
            (empresa.plano = 'ESSENCIAL' AND auditoria.criado_em < ${corteEssencial})
            OR (empresa.plano = 'AVANCADO' AND auditoria.criado_em < ${corteAvancado})
            OR (empresa.plano IN ('ENTERPRISE', 'PREVIEW') AND auditoria.criado_em < ${corteEnterprise})
          )
      `
    const comprovantes = await tx.exclusaoEmpresaJob.deleteMany({
      where: { status: 'CONCLUIDO', reterAte: { not: null, lt: agora } },
    })

    return {
      eventosRemovidos: eventos.count,
      sessoesRemovidas: sessoes.count,
      auditoriasRemovidas: auditoriaSistema + auditoriaEmpresas,
      comprovantesRemovidos: comprovantes.count,
    }
  }, { timeout: 60_000 })

  const empresasExpiradas = await prisma.empresa.findMany({
    where: { excluidoEm: { not: null, lte: corteTombstone } },
    orderBy: { excluidoEm: 'asc' },
    take: 50,
    select: { id: true, usuarios: { select: { id: true } } },
  })

  let empresasRemovidas = 0
  let falhasEmpresas = 0
  for (const empresa of empresasExpiradas) {
    try {
      await prisma.$transaction(async (tx) => {
        await autorizarLimpeza(tx)
        const usuarioIds = empresa.usuarios.map((usuario) => usuario.id)
        await tx.eventoSeguranca.deleteMany({
          where: { OR: [{ empresaId: empresa.id }, { usuarioId: { in: usuarioIds } }] },
        })
        await tx.auditoriaLog.deleteMany({
          where: { OR: [{ empresaId: empresa.id }, { usuarioId: { in: usuarioIds } }] },
        })
        await tx.sessaoUsuario.deleteMany({ where: { empresaId: empresa.id } })
        await tx.usuario.deleteMany({ where: { empresaId: empresa.id } })
        await tx.empresa.delete({ where: { id: empresa.id } })
      }, { timeout: 30_000 })
      empresasRemovidas += 1
    } catch (error) {
      falhasEmpresas += 1
      console.error('Falha ao expirar tombstone de empresa:', error)
    }
  }

  return { ...gerais, empresasRemovidas, falhasEmpresas }
}

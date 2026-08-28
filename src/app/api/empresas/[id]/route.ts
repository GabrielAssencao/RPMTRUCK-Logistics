import { Prisma } from '@prisma/client'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdminAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { notificarAdmins, notificarUsuariosDaEmpresa } from '@/lib/notificacoes'
import { executarComAuditoria } from '@/lib/auditoria'
import { applyRateLimit, RATE_LIMITS } from '@/lib/rateLimit'
import {
  MODULOS,
  normalizarModulos,
  obterModulosPadrao,
  PLANOS,
  STATUS_EMPRESA,
} from '@/utils/planos'
import { sincronizarCobrancaEmpresa } from '@/lib/faturamentoAdmin'

const atualizarEmpresaSchema = z.object({
  plano: z.enum(PLANOS).optional(),
  status: z.enum(STATUS_EMPRESA).optional(),
  status_motivo: z.string().trim().max(500).nullable().optional(),
  modulos: z.array(z.enum(MODULOS)).max(MODULOS.length).optional(),
  usuarios_adicionais: z.coerce.number().int().min(0).max(10_000).optional(),
  veiculos_adicionais: z.coerce.number().int().min(0).max(100_000).optional(),
}).strict()

export async function PATCH(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const auth = await requireAdminAuth(request)
  if (auth.error || !auth.session) {
    return NextResponse.json({ erro: auth.error }, { status: auth.status })
  }
  const limited = await applyRateLimit(request, `admin-mutation:${auth.session.userId}`, RATE_LIMITS.ADMIN_MUTATION.limit, RATE_LIMITS.ADMIN_MUTATION.windowMs)
  if (limited) return limited

  const parsed = atualizarEmpresaSchema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json({ erro: 'Configuração de plano inválida.' }, { status: 400 })
  }

  try {
    const empresaAtual = await prisma.empresa.findUnique({ where: { id: params.id } })
    if (!empresaAtual) {
      return NextResponse.json({ erro: 'Empresa não encontrada.' }, { status: 404 })
    }

    const plano = parsed.data.plano ?? empresaAtual.plano
    const status = parsed.data.status ?? empresaAtual.status
    const mudouStatus = status !== empresaAtual.status
    const mudouMotivo = parsed.data.status_motivo !== undefined
      && parsed.data.status_motivo !== empresaAtual.status_motivo
    const mudouControleAcesso = mudouStatus || mudouMotivo
    const modulos = parsed.data.modulos
      ? normalizarModulos(parsed.data.modulos)
      : parsed.data.plano && parsed.data.plano !== empresaAtual.plano
        ? obterModulosPadrao(plano)
        : normalizarModulos(empresaAtual.modulos)
    const usuariosAdicionais = parsed.data.usuarios_adicionais ?? empresaAtual.usuarios_adicionais
    const veiculosAdicionais = parsed.data.veiculos_adicionais ?? empresaAtual.veiculos_adicionais

    const resultado = await executarComAuditoria({ usuarioId: auth.session!.userId, origem: 'SUPERADMIN' }, async (tx) => {
      const empresa = await tx.empresa.update({
        where: { id: params.id },
        data: {
          plano,
          status,
          modulos,
          usuarios_adicionais: usuariosAdicionais,
          veiculos_adicionais: veiculosAdicionais,
          status_motivo: status === 'ATIVO' ? null : parsed.data.status_motivo,
          status_alterado_em: mudouControleAcesso ? new Date() : empresaAtual.status_alterado_em,
          status_alterado_por_id: mudouControleAcesso ? auth.session!.userId : empresaAtual.status_alterado_por_id,
        },
      })
      const cobranca = await sincronizarCobrancaEmpresa(tx, {
        empresaId: empresa.id,
        planoAnterior: empresaAtual.plano,
        plano,
        usuariosAdicionais,
        veiculosAdicionais,
      })
      const faturas = await tx.fatura.findMany({ where: { empresaId: empresa.id }, orderBy: [{ ano: 'desc' }, { criado_em: 'desc' }] })
      return { empresa, cobranca, faturas }
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
    const { empresa } = resultado

    const alteracoes = [
      plano !== empresaAtual.plano ? `plano ${empresaAtual.plano} → ${plano}` : null,
      status !== empresaAtual.status ? `status ${empresaAtual.status} → ${status}` : null,
      JSON.stringify(modulos) !== JSON.stringify(normalizarModulos(empresaAtual.modulos)) ? 'módulos atualizados' : null,
    ].filter(Boolean).join(', ')

    if (alteracoes) {
      const resultados = await Promise.allSettled([
        notificarAdmins({ titulo: 'Regras da empresa atualizadas', mensagem: `${empresa.nome}: ${alteracoes}.`, modulo: 'EMPRESAS' }),
        notificarUsuariosDaEmpresa(empresa.id, { titulo: 'Configuração de acesso atualizada', mensagem: `O SuperAdmin alterou: ${alteracoes}.`, modulo: 'GERAL' }),
      ])
      resultados.forEach(resultado => {
        if (resultado.status === 'rejected') console.error('Falha ao registrar notificação de alteração da empresa:', resultado.reason)
      })
    }

    return NextResponse.json({
      sucesso: true,
      empresa,
      mensalidade: resultado.cobranca.mensalidade,
      taxaImplantacao: resultado.cobranca.taxaImplantacao,
      faturas: resultado.faturas,
    })
  } catch (error) {
    console.error('Erro ao atualizar plano da empresa:', error)
    return NextResponse.json({ erro: 'Erro interno ao salvar a configuração.' }, { status: 500 })
  }
}

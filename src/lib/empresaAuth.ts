import { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  normalizarModulos,
  PLANOS_CONFIG,
  type ModuloCodigo,
  type PlanoTipo,
} from '@/utils/planos'

interface EmpresaAuthOptions {
  modulo?: ModuloCodigo
  acao?: 'LEITURA' | 'ESCRITA' | 'GESTAO'
}

/**
 * Autoriza operações empresariais usando o estado atual do banco.
 * Plano, módulos e inadimplência nunca são confiados ao localStorage ou ao JWT.
 */
export async function requireEmpresaAuth(request: NextRequest, options: EmpresaAuthOptions = {}) {
  const auth = await requireAuth(request)

  if (auth.error || !auth.session) {
    return { error: auth.error, status: auth.status, session: null, empresa: null }
  }

  if (options.acao === 'ESCRITA' && auth.session.role === 'VISUALIZADOR') {
    return {
      error: 'Seu perfil possui acesso somente para visualização.',
      status: 403,
      session: null,
      empresa: null,
    }
  }

  if (
    options.acao === 'GESTAO' &&
    auth.session.role !== 'GESTOR_EMPRESA' &&
    auth.session.role !== 'GESTOR'
  ) {
    return {
      error: 'Esta ação está disponível somente para o gestor.',
      status: 403,
      session: null,
      empresa: null,
    }
  }

  if (!auth.session.empresaId) {
    return {
      error: 'Acesso negado: usuário sem empresa vinculada',
      status: 403,
      session: null,
      empresa: null,
    }
  }

  const empresa = await prisma.empresa.findUnique({
    where: { id: auth.session.empresaId },
    select: {
      id: true,
      nome: true,
      cnpj: true,
      email: true,
      telefone: true,
      nome_contato: true,
      plano: true,
      status: true,
      status_motivo: true,
      modulos: true,
      usuarios_adicionais: true,
      veiculos_adicionais: true,
    },
  })

  if (!empresa) {
    return { error: 'Empresa não encontrada', status: 404, session: null, empresa: null }
  }

  if (empresa.status !== 'ATIVO') {
    return {
      error: empresa.status === 'INADIMPLENTE'
        ? 'Acesso suspenso por inadimplência. Procure o suporte para regularizar o plano.'
        : 'O acesso desta empresa está inativo.',
      status: 403,
      session: null,
      empresa: null,
    }
  }

  const modulos = normalizarModulos(empresa.modulos)
  if (options.modulo && !modulos.includes(options.modulo)) {
    return {
      error: 'Este módulo não está habilitado para a empresa.',
      status: 403,
      session: null,
      empresa: null,
    }
  }

  const plano = empresa.plano as PlanoTipo

  return {
    error: null,
    status: 200,
    session: auth.session,
    empresaId: empresa.id,
    empresa: {
      ...empresa,
      plano,
      modulos,
      permissoes: PLANOS_CONFIG[plano],
    },
  }
}

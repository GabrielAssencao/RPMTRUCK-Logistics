import type { PlanoTipo, Prisma } from '@prisma/client'
import type { PlanoComercialSerializado } from '@/lib/financeiro/planosComerciais'
import { calcularMensalidadePorCatalogo } from '@/lib/financeiro/planosComerciais'
import { normalizarModulos, PLANOS_CONFIG } from '@/utils/planos'

const ORDEM_PLANOS: Record<PlanoTipo, number> = {
  PREVIEW: 0,
  ESSENCIAL: 1,
  AVANCADO: 2,
  ENTERPRISE: 3,
}

interface EstadoEmpresaAssinatura {
  plano: PlanoTipo
  modulos: readonly string[]
  usuariosAdicionais: number
  veiculosAdicionais: number
  totalUsuarios: number
  totalVeiculos: number
}

interface DestinoAssinatura {
  plano: PlanoTipo
  usuariosAdicionais: number
  veiculosAdicionais: number
}

export function calcularPropostaAssinatura(
  empresa: EstadoEmpresaAssinatura,
  destino: DestinoAssinatura,
  catalogoAtual: PlanoComercialSerializado,
  catalogoDestino: PlanoComercialSerializado,
) {
  const mensalidadeAtual = calcularMensalidadePorCatalogo(
    catalogoAtual,
    empresa.usuariosAdicionais,
    empresa.veiculosAdicionais,
  )
  const mensalidadeProposta = calcularMensalidadePorCatalogo(
    catalogoDestino,
    destino.usuariosAdicionais,
    destino.veiculosAdicionais,
  )

  const modulosAtuais = normalizarModulos(empresa.modulos)
  const modulosDestino = [...PLANOS_CONFIG[destino.plano].modulosPadrao]
  const modulosPerdidos = modulosAtuais.filter((modulo) => !modulosDestino.includes(modulo))
  const limiteUsuarios = catalogoDestino.usuariosBase + destino.usuariosAdicionais
  const limiteVeiculos = catalogoDestino.veiculosBase + destino.veiculosAdicionais
  const excessoUsuarios = Math.max(0, empresa.totalUsuarios - limiteUsuarios)
  const excessoVeiculos = Math.max(0, empresa.totalVeiculos - limiteVeiculos)
  const perdas: string[] = []
  const bloqueios: string[] = []

  if (catalogoDestino.historicoAnos < catalogoAtual.historicoAnos) {
    perdas.push(`Histórico online reduzido de ${catalogoAtual.historicoAnos} para ${catalogoDestino.historicoAnos} ano(s).`)
  }
  if (modulosPerdidos.length > 0) {
    perdas.push(`Módulos removidos: ${modulosPerdidos.join(', ')}.`)
  }
  if (excessoUsuarios > 0) {
    bloqueios.push(`Remova ${excessoUsuarios} usuário(s) ou contrate cotas suficientes antes da aprovação.`)
  }
  if (excessoVeiculos > 0) {
    bloqueios.push(`Remova ${excessoVeiculos} veículo(s) ou contrate cotas suficientes antes da aprovação.`)
  }

  const impacto: Prisma.JsonObject = {
    mudanca: ORDEM_PLANOS[destino.plano] > ORDEM_PLANOS[empresa.plano]
      ? 'UPGRADE'
      : ORDEM_PLANOS[destino.plano] < ORDEM_PLANOS[empresa.plano]
        ? 'DOWNGRADE'
        : 'COTAS',
    perdas,
    bloqueios,
    modulosPerdidos,
    limites: {
      usuarios: limiteUsuarios,
      veiculos: limiteVeiculos,
      historicoAnos: catalogoDestino.historicoAnos,
    },
  }

  return {
    mensalidadeAtual,
    mensalidadeProposta,
    impacto,
    bloqueios,
  }
}

export function valoresIguaisEmCentavos(valorA: number, valorB: number) {
  return Math.round(valorA * 100) === Math.round(valorB * 100)
}

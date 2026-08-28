import type { PlanoTipo, Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { PLANOS_CONFIG } from '@/utils/planos'

type ClienteCatalogo = typeof prisma | Prisma.TransactionClient

export interface PlanoComercialSerializado {
  id: PlanoTipo
  nome: string
  descricao: string
  beneficios: readonly string[]
  precoBase: number
  taxaImplantacao: number
  precoUsuarioAdicional: number
  precoVeiculoAdicional: number
  usuariosBase: number
  veiculosBase: number
  historicoAnos: number
  modulos: readonly string[]
  ativo: boolean
  visivelLanding: boolean
  versao: number
  restrito: boolean
  destaque: boolean
}

export function arredondarMoeda(valor: number) {
  return Math.round((valor + Number.EPSILON) * 100) / 100
}

export function calcularMensalidadePorCatalogo(
  plano: Pick<PlanoComercialSerializado, 'precoBase' | 'precoUsuarioAdicional' | 'precoVeiculoAdicional'>,
  usuariosAdicionais: number,
  veiculosAdicionais: number,
) {
  if (
    !Number.isInteger(usuariosAdicionais)
    || !Number.isInteger(veiculosAdicionais)
    || usuariosAdicionais < 0
    || usuariosAdicionais > 10_000
    || veiculosAdicionais < 0
    || veiculosAdicionais > 100_000
  ) {
    throw new Error('As cotas adicionais estão fora dos limites permitidos.')
  }

  const mensalidade = arredondarMoeda(
    plano.precoBase
      + usuariosAdicionais * plano.precoUsuarioAdicional
      + veiculosAdicionais * plano.precoVeiculoAdicional,
  )
  if (!Number.isFinite(mensalidade) || mensalidade > 9_999_999_999.99) {
    throw new Error('A mensalidade calculada excede o limite monetário permitido.')
  }
  return mensalidade
}

function serializarPlano(row: {
  plano: PlanoTipo
  precoBase: Prisma.Decimal
  taxaImplantacao: Prisma.Decimal
  precoUsuarioAdicional: Prisma.Decimal
  precoVeiculoAdicional: Prisma.Decimal
  ativo: boolean
  visivelLanding: boolean
  versao: number
}): PlanoComercialSerializado {
  const tecnico = PLANOS_CONFIG[row.plano]
  return {
    id: row.plano,
    nome: tecnico.nome,
    descricao: tecnico.descricao,
    beneficios: tecnico.beneficios,
    precoBase: Number(row.precoBase),
    taxaImplantacao: Number(row.taxaImplantacao),
    precoUsuarioAdicional: Number(row.precoUsuarioAdicional),
    precoVeiculoAdicional: Number(row.precoVeiculoAdicional),
    usuariosBase: tecnico.usuariosBase,
    veiculosBase: tecnico.veiculosBase,
    historicoAnos: tecnico.historicoAnos,
    modulos: tecnico.modulosPadrao,
    ativo: row.ativo,
    visivelLanding: row.visivelLanding,
    versao: row.versao,
    restrito: row.plano === 'PREVIEW',
    destaque: row.plano === 'AVANCADO',
  }
}

export async function listarPlanosComerciais(
  opcoes: { somentePublicos?: boolean } = {},
  cliente: ClienteCatalogo = prisma,
) {
  const rows = await cliente.planoComercial.findMany({
    where: opcoes.somentePublicos ? { ativo: true, visivelLanding: true } : undefined,
    orderBy: { precoBase: 'asc' },
  })
  return rows.map(serializarPlano)
}

export async function obterPlanoComercial(plano: PlanoTipo, cliente: ClienteCatalogo = prisma) {
  const row = await cliente.planoComercial.findUnique({ where: { plano } })
  return row ? serializarPlano(row) : null
}

export async function calcularMensalidadePersistida(
  plano: PlanoTipo,
  usuariosAdicionais: number,
  veiculosAdicionais: number,
  cliente: ClienteCatalogo = prisma,
) {
  const catalogo = await obterPlanoComercial(plano, cliente)
  if (!catalogo) throw new Error(`Plano comercial ${plano} não está configurado.`)
  return calcularMensalidadePorCatalogo(catalogo, usuariosAdicionais, veiculosAdicionais)
}

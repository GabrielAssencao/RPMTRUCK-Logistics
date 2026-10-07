import type { PlanoTipo, Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { PLANOS_CONFIG } from '@/utils/planos'
import { competenciaBrasil, limiteVencimentoMensal } from '@/lib/financeiro/situacaoFinanceira'

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
  ticketsSuporteMes: number
  prazoRespostaSuporteHoras: number
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
    ticketsSuporteMes: tecnico.ticketsSuporteMes,
    prazoRespostaSuporteHoras: tecnico.prazoRespostaSuporteHoras,
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

export function precoBaseVigenteEmpresa(
  empresa: { precoBasePromocional: Prisma.Decimal | null; precoBaseRenovacao: Prisma.Decimal | null; promocaoMesesIniciais: number | null; promocaoAtivadaEm: Date | null },
  precoBaseCatalogo: number,
  agora = new Date(),
) {
  if (empresa.precoBasePromocional === null || !empresa.promocaoAtivadaEm || !empresa.promocaoMesesIniciais) return precoBaseCatalogo
  if (agora < empresa.promocaoAtivadaEm) return precoBaseCatalogo
  // Cada fatura mensal representa uma competência; o mês da adesão é o primeiro mês promocional.
  const inicio = competenciaBrasil(empresa.promocaoAtivadaEm)
  const atual = competenciaBrasil(agora)
  const mesesDecorridos = (atual.ano - inicio.ano) * 12 + atual.mes - inicio.mes
  if (mesesDecorridos < empresa.promocaoMesesIniciais) return Number(empresa.precoBasePromocional)
  return Number(empresa.precoBaseRenovacao ?? precoBaseCatalogo)
}

export function calcularMensalidadeEmpresa(
  empresa: { precoBasePromocional: Prisma.Decimal | null; precoBaseRenovacao: Prisma.Decimal | null; promocaoMesesIniciais: number | null; promocaoAtivadaEm: Date | null; usuarios_adicionais: number; veiculos_adicionais: number },
  catalogo: PlanoComercialSerializado,
  agora = new Date(),
) {
  return calcularMensalidadePorCatalogo({ ...catalogo, precoBase: precoBaseVigenteEmpresa(empresa, catalogo.precoBase, agora) }, empresa.usuarios_adicionais, empresa.veiculos_adicionais)
}

export function obterTransicaoPromocionalEmpresa(
  empresa: {
    precoBasePromocional: Prisma.Decimal | null
    precoBaseRenovacao: Prisma.Decimal | null
    promocaoMesesIniciais: number | null
    promocaoAtivadaEm: Date | null
    usuarios_adicionais: number
    veiculos_adicionais: number
    diaVencimento: number
  },
  catalogo: PlanoComercialSerializado,
) {
  if (
    empresa.precoBasePromocional === null
    || empresa.precoBaseRenovacao === null
    || !empresa.promocaoAtivadaEm
    || !empresa.promocaoMesesIniciais
  ) return null

  const inicio = competenciaBrasil(empresa.promocaoAtivadaEm)
  const indiceRenovacao = inicio.ano * 12 + inicio.mes - 1 + empresa.promocaoMesesIniciais
  const ano = Math.floor(indiceRenovacao / 12)
  const mes = indiceRenovacao % 12 + 1
  const renovacaoEm = limiteVencimentoMensal(ano, mes, empresa.diaVencimento)
  const valorRenovacao = calcularMensalidadeEmpresa(empresa, catalogo, renovacaoEm)
  const valorPromocional = calcularMensalidadeEmpresa(empresa, catalogo, empresa.promocaoAtivadaEm)

  return Math.round(valorPromocional * 100) === Math.round(valorRenovacao * 100)
    ? null
    : { renovacaoEm, valorRenovacao }
}

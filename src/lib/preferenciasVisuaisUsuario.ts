import type { PrismaClient, Usuario } from '@prisma/client'
import { COR_TEMA_PADRAO, normalizarCorTema } from '@/data/temasELogos'
import { estiloFundoEmpresaValido, type EstiloFundoEmpresa } from '@/lib/empresaPreferences'

type PreferenciasRegistradas = Pick<Usuario, 'corTema' | 'temaClaro' | 'rotuloEquipe' | 'podePersonalizarTema' | 'estiloFundo'>

export interface PreferenciasVisuaisEfetivas {
  corTema: string
  temaClaro: boolean
  rotuloEquipe: string | null
  podePersonalizarTema: boolean
  estiloFundo: EstiloFundoEmpresa
  herdadoDoGestor: boolean
}

export async function obterPreferenciasVisuaisEfetivas(
  prisma: Pick<PrismaClient, 'usuario'>,
  usuario: PreferenciasRegistradas,
  empresaId: string,
): Promise<PreferenciasVisuaisEfetivas> {
  let corTema = usuario.corTema
  let temaClaro = usuario.temaClaro
  let estiloFundo = usuario.estiloFundo
  let herdadoDoGestor = false

  if (corTema === null || temaClaro === null || estiloFundo === null) {
    const gestor = await prisma.usuario.findFirst({
      where: {
        empresaId,
        role: 'GESTOR_EMPRESA',
        ativo: true,
        excluidoEm: null,
      },
      select: { corTema: true, temaClaro: true, estiloFundo: true },
      orderBy: { criado_em: 'asc' },
    })
    corTema ??= gestor?.corTema ?? COR_TEMA_PADRAO
    temaClaro ??= gestor?.temaClaro ?? false
    estiloFundo ??= gestor?.estiloFundo ?? 'DESLIGADO'
    herdadoDoGestor = true
  }

  return {
    corTema: normalizarCorTema(corTema),
    temaClaro: temaClaro ?? false,
    rotuloEquipe: usuario.rotuloEquipe,
    podePersonalizarTema: usuario.podePersonalizarTema,
    estiloFundo: estiloFundoEmpresaValido(estiloFundo) ? estiloFundo : 'DESLIGADO',
    herdadoDoGestor,
  }
}

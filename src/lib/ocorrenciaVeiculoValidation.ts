import { z } from 'zod'
import { textoOperacional } from '@/lib/domainValidation'

const dataSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

export const criarOcorrenciaVeiculoSchema = z.object({
  tipo: z.enum(['MULTA', 'COLISAO', 'AVARIA', 'OUTRA']),
  titulo: textoOperacional(3, 140),
  descricao: textoOperacional(1, 2000).nullable().optional(),
  data: dataSchema,
  local: textoOperacional(2, 180).nullable().optional(),
  valor: z.coerce.number().min(0).max(999_999_999.99).nullable().optional(),
  pontosCnh: z.coerce.number().int().min(0).max(20).nullable().optional(),
  veiculoId: z.string().uuid(),
  motoristaId: z.string().uuid().nullable().optional(),
  contaPagarId: z.string().uuid().nullable().optional(),
}).strict()

export const atualizarOcorrenciaVeiculoSchema = z.object({
  status: z.enum(['ABERTA', 'EM_ANALISE', 'RESOLVIDA']).optional(),
  titulo: textoOperacional(3, 140).optional(),
  descricao: textoOperacional(1, 2000).nullable().optional(),
  local: textoOperacional(2, 180).nullable().optional(),
  motoristaId: z.string().uuid().nullable().optional(),
}).strict().refine((dados) => Object.keys(dados).length > 0, 'Informe uma alteração.')

export function dataOperacional(valor: string) {
  const data = new Date(`${valor}T00:00:00.000Z`)
  if (Number.isNaN(data.getTime()) || data.toISOString().slice(0, 10) !== valor) throw new Error('DATA_INVALIDA')
  return data
}

import { z } from 'zod'
import { textoOperacional } from '@/lib/domainValidation'

const dataOpcional = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional()

const conformidadeMotoristaBaseSchema = z.object({
  tipo: z.enum(['CURSO', 'EXAME_TOXICOLOGICO']),
  nome: textoOperacional(3, 140),
  numero: z.string().trim().max(80).nullable().optional(),
  emitidoEm: dataOpcional,
  validade: dataOpcional,
  obrigatorio: z.boolean().default(true),
  cargaAplicavel: z.string().trim().max(140).nullable().optional(),
  veiculoAplicavel: z.string().trim().max(140).nullable().optional(),
  observacoes: z.string().trim().max(1000).nullable().optional(),
}).strict()

const validarPeriodo = (dados: { emitidoEm?: string | null; validade?: string | null }, contexto: z.RefinementCtx) => {
  if (dados.emitidoEm && dados.validade && dados.validade < dados.emitidoEm) {
    contexto.addIssue({ code: z.ZodIssueCode.custom, path: ['validade'], message: 'A validade não pode ser anterior à emissão.' })
  }
}

export const conformidadeMotoristaSchema = conformidadeMotoristaBaseSchema.superRefine(validarPeriodo)

export const atualizarConformidadeMotoristaSchema = conformidadeMotoristaBaseSchema.partial()
  .refine((dados) => Object.keys(dados).length > 0, 'Informe uma alteração.')

export function dataSomenteDia(valor: string | null | undefined) {
  if (!valor) return null
  const data = new Date(`${valor}T00:00:00.000Z`)
  if (Number.isNaN(data.getTime()) || data.toISOString().slice(0, 10) !== valor) throw new Error('DATA_INVALIDA')
  return data
}

export function situacaoConformidade(validade: Date | null, agora = new Date()) {
  if (!validade) return 'SEM_VALIDADE'
  const hoje = Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), agora.getUTCDate())
  const limite = hoje + 30 * 24 * 60 * 60 * 1000
  if (validade.getTime() < hoje) return 'VENCIDO'
  if (validade.getTime() <= limite) return 'VENCE_EM_30_DIAS'
  return 'VALIDO'
}

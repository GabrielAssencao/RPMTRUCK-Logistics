import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { dataIsoSchema, nomeOperacional, textoOperacional, valorMonetarioSchema } from '@/lib/domainValidation'

export const categoriasDespesa = [
  'INFRAESTRUTURA', 'DOMINIO_EMAIL', 'SOFTWARE_IA', 'MARKETING',
  'LEGAL_CONTABIL', 'GATEWAY_OUTROS', 'OUTROS',
] as const

export const despesaSchema = z.object({
  descricao: nomeOperacional(3, 160),
  categoria: z.enum(categoriasDespesa),
  valor: valorMonetarioSchema.positive().max(10_000_000).multipleOf(0.01),
  dataPagamento: dataIsoSchema.refine(value => value <= new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()), 'Registre apenas despesas já pagas.'),
  observacao: textoOperacional(1, 500).optional(),
}).strict()

export function dadosDespesa(valor: z.infer<typeof despesaSchema>) {
  return {
    descricao: valor.descricao,
    categoria: valor.categoria,
    valor: new Prisma.Decimal(valor.valor.toFixed(2)),
    dataPagamento: new Date(`${valor.dataPagamento}T00:00:00.000Z`),
    observacao: valor.observacao || null,
  }
}

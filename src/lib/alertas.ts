import { z } from 'zod'
import type { Prisma } from '@prisma/client'
import { textoOperacional } from '@/lib/domainValidation'

const dataHoraSchema = z.string().datetime({ offset: true }).transform((valor) => new Date(valor))

export const alertaSistemaSchema = z.object({
  titulo: textoOperacional(3, 120),
  mensagem: textoOperacional(3, 2000),
  severidade: z.enum(['INFORMACAO', 'AVISO', 'CRITICO']),
  ativo: z.boolean().default(true),
  inicioEm: dataHoraSchema,
  fimEm: dataHoraSchema.nullable(),
  destinatarioId: z.string().uuid().nullable(),
}).strict().superRefine((dados, contexto) => {
  if (dados.fimEm && dados.fimEm <= dados.inicioEm) {
    contexto.addIssue({ code: z.ZodIssueCode.custom, path: ['fimEm'], message: 'O término deve ocorrer depois do início.' })
  }
})

export function escopoAlertaVisivel(usuarioId: string, agora = new Date()): Prisma.AlertaSistemaWhereInput {
  return {
    ativo: true,
    inicio_em: { lte: agora },
    OR: [{ fim_em: null }, { fim_em: { gt: agora } }],
    AND: [{ OR: [{ destinatarioId: null }, { destinatarioId: usuarioId }] }],
  }
}

import 'server-only'
import { prisma } from '@/lib/prisma'

export async function limparLembretesConcluidos(scope?: { empresaId: string | null; usuarioId: string }, agora = new Date()) {
  const resultado = await prisma.lembretePessoal.deleteMany({
    where: {
      ...scope,
      concluido: true,
      OR: [1, 7, 30, 90].map((dias) => ({
        usuario: { lembretesRetencaoDias: dias },
        concluidoEm: { lte: new Date(agora.getTime() - dias * 86_400_000) },
      })),
    },
  })
  return resultado.count
}

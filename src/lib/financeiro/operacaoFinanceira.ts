import 'server-only'
import { randomUUID } from 'node:crypto'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

export class OperacaoFinanceiraError extends Error {
  constructor(message: string, readonly status = 409, readonly resultadoIncerto = false) { super(message) }
}

/** Durable mutual exclusion across all application instances. Never steal a stale
 * lock: a timed-out gateway request may still have created a real payment. */
export async function comOperacaoFinanceira<T>(empresaId: string, tipo: string, executar: () => Promise<T>): Promise<T> {
  const token = randomUUID()
  try {
    await prisma.operacaoFinanceira.create({ data: { empresaId, tipo, token } })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new OperacaoFinanceiraError('Há uma operação financeira em andamento ou aguardando conciliação. Aguarde ou contate o suporte.')
    }
    throw error
  }
  let liberar = false
  try {
    const empresa = await prisma.empresa.findFirst({ where: { id: empresaId, excluidoEm: null }, select: { id: true } })
    if (!empresa) throw new OperacaoFinanceiraError('Empresa não encontrada.', 404)
    const result = await executar()
    liberar = true
    return result
  } catch (error) {
    // Only explicit, definite failures are safe to retry. Unknown failures require
    // reconciliation, including a crash after the provider accepted a request.
    liberar = error instanceof OperacaoFinanceiraError && !error.resultadoIncerto
    throw error
  } finally {
    if (liberar) await prisma.operacaoFinanceira.deleteMany({ where: { empresaId, token } })
  }
}

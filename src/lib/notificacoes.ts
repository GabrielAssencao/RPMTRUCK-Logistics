import type { Prisma } from '@prisma/client'
import type { SessionPayload } from '@/lib/auth'
import { isAdminRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

interface CriarNotificacaoInput {
  titulo: string
  mensagem: string
  modulo: string
  empresaId?: string | null
  usuarioId?: string | null
  veiculoId?: string | null
  tarefaId?: string | null
  ticketSuporteId?: string | null
}

export function escopoNotificacoes(session: SessionPayload): Prisma.NotificacaoWhereInput {
  if (isAdminRole(session.role)) return { usuarioId: session.userId }

  return {
    empresaId: session.empresaId,
    OR: [{ usuarioId: null }, { usuarioId: session.userId }],
  }
}

export async function criarNotificacao(input: CriarNotificacaoInput) {
  if (!input.empresaId && !input.usuarioId) {
    throw new Error('Uma notificação precisa ter empresa ou usuário destinatário.')
  }

  return prisma.notificacao.create({
    data: {
      titulo: input.titulo,
      mensagem: input.mensagem,
      modulo: input.modulo,
      empresaId: input.empresaId ?? null,
      usuarioId: input.usuarioId ?? null,
      veiculoId: input.veiculoId ?? null,
      tarefaId: input.tarefaId ?? null,
      ticketSuporteId: input.ticketSuporteId ?? null,
    },
  })
}

export async function notificarUsuariosDaEmpresa(
  empresaId: string,
  input: Omit<CriarNotificacaoInput, 'empresaId' | 'usuarioId'>,
  roles?: Array<'GESTOR_EMPRESA' | 'OPERADOR' | 'VISUALIZADOR'>,
  database: Prisma.TransactionClient | typeof prisma = prisma,
) {
  const usuarios = await database.usuario.findMany({
    where: { empresaId, ...(roles?.length ? { role: { in: roles } } : {}) },
    select: { id: true },
  })
  if (usuarios.length === 0) return { count: 0 }

  return database.notificacao.createMany({
    data: usuarios.map(({ id }) => ({
      titulo: input.titulo,
      mensagem: input.mensagem,
      modulo: input.modulo,
      empresaId,
      usuarioId: id,
      veiculoId: input.veiculoId ?? null,
      tarefaId: input.tarefaId ?? null,
      ticketSuporteId: input.ticketSuporteId ?? null,
    })),
  })
}

export async function notificarAdmins(
  input: Omit<CriarNotificacaoInput, 'empresaId' | 'usuarioId'>,
  database: Prisma.TransactionClient | typeof prisma = prisma,
) {
  const admins = await database.usuario.findMany({
    where: { role: 'ADMIN_RPM', empresaId: null },
    select: { id: true },
  })
  if (admins.length === 0) return { count: 0 }

  return database.notificacao.createMany({
    data: admins.map(({ id }) => ({
      titulo: input.titulo,
      mensagem: input.mensagem,
      modulo: input.modulo,
      usuarioId: id,
      veiculoId: input.veiculoId ?? null,
      tarefaId: input.tarefaId ?? null,
      ticketSuporteId: input.ticketSuporteId ?? null,
    })),
  })
}

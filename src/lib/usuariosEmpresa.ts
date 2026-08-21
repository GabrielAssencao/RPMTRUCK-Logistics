import { Prisma, type Role } from '@prisma/client'
import { PLANOS_CONFIG } from '@/utils/planos'
import { executarComAuditoria } from '@/lib/auditoria'

export class EmpresaNaoEncontradaError extends Error {}
export class LimiteUsuariosError extends Error {
  constructor(public readonly limite: number) {
    super(`Limite de ${limite} usuários atingido.`)
  }
}

interface CriarUsuarioEmpresaInput {
  empresaId: string
  nome: string
  email: string
  senhaHash: string
  role: Role
  acessoDashboardGeral?: boolean
  criadoPorId: string
}

/**
 * A contagem e a criação compartilham uma transação serializável.
 * Assim, duas requisições concorrentes não conseguem ultrapassar o plano.
 */
export async function criarUsuarioEmpresaComLimite(input: CriarUsuarioEmpresaInput) {
  return executarComAuditoria({ usuarioId: input.criadoPorId }, async (tx) => {
    const empresa = await tx.empresa.findUnique({
      where: { id: input.empresaId },
      select: {
        plano: true,
        usuarios_adicionais: true,
        _count: { select: { usuarios: true } },
      },
    })
    if (!empresa) throw new EmpresaNaoEncontradaError('Empresa não encontrada.')

    const limite = PLANOS_CONFIG[empresa.plano].usuariosBase + empresa.usuarios_adicionais
    if (empresa._count.usuarios >= limite) throw new LimiteUsuariosError(limite)

    return tx.usuario.create({
      data: {
        nome: input.nome,
        email: input.email,
        senha_hash: input.senhaHash,
        role: input.role,
        acessoDashboardGeral: input.acessoDashboardGeral ?? false,
        empresaId: input.empresaId,
      },
      select: {
        id: true,
        nome: true,
        email: true,
        role: true,
        acessoDashboardGeral: true,
        criado_em: true,
      },
    })
  }, {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  })
}

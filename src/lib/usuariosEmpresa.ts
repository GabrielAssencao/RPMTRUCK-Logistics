import { Prisma, type Role } from '@prisma/client'
import { normalizarModulos, PLANOS_CONFIG, type ModuloCodigo } from '@/utils/planos'
import { executarComAuditoria } from '@/lib/auditoria'

export class EmpresaNaoEncontradaError extends Error {}
export class LimiteUsuariosError extends Error {
  constructor(public readonly limite: number) {
    super(`Limite de ${limite} usuários atingido.`)
  }
}
export class ModulosUsuarioInvalidosError extends Error {}

interface CriarUsuarioEmpresaInput {
  empresaId: string
  nome: string
  email: string
  senhaHash: string
  role: Role
  acessoDashboardGeral?: boolean
  modulosAcesso?: readonly ModuloCodigo[]
  senhaTemporariaExpiraEm?: Date
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
        modulos: true,
        usuarios_adicionais: true,
      },
    })
    if (!empresa) throw new EmpresaNaoEncontradaError('Empresa não encontrada.')

    const totalUsuarios = await tx.usuario.count({
      where: { empresaId: input.empresaId, excluidoEm: null },
    })
    const limite = PLANOS_CONFIG[empresa.plano].usuariosBase + empresa.usuarios_adicionais
    if (totalUsuarios >= limite) throw new LimiteUsuariosError(limite)

    const modulosEmpresa = normalizarModulos(empresa.modulos)
    const solicitados = input.modulosAcesso
      ? normalizarModulos(input.modulosAcesso)
      : modulosEmpresa
    if (solicitados.some((modulo) => !modulosEmpresa.includes(modulo))) {
      throw new ModulosUsuarioInvalidosError('Um ou mais módulos não pertencem ao plano da empresa.')
    }
    const modulosAcesso = modulosEmpresa.filter((modulo) =>
      modulo === 'NOTIFICACOES' || solicitados.includes(modulo),
    )

    return tx.usuario.create({
      data: {
        nome: input.nome,
        email: input.email,
        senha_hash: input.senhaHash,
        role: input.role,
        acessoDashboardGeral: input.acessoDashboardGeral ?? false,
        modulosAcesso,
        exigeTrocaSenha: Boolean(input.senhaTemporariaExpiraEm),
        senhaTemporariaExpiraEm: input.senhaTemporariaExpiraEm,
        empresaId: input.empresaId,
      },
      select: {
        id: true,
        nome: true,
        email: true,
        role: true,
        acessoDashboardGeral: true,
        ativo: true,
        modulosAcesso: true,
        criado_em: true,
      },
    })
  }, {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  })
}

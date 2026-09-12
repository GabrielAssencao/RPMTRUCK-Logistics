import { Prisma } from '@prisma/client'
import { executarComAuditoria } from '@/lib/auditoria'
import { PLANOS_CONFIG } from '@/utils/planos'

export class CadastroVeiculoError extends Error {
  constructor(message: string, public readonly status: number) { super(message) }
}

interface CadastroVeiculo {
  empresaId: string
  usuarioId: string
  origem?: 'API' | 'SUPERADMIN'
  dados: {
    modelo: string
    placa: string
    tipo: string
    ano?: number | null
    quilometragem?: number
    status?: string
    localizacaoId?: string | null
  }
}

// Todos os caminhos de cadastro consomem a mesma cota, com leitura e criação
// serializáveis. Um conflito aborta a operação; nunca há criação acima da cota.
export function criarVeiculoEmpresaComLimite(input: CadastroVeiculo) {
  return executarComAuditoria({ usuarioId: input.usuarioId, origem: input.origem }, async tx => {
    const empresa = await tx.empresa.findUnique({
      where: { id: input.empresaId }, select: { plano: true, veiculos_adicionais: true },
    })
    if (!empresa) throw new CadastroVeiculoError('Empresa não encontrada.', 404)
    const limite = PLANOS_CONFIG[empresa.plano].veiculosBase + empresa.veiculos_adicionais
    const total = await tx.veiculo.count({ where: { empresaId: input.empresaId } })
    if (total >= limite) throw new CadastroVeiculoError(`Limite de ${limite} veículos atingido.`, 409)
    if (input.dados.localizacaoId) {
      const localizacao = await tx.localizacao.findFirst({
        where: { id: input.dados.localizacaoId, empresaId: input.empresaId }, select: { id: true },
      })
      if (!localizacao) throw new CadastroVeiculoError('Localização inválida.', 400)
    }
    const veiculo = await tx.veiculo.create({
      data: { ...input.dados, empresaId: input.empresaId },
      include: { localizacao: true, motoristas: { select: { id: true, nome: true } } },
    })
    await tx.leituraQuilometragem.create({
      data: { quilometragem: veiculo.quilometragem, origem: 'CADASTRO_VEICULO', veiculoId: veiculo.id, empresaId: input.empresaId },
    })
    return veiculo
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
}

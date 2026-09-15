import 'server-only'
import { createHash, randomUUID } from 'node:crypto'
import { Prisma } from '@prisma/client'
import { executarComAuditoria } from '@/lib/auditoria'
import { decryptSensitive, encryptSensitive, encryptionConfigured, exposeMotorista, protectMotorista } from '@/lib/fieldEncryption'
import { ABAS_IMPORTACAO, IMPORTACAO_MAX_LINHAS, loteImportacaoSchema, type LoteImportacao } from '@/lib/importacaoInicialExcel'
import { PLANOS_CONFIG, normalizarModulos } from '@/utils/planos'
import { calcularComissao } from '@/lib/domainValidation'
import { dadosCustoComissaoContainer } from '@/lib/financeiro/comissoesContainer'

export class ImportacaoError extends Error {
  constructor(message: string, public readonly status = 409) { super(message) }
}
export function resumoImportacao(lote: LoteImportacao) {
  return Object.fromEntries(ABAS_IMPORTACAO.map(aba => [aba, lote[aba].length]))
}
export function lerLoteProtegido(dados: string | null, empresaId: string, checksum?: string) {
  if (!dados) throw new ImportacaoError('Este lote não está disponível para revisão.')
  const text = decryptSensitive(dados, empresaId, 'importacaoInicial.dados')!
  if (checksum && createHash('sha256').update(text).digest('hex') !== checksum) throw new ImportacaoError('Não foi possível confirmar a integridade da planilha. Solicite um novo envio.')
  return loteImportacaoSchema.parse(JSON.parse(text))
}
const dia = (value: string) => new Date(`${value}T12:00:00`)
const periodo = (date: Date) => ({ ano: date.getFullYear(), mesIndex: date.getMonth(), semanaIndex: Math.min(4, Math.floor((date.getDate() - 1) / 7) + 1) })
const chave = (value: string) => value.trim().toLocaleLowerCase('pt-BR')
function semDuplicados(values: string[], label: string) {
  if (new Set(values).size !== values.length) throw new ImportacaoError(`${label}: há registros duplicados na planilha. Revise antes de enviar.`, 400)
}

export async function validarContextoImportacao(tx: Prisma.TransactionClient, empresaId: string, lote: LoteImportacao) {
  const total = Object.values(resumoImportacao(lote)).reduce((sum, value) => sum + value, 0)
  if (total < 1 || total > IMPORTACAO_MAX_LINHAS) throw new ImportacaoError('O lote deve ter de 1 a 1.000 registros.', 400)
  const empresa = await tx.empresa.findUnique({ where: { id: empresaId } })
  if (!empresa || empresa.excluidoEm) throw new ImportacaoError('Empresa não encontrada.', 404)
  if (empresa.status !== 'ATIVO') throw new ImportacaoError('A empresa precisa estar ativa para importar os dados.')
  const modulos = normalizarModulos(empresa.modulos)
  if ((lote.Localizacoes.length || lote.Veiculos.length || lote.Motoristas.length || lote.Manutencoes.length || lote.Containers.length) && !modulos.includes('FROTA')) throw new ImportacaoError('O módulo Frota precisa estar disponível na empresa.', 403)
  if (lote.Custos.length && !modulos.includes('GESTAO')) throw new ImportacaoError('O módulo Gestão precisa estar disponível na empresa.', 403)
  const [veiculos, motoristasProtegidos, localizacoes] = await Promise.all([
    tx.veiculo.findMany({ where: { empresaId }, select: { id: true, placa: true } }),
    tx.motorista.findMany({ where: { empresaId }, select: { id: true, empresaId: true, cpf: true, cnh: true } }),
    tx.localizacao.findMany({ where: { empresaId }, select: { id: true, nome: true } }),
  ])
  const config = PLANOS_CONFIG[empresa.plano]
  if (veiculos.length + lote.Veiculos.length > config.veiculosBase + empresa.veiculos_adicionais) throw new ImportacaoError('A planilha ultrapassa as vagas de veículos contratadas. Ajuste o lote ou a capacidade da empresa.')
  semDuplicados(lote.Veiculos.map(v => v.placa), 'Veículos')
  semDuplicados(lote.Localizacoes.map(v => chave(v.nome)), 'Localizações')
  semDuplicados(lote.Motoristas.map(v => v.cpf), 'CPF de motoristas')
  semDuplicados(lote.Motoristas.map(v => v.cnh), 'CNH de motoristas')
  semDuplicados(lote.Containers.map(v => `${v.codigo}|${v.data}`), 'Containers')
  semDuplicados(lote.Custos.map(v => JSON.stringify(v)), 'Custos')
  semDuplicados(lote.Manutencoes.map(v => JSON.stringify(v)), 'Manutenções')
  const placaIds = new Map(veiculos.map(v => [v.placa, v.id]))
  const localIds = new Map(localizacoes.map(v => [chave(v.nome), v.id]))
  const motoristas = motoristasProtegidos.map(exposeMotorista)
  const cpfIds = new Map(motoristas.filter(v => v.cpf).map(v => [v.cpf!.replace(/\D/g, ''), v.id]))
  const cnhs = new Set(motoristas.map(v => v.cnh.replace(/\D/g, '')))
  for (const v of lote.Veiculos) { if (placaIds.has(v.placa)) throw new ImportacaoError('Uma placa da planilha já existe nesta empresa. Remova o cadastro repetido e mantenha apenas as referências.'); placaIds.set(v.placa, randomUUID()) }
  // The global unique plate invariant is also checked before approval. Do not
  // disclose which other tenant owns a conflicting plate.
  const conflito = lote.Veiculos.length ? await tx.veiculo.count({ where: { placa: { in: lote.Veiculos.map(v => v.placa) }, empresaId: { not: empresaId } } }) : 0
  if (conflito) throw new ImportacaoError('Uma placa informada não está disponível para cadastro.')
  for (const l of lote.Localizacoes) { if (localIds.has(chave(l.nome))) throw new ImportacaoError('Uma localização da planilha já está cadastrada. Use seu nome somente como referência.'); localIds.set(chave(l.nome), randomUUID()) }
  for (const m of lote.Motoristas) { if (cpfIds.has(m.cpf) || cnhs.has(m.cnh)) throw new ImportacaoError('CPF ou CNH já cadastrado na empresa. Remova o cadastro repetido e mantenha apenas as referências.'); cpfIds.set(m.cpf, randomUUID()); cnhs.add(m.cnh) }
  for (const v of lote.Veiculos) if (v.localizacao && !localIds.has(chave(v.localizacao))) throw new ImportacaoError('Veículo referencia uma localização ausente da planilha e da empresa.', 400)
  for (const m of lote.Motoristas) if (m.placa && !placaIds.has(m.placa)) throw new ImportacaoError('Motorista referencia uma placa ausente da planilha e da empresa.', 400)
  for (const v of [...lote.Custos, ...lote.Manutencoes, ...lote.Containers]) if (!placaIds.has(v.placa)) throw new ImportacaoError('Custo, manutenção ou container referencia uma placa ausente da empresa e da planilha.', 400)
  for (const v of [...lote.Custos, ...lote.Containers]) if (v.cpfMotorista && !cpfIds.has(v.cpfMotorista)) throw new ImportacaoError('Custo ou container referencia um CPF ausente da empresa e da planilha.', 400)
  const minimum = new Date().getFullYear() - config.historicoAnos + 1
  if ([...lote.Custos, ...lote.Manutencoes, ...lote.Containers].some(v => Number(v.data.slice(0, 4)) < minimum)) throw new ImportacaoError(`Seu plano permite importar operações a partir de ${minimum}.`, 403)
  if (lote.Containers.length && await tx.container.count({ where: { empresaId, OR: lote.Containers.map(v => ({ codigo: v.codigo, data: dia(v.data) })) } })) throw new ImportacaoError('Uma operação de container da planilha já está cadastrada.')
  return { placaIds, localIds, cpfIds }
}

export function enviarImportacao(empresaId: string, usuarioId: string, lote: LoteImportacao) {
  if (!encryptionConfigured()) throw new ImportacaoError('A proteção dos dados de importação precisa ser configurada pelo administrador.', 503)
  const text = JSON.stringify(lote)
  const checksum = createHash('sha256').update(text).digest('hex')
  return executarComAuditoria({ usuarioId }, async tx => {
    const atual = await tx.importacaoInicial.findUnique({ where: { empresaId } })
    if (atual && atual.status !== 'REJEITADO') throw new ImportacaoError(atual.status === 'APROVADO' ? 'A importação inicial desta empresa já foi utilizada.' : 'Já existe uma planilha aguardando revisão.')
    await validarContextoImportacao(tx, empresaId, lote)
    const data = { status: 'PENDENTE', dados: encryptSensitive(text, empresaId, 'importacaoInicial.dados'), resumo: resumoImportacao(lote), checksum, enviadoPorId: usuarioId, revisadoPorId: null, motivo: null, aprovado_em: null }
    const registro = await tx.importacaoInicial.upsert({ where: { empresaId }, create: { ...data, empresaId }, update: data })
    return { status: registro.status, resumo: registro.resumo, checksum: registro.checksum }
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 30000 })
}

export function decidirImportacao(empresaId: string, usuarioId: string, checksum: string, aprovar: boolean, motivo?: string) {
  return executarComAuditoria({ usuarioId, origem: 'SUPERADMIN' }, async tx => {
    const atual = await tx.importacaoInicial.findUnique({ where: { empresaId } })
    if (!atual || atual.status !== 'PENDENTE' || atual.checksum !== checksum) throw new ImportacaoError('A planilha mudou ou já foi revisada. Atualize a página.')
    if (!aprovar) return tx.importacaoInicial.update({ where: { empresaId }, data: { status: 'REJEITADO', dados: null, motivo, revisadoPorId: usuarioId } })
    const lote = lerLoteProtegido(atual.dados, empresaId, atual.checksum)
    const refs = await validarContextoImportacao(tx, empresaId, lote)
    if (lote.Localizacoes.length) await tx.localizacao.createMany({ data: lote.Localizacoes.map(v => ({ ...v, id: refs.localIds.get(chave(v.nome))!, empresaId })) })
    if (lote.Veiculos.length) {
      await tx.veiculo.createMany({ data: lote.Veiculos.map(({ localizacao, ...v }) => ({ ...v, id: refs.placaIds.get(v.placa)!, localizacaoId: localizacao ? refs.localIds.get(chave(localizacao))! : null, empresaId })) })
      await tx.leituraQuilometragem.createMany({ data: lote.Veiculos.map(v => ({ quilometragem: v.quilometragem, origem: 'CADASTRO_VEICULO', veiculoId: refs.placaIds.get(v.placa)!, empresaId })) })
    }
    if (lote.Motoristas.length) await tx.motorista.createMany({ data: lote.Motoristas.map(({ placa, validade, ...v }) => ({ ...protectMotorista(v, empresaId), id: refs.cpfIds.get(v.cpf)!, validade: dia(validade), veiculoId: placa ? refs.placaIds.get(placa)! : null, empresaId })) })
    if (lote.Custos.length) await tx.custo.createMany({ data: lote.Custos.map(({ placa, cpfMotorista, data, ...v }) => ({ ...v, data: dia(data), ...periodo(dia(data)), veiculoId: refs.placaIds.get(placa)!, motoristaId: cpfMotorista ? refs.cpfIds.get(cpfMotorista)! : null, empresaId })) })
    if (lote.Manutencoes.length) await tx.historicoVeiculo.createMany({ data: lote.Manutencoes.map(({ placa, data, conclusao, custo, quilometragem, pecas, ...v }) => ({ ...v, data_agendada: dia(data), data_conclusao: conclusao ? dia(conclusao) : null, custo, km_atual: quilometragem, pecas_substituidas: pecas, origem: 'ADMINISTRATIVA', veiculoId: refs.placaIds.get(placa)!, empresaId })) })
    const containers = lote.Containers.map(({ placa, cpfMotorista, data, origem, destino, comissaoAtiva, percentualComissao, ...v }) => ({ ...v, id: randomUUID(), data: dia(data), terminal_inicio: origem, terminal_fim: destino, comissao_ativa: comissaoAtiva, percentual_comissao: percentualComissao, comissao: comissaoAtiva ? calcularComissao(v.frete, percentualComissao) : 0, veiculoId: refs.placaIds.get(placa)!, motoristaId: cpfMotorista ? refs.cpfIds.get(cpfMotorista)! : null, empresaId }))
    if (containers.length) {
      await tx.container.createMany({ data: containers })
      await tx.movimentacaoContainerPermanente.createMany({ data: containers.map(v => ({ container_origem_id: v.id, codigo_container: v.codigo, terminal_origem: v.terminal_inicio, terminal_destino: v.terminal_fim, data_operacao: v.data, empresaId })) })
      const comissoes = containers.flatMap(v => { const data = dadosCustoComissaoContainer(v); return data ? [{ ...data, containerId: v.id }] : [] })
      if (comissoes.length) await tx.custo.createMany({ data: comissoes })
    }
    return tx.importacaoInicial.update({ where: { empresaId }, data: { status: 'APROVADO', dados: null, aprovado_em: new Date(), revisadoPorId: usuarioId, motivo: null } })
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 30000 })
}

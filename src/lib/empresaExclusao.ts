import 'server-only'
import { comOperacaoFinanceira } from '@/lib/financeiro/operacaoFinanceira'
import { cancelarRecorrenciaAntesDaExclusao } from '@/lib/financeiro/asaas'

import { randomUUID } from 'node:crypto'
import { Prisma } from '@prisma/client'
import { executarComAuditoria } from '@/lib/auditoria'
import { COBRANCAS_PIX_BUCKET } from '@/lib/financeiro/cobrancaPixStorage'
import { CONTAS_PAGAR_BUCKET } from '@/lib/financeiro/contasPagar'
import { MOTORISTAS_FOTOS_BUCKET } from '@/lib/motoristaFotos'
import { hashPassword } from '@/lib/password'
import { prisma } from '@/lib/prisma'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'
import { adicionarAnosUtc, ANOS_RETENCAO_COMPROVANTE_EXCLUSAO, gerarProtocoloExclusao, POLITICA_RETENCAO_VERSAO } from '@/lib/retencao'

interface ArquivoParaExcluir { bucket: string; caminho: string }

async function removerArquivos(arquivos: ArquivoParaExcluir[]) {
  const porBucket = new Map<string, string[]>()
  for (const arquivo of arquivos) {
    if (!arquivo.caminho || arquivo.caminho.startsWith('http://') || arquivo.caminho.startsWith('https://')) continue
    porBucket.set(arquivo.bucket, [...(porBucket.get(arquivo.bucket) ?? []), arquivo.caminho])
  }
  const supabase = getSupabaseAdmin()
  for (const [bucket, caminhos] of porBucket) {
    for (let inicio = 0; inicio < caminhos.length; inicio += 100) {
      const resultado = await supabase.storage.from(bucket).remove(caminhos.slice(inicio, inicio + 100))
      if (resultado.error) throw new Error(`Falha ao limpar o bucket ${bucket}.`)
    }
  }
}

export async function executarExclusaoEmpresa({ empresaId, solicitadoPorId, origem, motivo }: { empresaId: string; solicitadoPorId: string; origem: 'API' | 'SUPERADMIN'; motivo: string }) {
  return comOperacaoFinanceira(empresaId, 'EXCLUIR_EMPRESA', () => executarExclusaoExclusiva({ empresaId, solicitadoPorId, origem, motivo }))
}

async function executarExclusaoExclusiva({ empresaId, solicitadoPorId, origem, motivo }: { empresaId: string; solicitadoPorId: string; origem: 'API' | 'SUPERADMIN'; motivo: string }) {
  const empresa = await prisma.empresa.findFirst({ where: { id: empresaId, excluidoEm: null }, select: { id: true } })
  if (!empresa) return { encontrado: false as const }

  // A provider failure must preserve the company and its invoices for recovery.
  await cancelarRecorrenciaAntesDaExclusao(empresaId)

  const [contas, relatorios, motoristas, faturas, qrBase, qrPromocoes, usuarios] = await Promise.all([
    prisma.contaPagar.findMany({ where: { empresaId }, select: { boleto_path: true, comprovante_path: true } }),
    prisma.relatorioArquivo.findMany({ where: { empresaId, arquivo_removido_em: null }, select: { bucket: true, caminho_storage: true } }),
    prisma.motorista.findMany({ where: { empresaId }, select: { foto_url: true } }),
    prisma.fatura.findMany({ where: { empresaId }, select: { pixQrPath: true, comprovantePath: true } }),
    prisma.configuracaoPixPlano.findMany({ select: { qrPath: true } }),
    prisma.configuracaoPixPromocao.findMany({ select: { qrPath: true } }),
    prisma.usuario.findMany({ where: { empresaId }, select: { id: true, email: true } }),
  ])
  const caminhosQrBase = new Set([...qrBase, ...qrPromocoes].map(item => item.qrPath))
  const arquivos: ArquivoParaExcluir[] = [
    ...contas.flatMap(conta => [conta.boleto_path, conta.comprovante_path].filter((caminho): caminho is string => Boolean(caminho)).map(caminho => ({ bucket: CONTAS_PAGAR_BUCKET, caminho }))),
    ...relatorios.map(arquivo => ({ bucket: arquivo.bucket, caminho: arquivo.caminho_storage })),
    ...motoristas.flatMap(motorista => motorista.foto_url ? [{ bucket: MOTORISTAS_FOTOS_BUCKET, caminho: motorista.foto_url }] : []),
    ...faturas.flatMap(fatura => [fatura.comprovantePath, caminhosQrBase.has(fatura.pixQrPath ?? '') ? null : fatura.pixQrPath].filter((caminho): caminho is string => Boolean(caminho)).map(caminho => ({ bucket: COBRANCAS_PIX_BUCKET, caminho }))),
  ]

  const [veiculosTotal, motoristasTotal, registrosOperacionais, ticketsTotal] = await Promise.all([
    prisma.veiculo.count({ where: { empresaId } }),
    prisma.motorista.count({ where: { empresaId } }),
    Promise.all([prisma.container.count({ where: { empresaId } }), prisma.custo.count({ where: { empresaId } }), prisma.historicoVeiculo.count({ where: { empresaId } }), prisma.tarefa.count({ where: { empresaId } }), prisma.lembretePessoal.count({ where: { empresaId } }), prisma.contaPagar.count({ where: { empresaId } }), prisma.ocorrenciaVeiculo.count({ where: { empresaId } }), prisma.conformidadeMotorista.count({ where: { empresaId } })]).then(totais => totais.reduce((total, quantidade) => total + quantidade, 0)),
    prisma.conversaSuporte.count({ where: { empresaId } }),
  ])

  const job = await prisma.exclusaoEmpresaJob.create({ data: { protocolo: gerarProtocoloExclusao(), empresaId, solicitadoPorId, status: 'PREPARADO', arquivos: arquivos as unknown as Prisma.InputJsonValue, politicaVersao: POLITICA_RETENCAO_VERSAO, resumo: { usuarios: usuarios.length, veiculos: veiculosTotal, motoristas: motoristasTotal, registrosOperacionais, tickets: ticketsTotal, arquivosPrivados: arquivos.length, origem, motivo } } })
  const agora = new Date()
  const senhaInutilizavel = await hashPassword(randomUUID())

  try {
    await executarComAuditoria({ usuarioId: solicitadoPorId, origem }, async tx => {
      const bloqueada = await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM empresas WHERE id = ${empresaId} AND excluido_em IS NULL FOR UPDATE`
      if (!bloqueada[0]) throw new Error('EMPRESA_JA_EXCLUIDA')
      await tx.solicitacaoAcesso.deleteMany({ where: { empresaId } })
      await tx.solicitacaoAssinatura.deleteMany({ where: { empresaId } })
      await tx.importacaoInicial.deleteMany({ where: { empresaId } })
      await tx.notificacao.deleteMany({ where: { empresaId } })
      await tx.alertaLeitura.deleteMany({ where: { usuario: { empresaId } } })
      await tx.alertaSistema.deleteMany({ where: { destinatario: { empresaId } } })
      await tx.tarefa.deleteMany({ where: { empresaId } })
      await tx.lembretePessoal.deleteMany({ where: { empresaId } })
      await tx.ocorrenciaVeiculo.deleteMany({ where: { empresaId } })
      await tx.conformidadeMotorista.deleteMany({ where: { empresaId } })
      await tx.contaPagar.deleteMany({ where: { empresaId } })
      await tx.container.deleteMany({ where: { empresaId } })
      await tx.custo.deleteMany({ where: { empresaId } })
      await tx.historicoVeiculo.deleteMany({ where: { empresaId } })
      await tx.movimentacaoContainerPermanente.deleteMany({ where: { empresaId } })
      await tx.relatorioArquivo.deleteMany({ where: { empresaId } })
      await tx.leituraQuilometragem.deleteMany({ where: { empresaId } })
      await tx.motorista.deleteMany({ where: { empresaId } })
      await tx.veiculo.deleteMany({ where: { empresaId } })
      await tx.localizacao.deleteMany({ where: { empresaId } })
      await tx.recorrenciaPagamento.deleteMany({ where: { empresaId, status: 'CANCELADA' } })
      await tx.fatura.deleteMany({ where: { empresaId } })
      await tx.conversaSuporte.deleteMany({ where: { empresaId } })
      await tx.sessaoUsuario.deleteMany({ where: { empresaId } })
      await tx.resetSenha.deleteMany({ where: { email: { in: usuarios.map(usuario => usuario.email) } } })
      for (const usuario of usuarios) await tx.usuario.update({ where: { id: usuario.id }, data: { nome: 'Usuário removido', email: `removido+${usuario.id}@usuarios.invalid`, senha_hash: senhaInutilizavel, ativo: false, excluidoEm: agora, acessoDashboardGeral: false, modulosAcesso: [], exigeTrocaSenha: false, senhaTemporariaExpiraEm: null, sessaoVersao: { increment: 1 } } })
      await tx.empresa.update({ where: { id: empresaId }, data: { nome: 'Empresa removida', email: `removida+${empresaId}@empresas.invalid`, cnpj: null, cnpjHash: null, nome_contato: null, telefone: null, status: 'INATIVO', status_motivo: motivo, status_alterado_em: agora, status_alterado_por_id: null, total_pago_historico: '0,00', portal_financeiro_nome: null, portal_financeiro_url: null, modulos: [], excluidoEm: agora } })
      await tx.exclusaoEmpresaJob.update({ where: { id: job.id }, data: { status: 'DADOS_REMOVIDOS' } })
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 30_000 })
  } catch (error) {
    await prisma.exclusaoEmpresaJob.update({ where: { id: job.id }, data: { status: 'FALHA_BANCO', erro: error instanceof Error ? error.message.slice(0, 500) : 'Falha não identificada.' } })
    throw error
  }

  let storagePendente = false
  try {
    await removerArquivos(arquivos)
    const concluidoEm = new Date()
    await prisma.exclusaoEmpresaJob.update({ where: { id: job.id }, data: { status: 'CONCLUIDO', arquivos: [], erro: null, concluidoEm, reterAte: adicionarAnosUtc(concluidoEm, ANOS_RETENCAO_COMPROVANTE_EXCLUSAO) } })
  } catch (error) {
    storagePendente = true
    await prisma.exclusaoEmpresaJob.update({ where: { id: job.id }, data: { status: 'PENDENTE_STORAGE', erro: error instanceof Error ? error.message.slice(0, 500) : 'Falha não identificada.' } })
  }
  return { encontrado: true as const, storagePendente, protocolo: job.protocolo }
}

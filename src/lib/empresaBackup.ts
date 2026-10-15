import 'server-only'

import { gerarBackupEmpresaExcel, type SecaoBackupEmpresa } from '@/lib/empresaBackupExcel'
import { decryptSensitive, exposeEmpresa, exposeMotorista } from '@/lib/fieldEncryption'
import { lerLoteProtegido } from '@/lib/importacaoInicial'
import { prisma } from '@/lib/prisma'

export async function gerarArquivoBackupEmpresa(empresaId: string) {
  const [
    empresa, usuarios, veiculos, motoristas, localizacoes, manutencoes, leituras,
    custos, contas, containers, movimentacoes, tarefas, lembretes, notificacoes, faturas,
    solicitacoes, relatorios, sessoes, eventos, auditoria, ocorrencias, conformidades,
  ] = await Promise.all([
    prisma.empresa.findFirst({ where: { id: empresaId, excluidoEm: null } }),
    prisma.usuario.findMany({ where: { empresaId, excluidoEm: null }, select: { id: true, nome: true, email: true, role: true, acessoDashboardGeral: true, ativo: true, modulosAcesso: true, exigeTrocaSenha: true, criado_em: true, atualizado_em: true } }),
    prisma.veiculo.findMany({ where: { empresaId } }),
    prisma.motorista.findMany({ where: { empresaId } }),
    prisma.localizacao.findMany({ where: { empresaId } }),
    prisma.historicoVeiculo.findMany({ where: { empresaId } }),
    prisma.leituraQuilometragem.findMany({ where: { empresaId } }),
    prisma.custo.findMany({ where: { empresaId } }),
    prisma.contaPagar.findMany({ where: { empresaId } }),
    prisma.container.findMany({ where: { empresaId } }),
    prisma.movimentacaoContainerPermanente.findMany({ where: { empresaId } }),
    prisma.tarefa.findMany({ where: { empresaId } }),
    prisma.lembretePessoal.findMany({ where: { empresaId } }),
    prisma.notificacao.findMany({ where: { empresaId } }),
    prisma.fatura.findMany({ where: { empresaId } }),
    prisma.solicitacaoAssinatura.findMany({ where: { empresaId } }),
    prisma.relatorioArquivo.findMany({ where: { empresaId } }),
    prisma.sessaoUsuario.findMany({ where: { empresaId }, select: { id: true, usuarioId: true, criadoEm: true, ultimaAtividade: true, expiraEm: true, revogadaEm: true } }),
    prisma.eventoSeguranca.findMany({ where: { empresaId } }),
    prisma.auditoriaLog.findMany({ where: { empresaId } }),
    prisma.ocorrenciaVeiculo.findMany({ where: { empresaId } }),
    prisma.conformidadeMotorista.findMany({ where: { empresaId } }),
  ])

  if (!empresa) return null
  const empresaExposta = exposeEmpresa(empresa)
  const secoes: SecaoBackupEmpresa[] = [
    { nome: 'LEIA-ME', linhas: [{ geradoEm: new Date(), empresa: empresaExposta.nome, observacao: 'Cópia de dados vinculados à empresa. Senhas, hashes de autenticação e segredos técnicos não são exportados. O arquivo contém dados pessoais e deve ser enviado por canal protegido.' }] },
    { nome: 'Empresa', linhas: [empresaExposta] },
    { nome: 'Usuarios', linhas: usuarios },
    { nome: 'Veiculos', linhas: veiculos },
    { nome: 'Motoristas', linhas: motoristas.map(exposeMotorista) },
    { nome: 'Localizacoes', linhas: localizacoes },
    { nome: 'Manutencoes', linhas: manutencoes },
    { nome: 'Leituras KM', linhas: leituras },
    { nome: 'Custos', linhas: custos },
    { nome: 'Contas a pagar', linhas: contas.map(conta => ({ ...conta, linha_digitavel: decryptSensitive(conta.linha_digitavel, empresaId, 'contaPagar.linhaDigitavel') })) },
    { nome: 'Containers', linhas: containers },
    { nome: 'Movimentacoes', linhas: movimentacoes },
    { nome: 'Tarefas', linhas: tarefas },
    { nome: 'Lembretes', linhas: lembretes },
    { nome: 'Notificacoes', linhas: notificacoes },
    { nome: 'Faturas RPMTRUCK', linhas: faturas },
    { nome: 'Solicitacoes plano', linhas: solicitacoes },
    { nome: 'Arquivos operacionais', linhas: relatorios },
    { nome: 'Sessoes', linhas: sessoes },
    { nome: 'Eventos seguranca', linhas: eventos },
    { nome: 'Auditoria', linhas: auditoria },
    { nome: 'Ocorrencias veiculos', linhas: ocorrencias },
    { nome: 'Conformidade motoristas', linhas: conformidades },
  ]

  const importacao = await prisma.importacaoInicial.findUnique({ where: { empresaId } })
  if (importacao) {
    const { dados, ...metadata } = importacao
    secoes.push({ nome: 'Importacao inicial', linhas: [metadata] })
    if (dados) {
      const lote = lerLoteProtegido(dados, empresaId, importacao.checksum)
      for (const [aba, linhas] of Object.entries(lote)) secoes.push({ nome: `Import ${aba}`, linhas })
    }
  }

  return { arquivo: await gerarBackupEmpresaExcel(secoes), empresa: empresaExposta }
}

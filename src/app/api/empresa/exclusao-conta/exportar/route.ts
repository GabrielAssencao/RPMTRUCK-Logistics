import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { requireEmpresaAuth } from '@/lib/empresaAuth'
import { criarTokenBackupEmpresa } from '@/lib/empresaBackupToken'
import { gerarBackupEmpresaExcel } from '@/lib/empresaBackupExcel'
import { decryptSensitive, exposeEmpresa, exposeMotorista } from '@/lib/fieldEncryption'
import { prisma } from '@/lib/prisma'
import { applyRateLimit, RATE_LIMITS } from '@/lib/rateLimit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const auth = await requireEmpresaAuth(request, { acao: 'GESTAO' })
  if (auth.error || !auth.session || !auth.empresaId) {
    return NextResponse.json({ erro: auth.error }, { status: auth.status })
  }
  const limited = await applyRateLimit(
    request,
    `account-deletion-export:${auth.empresaId}:${auth.session.userId}`,
    RATE_LIMITS.REPORT_GENERATE.limit,
    RATE_LIMITS.REPORT_GENERATE.windowMs,
  )
  if (limited) return limited

  const empresaId = auth.empresaId
  const [
    empresa, usuarios, veiculos, motoristas, localizacoes, manutencoes, leituras,
    custos, contas, containers, movimentacoes, tarefas, notificacoes, faturas,
    solicitacoes, relatorios, sessoes, eventos, auditoria,
  ] = await Promise.all([
    prisma.empresa.findUnique({ where: { id: empresaId } }),
    prisma.usuario.findMany({ where: { empresaId }, select: { id: true, nome: true, email: true, role: true, acessoDashboardGeral: true, exigeTrocaSenha: true, criado_em: true, atualizado_em: true } }),
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
    prisma.notificacao.findMany({ where: { empresaId } }),
    prisma.fatura.findMany({ where: { empresaId } }),
    prisma.solicitacaoAssinatura.findMany({ where: { empresaId } }),
    prisma.relatorioArquivo.findMany({ where: { empresaId } }),
    prisma.sessaoUsuario.findMany({ where: { empresaId }, select: { id: true, usuarioId: true, criadoEm: true, ultimaAtividade: true, expiraEm: true, revogadaEm: true } }),
    prisma.eventoSeguranca.findMany({ where: { empresaId } }),
    prisma.auditoriaLog.findMany({ where: { empresaId } }),
  ])

  if (!empresa) return NextResponse.json({ erro: 'Empresa não encontrada.' }, { status: 404 })

  const empresaExposta = exposeEmpresa(empresa)
  const secoes = [
    { nome: 'LEIA-ME', linhas: [{
      geradoEm: new Date(),
      empresa: empresaExposta.nome,
      observacao: 'Backup de dados vinculados à empresa. Senhas, hashes de autenticação e segredos técnicos são excluídos por segurança.',
    }] },
    { nome: 'Empresa', linhas: [empresaExposta] },
    { nome: 'Usuarios', linhas: usuarios },
    { nome: 'Veiculos', linhas: veiculos },
    { nome: 'Motoristas', linhas: motoristas.map((motorista) => exposeMotorista(motorista)) },
    { nome: 'Localizacoes', linhas: localizacoes },
    { nome: 'Manutencoes', linhas: manutencoes },
    { nome: 'Leituras KM', linhas: leituras },
    { nome: 'Custos', linhas: custos },
    { nome: 'Contas a pagar', linhas: contas.map((conta) => ({
      ...conta,
      linha_digitavel: decryptSensitive(conta.linha_digitavel, empresaId, 'contaPagar.linhaDigitavel'),
    })) },
    { nome: 'Containers', linhas: containers },
    { nome: 'Movimentacoes', linhas: movimentacoes },
    { nome: 'Tarefas', linhas: tarefas },
    { nome: 'Notificacoes', linhas: notificacoes },
    { nome: 'Faturas RPMTRUCK', linhas: faturas },
    { nome: 'Solicitacoes plano', linhas: solicitacoes },
    { nome: 'Arquivos operacionais', linhas: relatorios },
    { nome: 'Sessoes', linhas: sessoes },
    { nome: 'Eventos seguranca', linhas: eventos },
    { nome: 'Auditoria', linhas: auditoria },
  ]
  const arquivo = await gerarBackupEmpresaExcel(secoes)
  const token = await criarTokenBackupEmpresa(auth.session.userId, empresaId)
  const data = new Date().toISOString().slice(0, 10)

  return new NextResponse(new Uint8Array(arquivo), {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="rpmtruck-backup-${data}.xlsx"`,
      'Content-Length': String(arquivo.length),
      'X-RPMTruck-Backup-Token': token,
      'Cache-Control': 'private, no-store, max-age=0',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}

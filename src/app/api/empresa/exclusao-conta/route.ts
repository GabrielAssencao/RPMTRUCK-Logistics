import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { requireEmpresaAuth } from '@/lib/empresaAuth'
import { validarTokenBackupEmpresa } from '@/lib/empresaBackupToken'
import { verifyPassword } from '@/lib/password'
import { prisma } from '@/lib/prisma'
import { applyRateLimit, RATE_LIMITS } from '@/lib/rateLimit'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'
import { CONTAS_PAGAR_BUCKET } from '@/lib/financeiro/contasPagar'
import { MOTORISTAS_FOTOS_BUCKET } from '@/lib/motoristaFotos'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const CONFIRMACAO = 'EXCLUIR MINHA EMPRESA'
const schema = z.object({
  senha: z.string().min(1).max(128),
  confirmacao: z.literal(CONFIRMACAO),
  backupToken: z.string().min(40).max(4_096),
  backupConfirmado: z.literal(true),
}).strict()

interface ArquivoParaExcluir {
  bucket: string
  caminho: string
}

async function removerArquivos(arquivos: ArquivoParaExcluir[]) {
  const supabase = getSupabaseAdmin()
  const porBucket = new Map<string, string[]>()
  for (const arquivo of arquivos) {
    if (!arquivo.caminho || arquivo.caminho.startsWith('http://') || arquivo.caminho.startsWith('https://')) continue
    porBucket.set(arquivo.bucket, [...(porBucket.get(arquivo.bucket) ?? []), arquivo.caminho])
  }

  for (const [bucket, caminhos] of porBucket) {
    for (let inicio = 0; inicio < caminhos.length; inicio += 100) {
      const resultado = await supabase.storage.from(bucket).remove(caminhos.slice(inicio, inicio + 100))
      if (resultado.error) throw new Error(`Falha ao limpar o bucket ${bucket}.`)
    }
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireEmpresaAuth(request, { acao: 'GESTAO' })
  if (auth.error || !auth.session || !auth.empresaId) {
    return NextResponse.json({ erro: auth.error }, { status: auth.status })
  }
  const limited = await applyRateLimit(
    request,
    `account-deletion:${auth.empresaId}:${auth.session.userId}`,
    RATE_LIMITS.PASSWORD_RESET_ACCOUNT.limit,
    RATE_LIMITS.PASSWORD_RESET_ACCOUNT.windowMs,
  )
  if (limited) return limited

  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ erro: `Confirme o backup e digite exatamente “${CONFIRMACAO}”.` }, { status: 400 })
  }
  if (!(await validarTokenBackupEmpresa(parsed.data.backupToken, auth.session.userId, auth.empresaId))) {
    return NextResponse.json({ erro: 'O comprovante de backup expirou. Gere e baixe um novo arquivo Excel.' }, { status: 409 })
  }

  const usuario = await prisma.usuario.findFirst({
    where: { id: auth.session.userId, empresaId: auth.empresaId },
    select: { id: true, senha_hash: true },
  })
  if (!usuario || !(await verifyPassword(parsed.data.senha, usuario.senha_hash))) {
    return NextResponse.json({ erro: 'A senha informada está incorreta.' }, { status: 400 })
  }

  const empresaId = auth.empresaId
  const [contas, relatorios, motoristas] = await Promise.all([
    prisma.contaPagar.findMany({ where: { empresaId }, select: { boleto_path: true, comprovante_path: true } }),
    prisma.relatorioArquivo.findMany({ where: { empresaId, arquivo_removido_em: null }, select: { bucket: true, caminho_storage: true } }),
    prisma.motorista.findMany({ where: { empresaId }, select: { foto_url: true } }),
  ])
  const arquivos: ArquivoParaExcluir[] = [
    ...contas.flatMap((conta) => [conta.boleto_path, conta.comprovante_path]
      .filter((caminho): caminho is string => Boolean(caminho))
      .map((caminho) => ({ bucket: CONTAS_PAGAR_BUCKET, caminho }))),
    ...relatorios.map((arquivo) => ({ bucket: arquivo.bucket, caminho: arquivo.caminho_storage })),
    ...motoristas.map((motorista) => motorista.foto_url)
      .filter((caminho): caminho is string => Boolean(caminho))
      .map((caminho) => ({ bucket: MOTORISTAS_FOTOS_BUCKET, caminho })),
  ]

  const job = await prisma.exclusaoEmpresaJob.create({
    data: {
      empresaId,
      solicitadoPorId: auth.session.userId,
      status: 'PREPARADO',
      arquivos: arquivos as unknown as Prisma.InputJsonValue,
    },
  })

  try {
    await prisma.$transaction(async (tx) => {
      const empresa = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM empresas WHERE id = ${empresaId} FOR UPDATE
      `
      if (!empresa[0]) throw new Error('EMPRESA_JA_EXCLUIDA')

      await tx.solicitacaoAssinatura.deleteMany({ where: { empresaId } })
      await tx.notificacao.deleteMany({ where: { empresaId } })
      await tx.tarefa.deleteMany({ where: { empresaId } })
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
      await tx.fatura.deleteMany({ where: { empresaId } })
      await tx.eventoSeguranca.deleteMany({ where: { empresaId } })
      await tx.sessaoUsuario.deleteMany({ where: { empresaId } })
      await tx.auditoriaLog.deleteMany({ where: { empresaId } })
      await tx.empresa.delete({ where: { id: empresaId } })
      await tx.exclusaoEmpresaJob.update({ where: { id: job.id }, data: { status: 'DADOS_REMOVIDOS' } })
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 30_000 })
  } catch (error) {
    await prisma.exclusaoEmpresaJob.update({
      where: { id: job.id },
      data: { status: 'FALHA_BANCO', erro: error instanceof Error ? error.message.slice(0, 500) : 'Falha não identificada.' },
    })
    console.error('Falha no expurgo transacional da empresa:', error)
    return NextResponse.json({ erro: 'Não foi possível concluir a exclusão. Nenhum expurgo parcial do banco foi confirmado.' }, { status: 500 })
  }

  let storagePendente = false
  try {
    await removerArquivos(arquivos)
    await prisma.exclusaoEmpresaJob.update({
      where: { id: job.id },
      data: { status: 'CONCLUIDO', arquivos: [], erro: null, concluidoEm: new Date() },
    })
  } catch (error) {
    storagePendente = true
    await prisma.exclusaoEmpresaJob.update({
      where: { id: job.id },
      data: { status: 'PENDENTE_STORAGE', erro: error instanceof Error ? error.message.slice(0, 500) : 'Falha não identificada.' },
    })
    console.error('Dados removidos; limpeza de Storage pendente:', error)
  }

  const response = NextResponse.json({
    sucesso: true,
    storagePendente,
    mensagem: storagePendente
      ? 'Os dados do banco foram excluídos. A limpeza dos arquivos privados foi registrada para nova tentativa.'
      : 'A empresa, seus dados e arquivos privados foram excluídos.',
  }, { status: storagePendente ? 202 : 200 })
  response.cookies.delete('rpmtruck_session')
  return response
}

import type { Prisma } from '@prisma/client'
import { notificarAdmins, notificarUsuariosDaEmpresa } from '@/lib/notificacoes'

type FaturaNotificavel = {
  empresaId: string
  mes: string
  ano: number
  tipo: string
  valor: number
  vencimento?: Date | null
}

const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

function resumoFaturas(faturas: FaturaNotificavel[]) {
  const itens = faturas.map(fatura => fatura.tipo === 'IMPLEMENTACAO'
    ? 'implantação'
    : `mensalidade ${fatura.mes}/${fatura.ano}`)
  return itens.length <= 1 ? itens[0] ?? 'cobrança do plano' : `${itens.slice(0, -1).join(', ')} e ${itens.at(-1)}`
}

function totalFaturas(faturas: FaturaNotificavel[]) {
  return moeda.format(faturas.reduce((total, fatura) => total + fatura.valor, 0))
}

function empresaDasFaturas(faturas: FaturaNotificavel[]) {
  const empresas = new Set(faturas.map(fatura => fatura.empresaId))
  if (empresas.size !== 1) throw new Error('Faturas de empresas diferentes não podem compartilhar uma notificação.')
  return faturas[0]!.empresaId
}

async function notificarGestores(
  database: Prisma.TransactionClient,
  empresaId: string,
  titulo: string,
  mensagem: string,
) {
  return notificarUsuariosDaEmpresa(empresaId, { titulo, mensagem, modulo: 'GERAL' }, ['GESTOR_EMPRESA'], database)
}

export async function notificarPagamentoConfirmado(database: Prisma.TransactionClient, faturas: FaturaNotificavel[]) {
  if (faturas.length === 0) return { count: 0 }
  const empresaId = empresaDasFaturas(faturas)
  await database.notificacao.updateMany({
    where: {
      empresaId,
      lida: false,
      OR: [
        { titulo: 'Acesso aprovado' },
        { titulo: { startsWith: 'Mensalidade do plano:' } },
        { titulo: 'Mensalidade próxima do vencimento' },
        { titulo: 'Pagamento vencido' },
      ],
    },
    data: { lida: true },
  })
  return notificarGestores(
    database,
    empresaId,
    'Pagamento confirmado',
    `Recebemos ${totalFaturas(faturas)} referente a ${resumoFaturas(faturas)}. O pagamento foi confirmado e a situação do acesso foi atualizada automaticamente.`,
  )
}

export async function notificarPagamentoVencido(
  database: Prisma.TransactionClient,
  faturas: FaturaNotificavel[],
  eraRecorrente: boolean,
) {
  if (faturas.length === 0) return { count: 0 }
  const empresaId = empresaDasFaturas(faturas)
  const vencimento = faturas.map(fatura => fatura.vencimento).filter((data): data is Date => Boolean(data)).sort((a, b) => a.getTime() - b.getTime())[0]
  const data = vencimento?.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }) ?? 'informado no sistema'
  return notificarGestores(
    database,
    empresaId,
    eraRecorrente ? 'Pagamento automático não concluído' : 'Pagamento vencido',
    `${eraRecorrente ? 'O pagamento automático não foi concluído e novas cobranças automáticas foram desativadas. ' : ''}${totalFaturas(faturas)} referente a ${resumoFaturas(faturas)} venceu em ${data}. Você tem 3 dias de carência para pagar em Planos e pagamentos antes do bloqueio operacional.`,
  )
}

export async function notificarPagamentoEstornado(database: Prisma.TransactionClient, faturas: FaturaNotificavel[]) {
  if (faturas.length === 0) return { count: 0 }
  return notificarGestores(
    database,
    empresaDasFaturas(faturas),
    'Pagamento estornado',
    `O pagamento de ${totalFaturas(faturas)} referente a ${resumoFaturas(faturas)} foi estornado. A cobrança anterior não será reutilizada; acompanhe a situação em Planos e pagamentos ou fale com o suporte.`,
  )
}

export async function notificarSituacaoRecorrencia(
  database: Prisma.TransactionClient,
  empresaId: string,
  situacao: 'ATIVADA' | 'NAO_CONCLUIDA' | 'DESATIVADA',
) {
  const conteudo = situacao === 'ATIVADA'
    ? {
        titulo: 'Pagamento automático ativado',
        mensagem: 'O cartão foi autorizado para as próximas mensalidades. Cada mensalidade será considerada paga somente depois da confirmação da cobrança.',
      }
    : situacao === 'NAO_CONCLUIDA'
      ? {
          titulo: 'Pagamento automático não ativado',
          mensagem: 'A autorização do cartão foi cancelada ou expirou. Nenhuma mensalidade foi quitada por essa tentativa; você pode tentar novamente em Planos e pagamentos.',
        }
      : {
          titulo: 'Pagamento automático desativado',
          mensagem: 'As próximas mensalidades não serão cobradas automaticamente. Quando houver uma cobrança pendente, escolha a forma de pagamento em Planos e pagamentos.',
        }
  return notificarGestores(database, empresaId, conteudo.titulo, conteudo.mensagem)
}

function competenciaPorData(data: Date) {
  const partes = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo', month: 'short', year: 'numeric',
  }).formatToParts(data)
  const mes = (partes.find(parte => parte.type === 'month')?.value ?? '').replace('.', '')
  const ano = partes.find(parte => parte.type === 'year')?.value ?? ''
  return `${mes.charAt(0).toUpperCase()}${mes.slice(1)}/${ano}`
}

export async function notificarFimPromocaoRecorrencia(
  database: Prisma.TransactionClient,
  empresaId: string,
  renovacaoEm: Date,
  valorRenovacao: number,
) {
  const competenciaRenovacao = competenciaPorData(renovacaoEm)
  const fimPromocao = new Date(Date.UTC(renovacaoEm.getUTCFullYear(), renovacaoEm.getUTCMonth(), 0, 15))
  return notificarGestores(
    database,
    empresaId,
    'Condição promocional próxima do fim',
    `Sua condição promocional termina em ${competenciaPorData(fimPromocao)}. A mensalidade de ${competenciaRenovacao} será de ${moeda.format(valorRenovacao)}. Em Planos e pagamentos, você pode manter o cartão automático com o novo valor ou programar a desativação ao fim da promoção.`,
  )
}

export async function notificarTransicaoPromocaoConfirmada(
  database: Prisma.TransactionClient,
  empresaId: string,
  acao: 'ATUALIZAR_VALOR' | 'DESATIVAR_RECORRENCIA',
  renovacaoEm: Date,
  valorRenovacao: number,
) {
  return notificarGestores(
    database,
    empresaId,
    acao === 'ATUALIZAR_VALOR' ? 'Novo valor do pagamento automático confirmado' : 'Desativação ao fim da promoção confirmada',
    acao === 'ATUALIZAR_VALOR'
      ? `A partir da mensalidade de ${competenciaPorData(renovacaoEm)}, o cartão automático usará o valor de ${moeda.format(valorRenovacao)}. A alteração foi confirmada pelo processador de pagamentos.`
      : `O cartão automático foi desativado para impedir a mensalidade integral de ${competenciaPorData(renovacaoEm)}. A última cobrança promocional já emitida continua válida.`,
  )
}

export async function notificarFalhaTransicaoPromocao(
  database: Prisma.TransactionClient,
  empresaId: string,
  empresaNome: string,
  renovacaoEm: Date,
) {
  await notificarGestores(
    database,
    empresaId,
    'Pagamento automático suspenso por segurança',
    `Não foi possível confirmar a atualização prevista para ${competenciaPorData(renovacaoEm)}. Novas cobranças automáticas foram suspensas para evitar um valor incorreto. O suporte foi avisado.`,
  )
  return notificarAdmins({
    titulo: 'Falha na transição de preço recorrente',
    mensagem: `${empresaNome}: a atualização da assinatura para ${competenciaPorData(renovacaoEm)} falhou. A cobrança automática foi colocada em estado de segurança e precisa ser conciliada.`,
    modulo: 'ASSINATURA',
  }, database)
}

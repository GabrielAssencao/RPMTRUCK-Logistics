import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { loadTs } from './helpers/load-ts.mjs'

const situacao = loadTs('src/lib/financeiro/situacaoFinanceira.ts')
const planos = loadTs('src/lib/financeiro/planosComerciais.ts', {
  '@/lib/prisma': { prisma: {} },
  '@/utils/planos': { PLANOS_CONFIG: {} },
  '@/lib/financeiro/situacaoFinanceira': situacao,
})

test('12 mensalidades promocionais de Set/2026 renovam em Set/2027 pelo valor integral', () => {
  const empresa = {
    precoBasePromocional: 297,
    precoBaseRenovacao: 397,
    promocaoMesesIniciais: 12,
    promocaoAtivadaEm: new Date('2026-09-30T18:14:28.917Z'),
    usuarios_adicionais: 0,
    veiculos_adicionais: 0,
    diaVencimento: 28,
  }
  const transicao = planos.obterTransicaoPromocionalEmpresa(empresa, {
    precoBase: 397, precoUsuarioAdicional: 20, precoVeiculoAdicional: 10,
  })
  assert.equal(transicao.valorRenovacao, 397)
  assert.equal(transicao.renovacaoEm.toISOString(), '2027-09-29T03:00:00.000Z')
})

test('transição usa aviso antecipado, margem anterior à geração e confirmação por webhook', () => {
  const processador = readFileSync('src/lib/financeiro/transicaoPromocaoRecorrencia.ts', 'utf8')
  const gateway = readFileSync('src/lib/financeiro/asaas.ts', 'utf8')
  const webhook = readFileSync('src/app/api/webhooks/asaas/route.ts', 'utf8')
  const rota = readFileSync('src/app/api/empresa/recorrencia/route.ts', 'utf8')
  const ciclo = readFileSync('src/lib/financeiro/cicloCobranca.ts', 'utf8')
  assert.match(processador, /DIAS_AVISO_FIM_PROMOCAO = 60/)
  assert.match(processador, /DIAS_ANTECEDENCIA_TRANSICAO = 50/)
  assert.match(gateway, /updatePendingPayments: false/)
  assert.equal((gateway.match(/\^\[a-zA-Z0-9_-\]\{3,160\}\$/g) ?? []).length, 2)
  assert.match(webhook, /evento\.event === 'SUBSCRIPTION_UPDATED'/)
  assert.match(webhook, /Math\.round\(valorConfirmado \* 100\)/)
  assert.match(rota, /status: 'ATIVA'/)
  assert.match(rota, /transicaoPromocaoStatus: 'AGENDADA'/)
  assert.match(ciclo, /status: 'FALHA', transicaoPromocaoStatus: null/)
  assert.doesNotMatch(ciclo, /status: \{ in: \['CANCELADA', 'FALHA'\] \}/)
})

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const read = (path) => readFileSync(resolve(root, path), 'utf8')

test('comprovante opcional permanece privado, limitado a PDF e isolado por empresa', () => {
  const route = read('src/app/api/empresa/faturas/[id]/comprovante/route.ts')
  const storage = read('src/lib/financeiro/cobrancaPixStorage.ts')
  const migration = read('prisma/migrations/20260917090000_promocoes_cobranca_pix_manual/migration.sql')

  assert.match(route, /requireEmpresaAuth\(request, \{ acao: 'GESTAO' \}\)/)
  assert.match(route, /empresaId: auth\.session\.empresaId/)
  assert.match(route, /comprovanteEnviadoPorId: auth\.session\.userId/)
  assert.match(storage, /arquivo\.type === PDF/)
  assert.match(storage, /createSignedUrl\(caminho, 60/)
  assert.match(migration, /'cobrancas-pix-privadas'[\s\S]*false/)
})

test('emissão Asaas é tenant scoped e registra o pagamento antes de buscar o QR', () => {
  const route = read('src/app/api/empresa/faturas/[id]/cobranca/route.ts')
  const gateway = read('src/lib/financeiro/asaas.ts')
  const qr = read('src/app/api/empresa/faturas/[id]/pix-qr/route.ts')

  assert.match(route, /requireEmpresaAuth\(request, \{ acao: 'GESTAO' \}\)/)
  assert.match(route, /emitirCobrancaAsaas\(id, auth\.session\.empresaId, parsed\.data\.billingType, parsed\.data\.segundaFaturaId\)/)
  assert.match(gateway, /where: \{ id: \{ in: segundaFaturaId \? \[faturaId, segundaFaturaId\] : \[faturaId\] \}, empresaId \}/)
  assert.match(gateway, /faturas\.some\(item => item\.valor <= 0\)/)
  assert.match(gateway, /\/payments\?externalReference=/)
  assert.match(gateway, /await prisma\.fatura\.updateMany\(\{\s*where: \{ id: \{ in: faturaIds \}, empresaId, status: 'PENDENTE' \}/)
  assert.ok(gateway.indexOf('gatewayPaymentId: cobranca.id') < gateway.indexOf('/pixQrCode'))
  assert.match(gateway, /montarReferenciaCobranca\(faturaIds\)/)
  assert.match(read('src/app/api/webhooks/asaas/route.ts'), /somarCentavos\(faturas\.map\(fatura => fatura\.valor\)\)/)
  assert.match(qr, /empresaId: auth\.session\.empresaId/)
})

test('a assinatura mostra apenas faturas com valor positivo para emitir Pix', () => {
  const assinatura = read('src/app/api/empresa/assinatura/route.ts')
  assert.match(assinatura, /where: \{ empresaId: auth\.session\.empresaId, status: 'PENDENTE', valor: \{ gt: 0 \} \}/)
})

test('webhook Asaas autentica, limita payload, evita replay e confere referência e valor', () => {
  const webhook = read('src/app/api/webhooks/asaas/route.ts')
  const migration = read('prisma/migrations/20260918190000_asaas_gateway_precos/migration.sql')

  assert.match(webhook, /timingSafeEqual/)
  assert.match(webhook, /asaas-access-token/)
  assert.match(webhook, /128 \* 1024/)
  assert.match(webhook, /eventoWebhookPagamento\.create/)
  assert.match(webhook, /Referência externa divergente/)
  assert.match(webhook, /Valor recebido diverge da fatura/)
  assert.match(webhook, /PAYMENT_RECEIVED/)
  assert.match(migration, /ENABLE ROW LEVEL SECURITY/)
  assert.match(migration, /REVOKE ALL ON TABLE "eventos_webhook_pagamento"/)
})

test('catálogo, cinco fundadoras e oferta piloto possuem os valores definidos', () => {
  const migration = read('prisma/migrations/20260918190000_asaas_gateway_precos/migration.sql')

  assert.match(migration, /"preco_base" = 397,[\s\S]*WHERE "plano" = 'ESSENCIAL'/)
  assert.match(migration, /"preco_base" = 697,[\s\S]*WHERE "plano" = 'AVANCADO'/)
  assert.match(migration, /"preco_base" = 1290,[\s\S]*WHERE "plano" = 'ENTERPRISE'/)
  assert.match(migration, /'Fundadoras - Essencial'[\s\S]*'FUNDADORAS'[\s\S]*297, 12, 397, 0, 5/)
  assert.match(migration, /'Piloto RPM Truck'[\s\S]*'EMPRESAS_ATIVAS', 'ESSENCIAL', 250, 1, 150, 0, 1/)
})

test('gestão do plano expõe a condição fundadora contratada com transparência', () => {
  const api = read('src/app/api/empresa/assinatura/route.ts')
  const tela = read('src/app/dashboard/empresa/configuracoes/_componentes/SubscriptionManagement.tsx')

  assert.match(api, /promocao: \{ select: \{ nome: true, descricao: true \} \}/)
  assert.match(api, /condicaoComercial: empresa\.promocaoId/)
  assert.match(api, /primeiraMensalidadePaga: Boolean\(empresa\.primeiraMensalidadePagaEm\)/)
  assert.match(tela, /Condição de empresa fundadora/)
  assert.match(tela, /Uma das 5 fundadoras/)
  assert.match(tela, /Pague a primeira mensalidade até o vencimento para concluir a adesão ao plano/)
})

test('promoções são aplicadas no servidor com limite atômico e sem QR estático', () => {
  const company = read('src/app/api/empresas/[id]/route.ts')
  const promotion = read('src/app/api/admin/promocoes/route.ts')
  const ui = read('src/app/dashboard/admin/_modulos/assinaturas/SubscriptionsModule.tsx')

  assert.match(company, /adesoesConfirmadas: \{ lt: promocao\.limiteAdesoes \}/)
  assert.match(company, /COBRANCA_GATEWAY_EMITIDA/)
  assert.match(company, /taxaImplantacaoContratada: promocao\.taxaImplantacao/)
  assert.match(promotion, /request\.json\(\)/)
  assert.doesNotMatch(ui, /cobrancas-pix|QR de promoções existentes|PromotionQrFields/)
})

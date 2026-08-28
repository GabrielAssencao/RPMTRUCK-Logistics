import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const read = (path) => readFileSync(resolve(root, path), 'utf8')

test('contas a pagar permanecem isoladas pela empresa autenticada', () => {
  const collection = read('src/app/api/contas-pagar/route.ts')
  const item = read('src/app/api/contas-pagar/[id]/route.ts')
  const arquivo = read('src/app/api/contas-pagar/[id]/arquivo/route.ts')

  for (const route of [collection, item, arquivo]) assert.match(route, /requireEmpresaAuth\(/)
  assert.match(collection, /empresaId: auth\.empresaId!/)
  assert.match(item, /where: \{ id, empresaId: auth\.empresaId!, status: 'PENDENTE' \}/)
  assert.match(arquivo, /where: \{ id, empresaId: auth\.empresaId! \}/)
})

test('linha digitável é validada e criptografada antes da persistência', () => {
  const route = read('src/app/api/contas-pagar/route.ts')
  const domain = read('src/lib/contasPagar.ts')

  assert.match(route, /linhaDigitavelValida\(linha\)/)
  assert.match(route, /encryptSensitive\(linha, auth\.empresaId!, 'contaPagar\.linhaDigitavel'\)/)
  assert.match(domain, /linha\.length === 47/)
  assert.match(domain, /linha\.length === 48 && linha\.startsWith\('8'\)/)
})

test('upload é limitado no cliente e no servidor e valida assinatura do conteúdo', () => {
  const page = read('src/app/dashboard/empresa/contas-pagar/page.tsx')
  const storage = read('src/lib/contasPagarStorage.ts')

  assert.match(page, /CONTA_PAGAR_MAX_FILE_BYTES/)
  assert.match(storage, /arquivo\.size <= 0 \|\| arquivo\.size > CONTA_PAGAR_MAX_FILE_BYTES/)
  assert.match(storage, /assinaturaValida\(conteudo, arquivo\.type\)/)
  assert.match(storage, /upsert: false/)
})

test('baixa exige comprovante e possui claim atômico contra concorrência', () => {
  const route = read('src/app/api/contas-pagar/[id]/route.ts')

  assert.match(route, /Anexe o comprovante para confirmar a baixa/)
  assert.match(route, /updateMany\(\{[\s\S]*status: 'PENDENTE'/)
  assert.match(route, /if \(resultado\.count !== 1\)/)
  assert.match(route, /TransactionIsolationLevel\.Serializable/)
})

test('bucket financeiro é privado e acessado por URL assinada curta', () => {
  const migration = read('prisma/migrations/20260828010000_contas_pagar_e_baixa_faturas/migration.sql')
  const storage = read('src/lib/contasPagarStorage.ts')

  assert.match(migration, /'contas-pagar'[\s\S]*false,[\s\S]*5242880/)
  assert.match(storage, /createSignedUrl\(caminho, 60\)/)
})

test('troca de plano sincroniza cobrança no servidor sem alterar faturas pagas', () => {
  const company = read('src/app/api/empresas/[id]/route.ts')
  const billing = read('src/lib/faturamentoAdmin.ts')
  const invoice = read('src/app/api/faturas/[id]/route.ts')

  assert.match(company, /sincronizarCobrancaEmpresa\(tx/)
  assert.match(company, /TransactionIsolationLevel\.Serializable/)
  assert.match(billing, /status: 'PENDENTE'/)
  assert.match(invoice, /if \(atual\.status !== 'PENDENTE'\)/)
  assert.match(invoice, /pago_por_id: auth\.session!\.userId/)
})

test('portal financeiro aceita somente HTTPS e não armazena credenciais bancárias', () => {
  const domain = read('src/lib/contasPagar.ts')
  const route = read('src/app/api/empresa/portal-financeiro/route.ts')

  assert.match(domain, /url\.protocol !== 'https:'/)
  assert.match(route, /portal_financeiro_url/)
  assert.doesNotMatch(route, /senha|password|token/i)
})

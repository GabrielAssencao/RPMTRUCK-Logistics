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
  const domain = read('src/lib/financeiro/contasPagar.ts')

  assert.match(route, /linhaDigitavelValida\(linha\)/)
  assert.match(route, /encryptSensitive\(linha, auth\.empresaId!, 'contaPagar\.linhaDigitavel'\)/)
  assert.match(domain, /linha\.length === 47/)
  assert.match(domain, /linha\.length === 44/)
  assert.match(domain, /linha\.length === 48 && linha\.startsWith\('8'\)/)
})

test('upload é limitado no cliente e no servidor e valida assinatura do conteúdo', () => {
  const page = read('src/app/dashboard/empresa/contas-pagar/page.tsx')
  const storage = read('src/lib/financeiro/contasPagarStorage.ts')

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
  const storage = read('src/lib/financeiro/contasPagarStorage.ts')

  assert.match(migration, /'contas-pagar'[\s\S]*false,[\s\S]*5242880/)
  assert.match(storage, /createSignedUrl\(caminho, 60\)/)
})

test('troca de plano sincroniza cobrança no servidor sem alterar faturas pagas', () => {
  const company = read('src/app/api/empresas/[id]/route.ts')
  const billing = read('src/lib/financeiro/faturamentoAdmin.ts')
  const invoice = read('src/app/api/faturas/[id]/route.ts')

  assert.match(company, /sincronizarCobrancaEmpresa\(tx/)
  assert.match(company, /TransactionIsolationLevel\.Serializable/)
  assert.match(billing, /status: 'PENDENTE'/)
  assert.match(invoice, /if \(atual\.status !== 'PENDENTE'\)/)
  assert.match(invoice, /pago_por_id: auth\.session!\.userId/)
})

test('portal financeiro aceita somente HTTPS e não armazena credenciais bancárias', () => {
  const domain = read('src/lib/financeiro/contasPagar.ts')
  const route = read('src/app/api/empresa/portal-financeiro/route.ts')

  assert.match(domain, /url\.protocol !== 'https:'/)
  assert.match(route, /portal_financeiro_url/)
  assert.doesNotMatch(route, /senha|password|token/i)
})

test('módulo de contas a pagar é autorizado independentemente de gestão', () => {
  const collection = read('src/app/api/contas-pagar/route.ts')
  const item = read('src/app/api/contas-pagar/[id]/route.ts')
  const plans = read('src/utils/planos.ts')

  assert.match(collection, /modulo: 'CONTAS_PAGAR'/)
  assert.match(item, /modulo: 'CONTAS_PAGAR'/)
  assert.match(plans, /'CONTAS_PAGAR'/)
})

test('leitura automática exige ateste no servidor e integração de manutenção é multiempresa', () => {
  const route = read('src/app/api/contas-pagar/route.ts')

  assert.match(route, /origemLeitura !== 'MANUAL' && !parsed\.data\.revisado/)
  assert.match(route, /where: \{ id: parsed\.data\.veiculoId, empresaId: auth\.empresaId! \}/)
  assert.match(route, /tx\.historicoVeiculo\.create/)
  assert.match(route, /TransactionIsolationLevel\.Serializable/)
})

test('PDF usa texto e leitura visual com fallback para código de barras', () => {
  const reader = read('src/app/dashboard/empresa/contas-pagar/_utils/leituraBoletoPdf.ts')
  const page = read('src/app/dashboard/empresa/contas-pagar/page.tsx')
  const pkg = read('package.json')

  assert.match(reader, /BarcodeDetector/)
  assert.match(reader, /import\('@zxing\/browser'\)/)
  assert.match(reader, /pagina\.render/)
  assert.match(reader, /codigoBarrasLido/)
  assert.match(reader, /origemLeitura: codigoVisual \? 'CODIGO_BARRAS' : 'PDF_TEXTO'/)
  assert.match(reader, /encontrarLinhaDigitavelEmSegmentos/)
  assert.match(reader, /fornecedorPorPosicao/)
  assert.match(reader, /encontrarLinhaDigitavelEmSegmentos\(segmentos\)/)
  assert.match(page, /dados\.origemLeitura/)
  assert.match(pkg, /"@zxing\/browser"/)
})

test('formulario financeiro limpa dados e invalida leituras assincronas ao fechar', () => {
  const page = read('src/app/dashboard/empresa/contas-pagar/page.tsx')
  const styles = read('src/app/globals.css')

  assert.match(page, /const fecharFormularioCadastro = \(\) =>/)
  assert.match(page, /setForm\(criarEstadoInicial\(\)\)/)
  assert.match(page, /leituraArquivoRef\.current \+= 1/)
  assert.match(styles, /select\.input-financeiro option/)
  assert.match(styles, /color-scheme: dark/)
  assert.match(styles, /color-scheme: light/)
})

test('categorias de boleto alimentam custos, incluindo salários, e acompanham a baixa', () => {
  const schema = read('prisma/schema.prisma')
  const collection = read('src/app/api/contas-pagar/route.ts')
  const item = read('src/app/api/contas-pagar/[id]/route.ts')
  const categories = read('src/lib/financeiro/categoriasContaPagar.ts')
  const migration = read('prisma/migrations/20260828030000_boletos_custos_e_codigo_barras/migration.sql')

  assert.match(schema, /enum CategoriaContaPagar[\s\S]*COMBUSTIVEL[\s\S]*MANUTENCAO[\s\S]*SALARIO[\s\S]*OUTROS/)
  assert.match(schema, /contaPagarId String\?[\s\S]*@unique/)
  assert.match(categories, /Pagamento de salário/)
  assert.match(categories, /requerVeiculo: true/)
  assert.match(collection, /tx\.custo\.create/)
  assert.match(collection, /contaPagarId: contaCriada\.id/)
  assert.match(item, /tx\.custo\.updateMany/)
  assert.match(item, /tx\.custo\.deleteMany/)
  assert.match(migration, /ALTER COLUMN "veiculoId" DROP NOT NULL/)
  assert.match(migration, /INSERT INTO "custos"[\s\S]*WHERE conta\."categoria" = 'MANUTENCAO'/)
})

test('exclusão da empresa exige backup assinado, reautenticação e limpeza recuperável', () => {
  const deletion = read('src/app/api/empresa/exclusao-conta/route.ts')
  const exportRoute = read('src/app/api/empresa/exclusao-conta/exportar/route.ts')

  assert.match(deletion, /validarTokenBackupEmpresa/)
  assert.match(deletion, /verifyPassword/)
  assert.match(deletion, /z\.literal\(CONFIRMACAO\)/)
  assert.match(deletion, /exclusaoEmpresaJob\.create/)
  assert.match(deletion, /PENDENTE_STORAGE/)
  assert.doesNotMatch(exportRoute, /senha_hash:\s*true/)
  assert.match(exportRoute, /where: \{ empresaId \}/)
})

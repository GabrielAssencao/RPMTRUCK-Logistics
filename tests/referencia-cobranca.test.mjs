import test from 'node:test'
import assert from 'node:assert/strict'
import { montarReferenciaCobranca, extrairIdsCobrancaConjunta, somarCentavos, distribuirLiquidoCentavos } from '../src/lib/financeiro/referenciaCobranca.ts'

const implantacao = '11111111-1111-4111-8111-111111111111'
const mensalidade = '22222222-2222-4222-8222-222222222222'

test('a referência conjunta é estável e não aceita duplicatas ou IDs malformados', () => {
  const referencia = montarReferenciaCobranca([mensalidade, implantacao])
  assert.equal(referencia, `bundle:${implantacao}:${mensalidade}`)
  assert.deepEqual(extrairIdsCobrancaConjunta(referencia), [implantacao, mensalidade])
  assert.equal(extrairIdsCobrancaConjunta(`bundle:${implantacao}:${implantacao}`), null)
  assert.equal(extrairIdsCobrancaConjunta(`bundle:${implantacao}:inválido`), null)
  assert.throws(() => montarReferenciaCobranca([implantacao, implantacao]))
})

test('soma e distribui centavos sem duplicar o líquido da cobrança conjunta', () => {
  assert.equal(somarCentavos([250, 150]), 40000)
  assert.deepEqual(distribuirLiquidoCentavos(39801, [250, 150]), [24876, 14925])
  assert.deepEqual(distribuirLiquidoCentavos(null, [250, 150]), [null, null])
})

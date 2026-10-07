import assert from 'node:assert/strict'
import { test } from 'node:test'
import { montarResumoOperacional } from '../src/lib/financeiro/resumoOperacional.ts'

test('separa recebimentos por mês pago e deduz despesas e taxa conhecida sem erro de centavos', () => {
  const resultado = montarResumoOperacional(2026, [
    { mes: '2026-09', recebido: 250, taxasAsaas: 0.99, taxasPendentes: 0 },
    { mes: '2026-10', recebido: 150.10, taxasAsaas: 0, taxasPendentes: 1 },
  ], [
    { mes: '2026-09', despesas: 200.02 },
    { mes: '2026-10', despesas: 60.07 },
  ])

  assert.equal(resultado.meses.length, 12)
  assert.deepEqual(resultado.meses[8], { mes: '2026-09', recebido: 250, taxasAsaas: 0.99, despesas: 200.02, saldo: 48.99, taxasPendentes: 0 })
  assert.equal(resultado.meses[9].saldo, 90.03)
  assert.equal(resultado.meses[7].recebido, 0)
  assert.equal(resultado.recebido, 400.10)
  assert.equal(resultado.despesas, 260.09)
  assert.equal(resultado.taxasAsaas, 0.99)
  assert.equal(resultado.saldo, 139.02)
  assert.equal(resultado.taxasPendentes, 1)
})

test('novo ano começa sem carregar receita e despesas do ano anterior e aceita valores altos', () => {
  const resultado = montarResumoOperacional(2027, [
    { mes: '2026-12', recebido: 9999999.99, taxasAsaas: 0, taxasPendentes: 0 },
    { mes: '2027-01', recebido: 12345678.90, taxasAsaas: 123.45, taxasPendentes: 0 },
  ], [
    { mes: '2027-01', despesas: 2345678.90 },
  ])

  assert.equal(resultado.meses.length, 12)
  assert.equal(resultado.meses[0].recebido, 12345678.90)
  assert.equal(resultado.meses[0].saldo, 9999876.55)
  assert.equal(resultado.meses[11].recebido, 0)
  assert.equal(resultado.recebido, 12345678.90)
})

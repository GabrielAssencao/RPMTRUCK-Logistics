import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { montarInteligenciaFrota } from '../src/lib/inteligenciaFrota.ts'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const read = (path) => readFileSync(resolve(root, path), 'utf8')
const inicio = new Date('2026-01-01T00:00:00.000Z')
const fim = new Date('2026-03-31T23:59:59.000Z')

function base() {
  return {
    veiculos: [{ id: 'v1', placa: 'ABC1D23', modelo: 'Caminhão A', status: 'OPERACIONAL', quilometragem: 12_000 }],
    custos: [],
    leituras: [],
    operacoes: [],
    manutencoes: [],
  }
}

test('calcula custo por quilômetro somente com duas leituras válidas do veículo', () => {
  const dados = base()
  dados.custos = [
    { id: 'c1', data: new Date('2026-02-01'), categoria: 'COMBUSTIVEL', descricao: 'Diesel', valor: 600, veiculoId: 'v1', containerId: null },
  ]
  dados.leituras = [
    { veiculoId: 'v1', quilometragem: 10_000, registradaEm: new Date('2026-01-02') },
    { veiculoId: 'v1', quilometragem: 12_000, registradaEm: new Date('2026-03-20') },
  ]

  const resultado = montarInteligenciaFrota(dados, inicio, fim)
  assert.equal(resultado.desempenhoVeiculos[0].kmRodados, 2_000)
  assert.equal(resultado.desempenhoVeiculos[0].custoPorKm, 0.3)
  assert.equal(resultado.resumo.veiculosComCustoKm, 1)

  dados.leituras.pop()
  const semBase = montarInteligenciaFrota(dados, inicio, fim)
  assert.equal(semBase.desempenhoVeiculos[0].custoPorKm, null)
  assert.equal(semBase.desempenhoVeiculos[0].coberturaKm, 'INSUFICIENTE')
})

test('sinaliza despesa discrepante pela distribuição da própria categoria', () => {
  const dados = base()
  dados.custos = [100, 95, 105, 100, 1_000].map((valor, indice) => ({
    id: `c${indice}`,
    data: new Date(`2026-02-${String(indice + 1).padStart(2, '0')}`),
    categoria: 'PEDAGIO',
    descricao: `Pedágio ${indice}`,
    valor,
    veiculoId: 'v1',
    containerId: null,
  }))

  const resultado = montarInteligenciaFrota(dados, inicio, fim)
  assert.equal(resultado.despesasForaPadrao.length, 1)
  assert.equal(resultado.despesasForaPadrao[0].valor, 1_000)
  assert.ok(resultado.recomendacoes.some((item) => item.id === 'despesas-fora-padrao'))
})

test('rentabilidade é rotulada como saldo conhecido e não presume custos sem vínculo', () => {
  const dados = base()
  dados.operacoes = [{ id: 'o1', codigo: 'CONT-1', data: new Date('2026-02-15'), origem: 'Santos', destino: 'São Paulo', frete: 2_000, comissao: 200, status: 'ENTREGUE', veiculoId: 'v1' }]
  dados.custos = [{ id: 'c1', data: new Date('2026-02-15'), categoria: 'COMISSAO_TRANSPORTE', descricao: 'Comissão', valor: 200, veiculoId: 'v1', containerId: 'o1' }]

  const resultado = montarInteligenciaFrota(dados, inicio, fim)
  assert.equal(resultado.rentabilidadeOperacoes[0].saldoConhecido, 1_800)
  assert.equal(resultado.rentabilidadeOperacoes[0].custosCompletos, false)
  assert.match(resultado.metodologia.saldoConhecido, /Não representa lucro contábil/)
})

test('API exige gestor, deriva empresa da sessão e limita consultas ao tenant', () => {
  const route = read('src/app/api/inteligencia-frota/route.ts')
  assert.match(route, /requireEmpresaAuth\(request, \{ modulo: 'INTELIGENCIA', acao: 'GESTAO' \}\)/)
  assert.match(route, /const empresaId = auth\.session\.empresaId/)
  assert.ok((route.match(/where: \{ empresaId/g) ?? []).length >= 4)
  assert.doesNotMatch(route, /searchParams\.get\('empresaId'\)/)
})

test('navegação expõe a central somente ao gestor com módulo próprio', () => {
  const preferences = read('src/lib/empresaPreferences.ts')
  assert.match(preferences, /inteligencia[^\n]+modulo: 'INTELIGENCIA', somenteGestor: true/)
})

test('planos limitam recursos no servidor e o módulo depende de Frota e Gestão', () => {
  const planos = read('src/utils/planos.ts')
  const route = read('src/app/api/inteligencia-frota/route.ts')
  const admin = read('src/app/api/empresas/[id]/route.ts')
  const migration = read('prisma/migrations/20261006203000_modulo_inteligencia_frota/migration.sql')

  assert.match(planos, /nivel: 'BASICA', mesesMaximos: 3, previsaoManutencao: false/)
  assert.match(planos, /nivel: 'AVANCADA', mesesMaximos: 12, previsaoManutencao: true/)
  assert.match(planos, /nivel: 'COMPLETA', mesesMaximos: 36, previsaoManutencao: true/)
  assert.match(route, /periodo\.data > recursos\.mesesMaximos/)
  assert.match(route, /recursos\.rentabilidadeOperacao \? inteligencia\.rentabilidadeOperacoes : \[\]/)
  assert.match(route, /receitaConhecida: null, saldoConhecido: null/)
  assert.match(admin, /modulos\.includes\('INTELIGENCIA'\)[\s\S]*modulos\.includes\('FROTA'\)[\s\S]*modulos\.includes\('GESTAO'\)/)
  assert.match(migration, /array_append\("modulos", 'INTELIGENCIA'\)/)
})

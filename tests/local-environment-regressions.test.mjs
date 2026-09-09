import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import test from 'node:test'

const verifier = resolve(process.cwd(), 'scripts/verify-local-environment.mjs')

function envText({ project, local = false, invertedPorts = false }) {
  const databaseScheme = ['postgres', 'ql://'].join('')
  const testPassword = ['pass', 'word'].join('')
  return [
    local ? 'LOCAL_ENVIRONMENT="development"' : '',
    `DATABASE_URL="${databaseScheme}postgres.${project}:${testPassword}@pooler.example.test:${invertedPorts ? '5432' : '6543'}/postgres?pgbouncer=true"`,
    `DIRECT_URL="${databaseScheme}postgres.${project}:${testPassword}@db.example.test:${invertedPorts ? '6543' : '5432'}/postgres"`,
    `NEXT_PUBLIC_SUPABASE_URL="https://${project}.supabase.co"`,
    'NEXT_PUBLIC_SUPABASE_ANON_KEY="public-test-key"',
    'SUPABASE_SECRET_KEY="development-secret"',
    'NEXT_PUBLIC_SITE_URL="http://127.0.0.1:5500"',
  ].filter(Boolean).join('\n')
}

function runWith(production, local) {
  const directory = mkdtempSync(resolve(tmpdir(), 'rpmtruck-local-env-'))
  try {
    writeFileSync(resolve(directory, '.env'), production)
    writeFileSync(resolve(directory, '.env.local'), local)
    return spawnSync(process.execPath, [verifier], { cwd: directory, encoding: 'utf8' })
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
}

test('bloqueia o mesmo projeto Supabase usado em produção', () => {
  const result = runWith(envText({ project: 'production' }), envText({ project: 'production', local: true }))
  assert.equal(result.status, 1)
  assert.match(result.stderr, /mesmo projeto configurado em produção/)
})

test('autoriza um projeto de desenvolvimento realmente separado', () => {
  const result = runWith(envText({ project: 'production' }), envText({ project: 'development', local: true }))
  assert.equal(result.status, 0)
  assert.match(result.stdout, /Ambiente local validado/)
})

test('bloqueia arquivo local sem marca explícita de desenvolvimento', () => {
  const result = runWith(envText({ project: 'production' }), envText({ project: 'development' }))
  assert.equal(result.status, 1)
  assert.match(result.stderr, /LOCAL_ENVIRONMENT/)
})

test('bloqueia portas invertidas entre Transaction e Session Pooler', () => {
  const result = runWith(
    envText({ project: 'production' }),
    envText({ project: 'development', local: true, invertedPorts: true }),
  )
  assert.equal(result.status, 1)
  assert.match(result.stderr, /DATABASE_URL.*porta 6543/)
})

test('histórico de migrations cria notificações antes de alterá-las', () => {
  const base = readFileSync(
    resolve(process.cwd(), 'prisma/migrations/20260819005000_criar_notificacoes_base_ausente/migration.sql'),
    'utf8',
  )
  assert.match(base, /CREATE TABLE IF NOT EXISTS "notificacoes"/)
  assert.match(base, /FOREIGN KEY \("empresaId"\).*REFERENCES "empresas"/s)
})

test('histórico de migrations recompõe as estruturas operacionais legadas', () => {
  const base = readFileSync(
    resolve(process.cwd(), 'prisma/migrations/20260820015000_criar_operacional_base_ausente/migration.sql'),
    'utf8',
  )
  assert.match(base, /CREATE TABLE IF NOT EXISTS "localizacoes"/)
  assert.match(base, /CREATE TABLE IF NOT EXISTS "custos"/)
  assert.match(base, /RENAME COLUMN "data" TO "data_agendada"/)
  assert.match(base, /CREATE TYPE "StatusManutencao"/)
})

test('descrição de manutenção permanece opcional também no banco', () => {
  const migration = readFileSync(
    resolve(process.cwd(), 'prisma/migrations/20260908110000_alinhar_descricao_manutencao_opcional/migration.sql'),
    'utf8',
  )
  assert.match(migration, /ALTER COLUMN "descricao" DROP NOT NULL/)
})

test('bootstrap de admin é exclusivo do desenvolvimento e nunca imprime a senha', () => {
  const script = readFileSync(resolve(process.cwd(), 'scripts/create-local-admin.mjs'), 'utf8')
  assert.match(script, /LOCAL_ENVIRONMENT !== 'development'/)
  assert.match(script, /bcrypt\.hash\(password, 12\)/)
  assert.match(script, /role: 'ADMIN_RPM'/)
  assert.match(script, /existing\?\.empresaId/)
  assert.doesNotMatch(script, /stdout\.write\([^\n]*password/)
})

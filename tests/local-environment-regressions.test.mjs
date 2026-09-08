import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import test from 'node:test'

const verifier = resolve(process.cwd(), 'scripts/verify-local-environment.mjs')

function envText({ project, local = false }) {
  const databaseScheme = ['postgres', 'ql://'].join('')
  const testPassword = ['pass', 'word'].join('')
  return [
    local ? 'LOCAL_ENVIRONMENT="development"' : '',
    `DATABASE_URL="${databaseScheme}postgres.${project}:${testPassword}@pooler.example.test:6543/postgres"`,
    `DIRECT_URL="${databaseScheme}postgres.${project}:${testPassword}@db.example.test:5432/postgres"`,
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

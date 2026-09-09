import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const localPath = resolve(process.cwd(), '.env.local')
const productionPath = resolve(process.cwd(), '.env')

function parseEnv(path) {
  if (!existsSync(path)) return new Map()
  const result = new Map()
  for (const rawLine of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const separator = line.indexOf('=')
    if (separator < 1) continue
    const key = line.slice(0, separator).trim()
    let value = line.slice(separator + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    result.set(key, value)
  }
  return result
}

function connectionIdentity(value) {
  try {
    const url = new URL(value)
    return `${url.protocol}//${url.username}@${url.hostname}:${url.port || 'default'}${url.pathname}`
  } catch {
    return null
  }
}

function connectionUrl(value) {
  try {
    return new URL(value)
  } catch {
    return null
  }
}

function fail(message) {
  console.error(`Ambiente local bloqueado: ${message}`)
  process.exitCode = 1
}

if (!existsSync(localPath)) {
  fail('o arquivo .env.local não existe. Copie .env.local.example e use apenas um Supabase de desenvolvimento.')
} else {
  const local = parseEnv(localPath)
  const production = parseEnv(productionPath)
  const required = [
    'DATABASE_URL',
    'DIRECT_URL',
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SECRET_KEY',
  ]
  const missing = required.filter((key) => !local.get(key))

  if (local.get('LOCAL_ENVIRONMENT') !== 'development') {
    fail('defina LOCAL_ENVIRONMENT="development" em .env.local.')
  } else if (missing.length > 0) {
    fail(`faltam variáveis obrigatórias em .env.local: ${missing.join(', ')}.`)
  } else if ([...local.values()].some((value) => /YOUR_|REPLACE_WITH|DEV_(?:POOLER|DATABASE)_HOST/.test(value))) {
    fail('o .env.local ainda contém valores de exemplo.')
  } else {
    const localDatabase = connectionIdentity(local.get('DATABASE_URL'))
    const productionDatabase = connectionIdentity(production.get('DATABASE_URL'))
    const localDirect = connectionIdentity(local.get('DIRECT_URL'))
    const productionDirect = connectionIdentity(production.get('DIRECT_URL'))
    const mesmaBase = Boolean(
      (localDatabase && productionDatabase && localDatabase === productionDatabase)
      || (localDirect && productionDirect && localDirect === productionDirect),
    )
    const mesmoSupabase = Boolean(
      production.get('NEXT_PUBLIC_SUPABASE_URL')
      && local.get('NEXT_PUBLIC_SUPABASE_URL') === production.get('NEXT_PUBLIC_SUPABASE_URL'),
    )

    if (mesmaBase || mesmoSupabase) {
      fail('as credenciais locais apontam para o mesmo projeto configurado em produção.')
    } else {
      const pooledUrl = connectionUrl(local.get('DATABASE_URL'))
      const directUrl = connectionUrl(local.get('DIRECT_URL'))
      const siteUrl = local.get('NEXT_PUBLIC_SITE_URL')
      if (!pooledUrl || pooledUrl.port !== '6543' || pooledUrl.searchParams.get('pgbouncer') !== 'true') {
        fail('DATABASE_URL deve usar o Transaction Pooler na porta 6543 com pgbouncer=true.')
      } else if (!directUrl || directUrl.port !== '5432') {
        fail('DIRECT_URL deve usar a conexão direta ou o Session Pooler na porta 5432.')
      } else if (!['http://127.0.0.1:5500', 'http://localhost:5500'].includes(siteUrl)) {
        fail('NEXT_PUBLIC_SITE_URL deve usar http://127.0.0.1:5500 ou http://localhost:5500.')
      } else {
        console.log('Ambiente local validado: banco isolado e aplicação autorizada na porta 5500.')
      }
    }
  }
}

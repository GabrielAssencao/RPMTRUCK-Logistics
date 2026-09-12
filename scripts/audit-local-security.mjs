// Somente leitura; nunca imprime URLs, tokens, dados pessoais ou credenciais.
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { PrismaClient } from '@prisma/client'

execFileSync(process.execPath, ['scripts/verify-local-environment.mjs'], { stdio: 'inherit' })
if (process.env.LOCAL_ENVIRONMENT !== 'development') throw new Error('Somente desenvolvimento.')
const tables = [...readFileSync('prisma/schema.prisma', 'utf8').matchAll(/@@map\("([a-z_]+)"\)/g)].map(match => match[1])
const prisma = new PrismaClient()
try {
  const results = await prisma.$queryRaw`
    SELECT c.relname AS tabela, c.relrowsecurity AS rls,
      EXISTS (
        SELECT 1 FROM information_schema.role_table_grants g
        WHERE g.table_schema = 'public' AND g.table_name = c.relname
          AND g.grantee IN ('anon', 'authenticated', 'PUBLIC')
      ) AS acesso_direto
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
  `
  const failures = tables.filter(table => {
    const row = results.find(item => item.tabela === table)
    return !row || !row.rls || row.acesso_direto
  })
  console.log(`Tabelas operacionais verificadas: ${tables.length}.`)
  console.log(`Inconsistências RLS/permissões: ${failures.length}.`)
  for (const table of failures) console.log(`Revisar proteção: ${table}`)
  if (failures.length) process.exitCode = 1
  const buckets = await prisma.$queryRaw`
    SELECT id, public FROM storage.buckets
    WHERE id IN ('motoristas-fotos', 'relatorios-privados', 'contas-pagar')
  `
  for (const id of ['motoristas-fotos', 'relatorios-privados', 'contas-pagar']) {
    const bucket = buckets.find(item => item.id === id)
    console.log(`Bucket ${id}: ${!bucket ? 'ausente (configuração pendente)' : bucket.public ? 'PÚBLICO — revisar' : 'privado'}.`)
    if (bucket?.public) process.exitCode = 1
  }
} catch {
  console.error('Auditoria local indisponível. Verifique a conexão e tente novamente.')
  process.exitCode = 1
} finally {
  await prisma.$disconnect()
}

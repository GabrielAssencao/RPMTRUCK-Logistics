import { execFileSync } from 'node:child_process'
import { PrismaClient } from '@prisma/client'
import { mkdir, writeFile } from 'node:fs/promises'

execFileSync(process.execPath, ['scripts/verify-local-environment.mjs'], { stdio: 'inherit' })
if (process.env.LOCAL_ENVIRONMENT !== 'development') throw new Error('Development only.')
const prisma = new PrismaClient()
try {
  const metadata = await prisma.$queryRaw`
    SELECT s.relname AS tabela, s.n_live_tup::int AS registros_estimados,
      (SELECT COUNT(*)::int FROM pg_index i WHERE i.indrelid = s.relid) AS indices
    FROM pg_stat_user_tables s WHERE s.schemaname = 'public'
      AND s.relname IN ('custos', 'mensagens_suporte', 'containers', 'tarefas', 'notificacoes')
  `
  const unread = await prisma.$queryRaw`
    EXPLAIN (ANALYZE, FORMAT JSON) SELECT COUNT(*) FROM public.mensagens_suporte WHERE lida_em IS NULL
  `
  const recentCosts = await prisma.$queryRaw`
    EXPLAIN (ANALYZE, FORMAT JSON) SELECT data, categoria, valor FROM public.custos
    WHERE data >= CURRENT_DATE - INTERVAL '30 days'
  `
  const summarize = rows => {
    const report = rows[0]['QUERY PLAN'][0]
    return { planningMs: report['Planning Time'], executionMs: report['Execution Time'], rootNode: report.Plan['Node Type'] }
  }
  const report = { environment: 'isolated development; read-only; not a production load test', metadata,
    probes: { unreadMessages: summarize(unread), recentCosts: summarize(recentCosts) } }
  await mkdir('docs/performance', { recursive: true })
  await writeFile('docs/performance/database.json', JSON.stringify(report, null, 2) + '\n')
  console.log(JSON.stringify(report))
} catch {
  console.error('Database profiling unavailable. No credentials or operational data logged.')
  process.exitCode = 1
} finally { await prisma.$disconnect() }

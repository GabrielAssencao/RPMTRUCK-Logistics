// Backup da aplicação: somente SELECT/pg_dump na origem. A restauração ocorre
// exclusivamente em um cluster efêmero local, nunca no Supabase existente.
import { spawn, execFileSync } from 'node:child_process'
import { randomBytes, randomUUID } from 'node:crypto'
import { mkdir, readFile, writeFile, rm, unlink } from 'node:fs/promises'
import { resolve, join, relative, isAbsolute } from 'node:path'
import { Prisma, PrismaClient } from '@prisma/client'
import { createClient } from '@supabase/supabase-js'
import { encryptFile, decryptFile, hashFile } from './lib/backup-crypto.mjs'

const option = name => process.argv.find(arg => arg.startsWith(`--${name}=`))?.slice(name.length + 3)
const inspectOnly = process.argv.includes('--inspect')
const projectRoot = resolve('.')
const productionUrl = process.env.DIRECT_URL
if (!productionUrl || !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) throw new Error('Configuração de produção incompleta.')
const connection = new URL(productionUrl)
if (connection.port !== '5432') throw new Error('Use DIRECT_URL com Session Pooler/conexão direta, nunca Transaction Pooler.')
const prisma = new PrismaClient({ datasourceUrl: productionUrl })
const safeIdentifier = value => {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(value)) throw new Error('Identificador de tabela inesperado.')
  return Prisma.raw(`public."${value}"`)
}
const pgEnvironment = {
  ...process.env,
  PGHOST: connection.hostname, PGPORT: connection.port,
  PGUSER: decodeURIComponent(connection.username), PGPASSWORD: decodeURIComponent(connection.password),
  PGDATABASE: decodeURIComponent(connection.pathname.slice(1)), PGSSLMODE: 'require',
  PGCONNECT_TIMEOUT: '20', PGAPPNAME: 'rpmtruck-readonly-backup',
}
// Nunca envia senhas/URLs nos argumentos do processo nem imprime stderr com
// possíveis dados pessoais. Executáveis usam o ambiente libpq restrito.
function run(executable, args, env = process.env) {
  return new Promise((accept, reject) => {
    const child = spawn(executable, args, { env: { ...env, LC_ALL: 'C', LANG: 'C', LANGUAGE: 'C' }, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
    let output = '', diagnostic = ''
    child.stdout.on('data', data => { if (output.length < 1_000_000) output += data })
    child.stderr.on('data', data => { if (diagnostic.length < 100_000) diagnostic += data })
    child.on('error', () => reject(new Error('Ferramenta PostgreSQL indisponível.')))
    // No Windows o servidor pode herdar handles mesmo com pg_ctl -l.
    // Aguarde o processo controlador, não o fechamento dos handles do servidor.
    child.on(executable.endsWith('pg_ctl.exe') ? 'exit' : 'close', code => {
      if (code === 0) return accept(output)
      // Apenas nomes de dependências ausentes; nunca SQL, linhas ou valores.
      const missingSchema = diagnostic.match(/schema "([a-zA-Z_][a-zA-Z0-9_]*)" does not exist/)
      const missingFunction = diagnostic.match(/function ([a-zA-Z_][a-zA-Z0-9_.]*)\(/)
      const missingRole = diagnostic.match(/role "([a-zA-Z_][a-zA-Z0-9_]*)" does not exist/)
      const missingRelation = diagnostic.match(/relation "([a-zA-Z_][a-zA-Z0-9_.]*)" does not exist/)
      const dependency = missingSchema ? ` Schema ausente: ${missingSchema[1]}.` : missingFunction ? ` Função referenciada: ${missingFunction[1]}.` : missingRole ? ` Role ausente: ${missingRole[1]}.` : missingRelation ? ` Relação ausente: ${missingRelation[1]}.` : ''
      const category = /schema "[^"]+" already exists/.test(diagnostic) ? ' Schema já existente no destino.' : ''
      reject(new Error(`${executable.split(/[\\/]/).at(-1)} falhou (código ${code}).${dependency}${category} Dados e credenciais não foram exibidos.`))
    })
  })
}
function outsideRepo(path) {
  const absolute = resolve(path)
  const diff = relative(projectRoot, absolute)
  if (!diff || (!diff.startsWith('..') && !isAbsolute(diff))) throw new Error('Backup e chave devem ficar fora do repositório.')
  return absolute
}
async function privateDirectory(path) {
  await mkdir(path, { recursive: true })
  execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', resolve('scripts/protect-backup-directory.ps1'), '-TargetDirectory', path], { windowsHide: true, stdio: 'pipe' })
}

let workspace, postgresStarted = false, bin, key
try {
  const [version] = await prisma.$queryRaw`SELECT current_setting('server_version') AS version`
  const tables = await prisma.$queryRaw`SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`
  console.log(`PostgreSQL de origem: ${version.version}. Tabelas públicas: ${tables.length}.`)
  if (!inspectOnly) {
    bin = resolve(option('pg-bin') ?? '')
    const backupBase = outsideRepo(option('backup-root') ?? '')
    const recoveryBase = outsideRepo(option('key-root') ?? '')
    const nested = (parent, child) => { const diff = relative(parent, child); return !diff || (!diff.startsWith('..') && !isAbsolute(diff)) }
    if (nested(backupBase, recoveryBase) || nested(recoveryBase, backupBase)) throw new Error('Guarde a chave em uma pasta separada, fora da pasta de backup.')
    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    const backup = join(backupBase, `production-${stamp}`)
    workspace = join(backupBase, `_temporary-${randomUUID()}`)
    await privateDirectory(backupBase)
    await privateDirectory(recoveryBase)
    await mkdir(backup)
    await mkdir(workspace)
    key = randomBytes(32)
    const keyFile = join(recoveryBase, `production-${stamp}.key`)
    await writeFile(keyFile, key.toString('hex'), { flag: 'wx', mode: 0o600 })
    const dump = join(workspace, 'database.dump')
    const manifest = { createdAt: new Date().toISOString(), sourceVersion: version.version, scope: 'public application schema + all Storage objects + encrypted .env', tables: {}, buckets: [], objects: [], files: {} }
    console.log('Criando snapshot consistente do banco (somente leitura)...')
    await prisma.$transaction(async tx => {
      await tx.$executeRaw`SET TRANSACTION READ ONLY`
      const [snapshot] = await tx.$queryRaw`SELECT pg_export_snapshot() AS snapshot`
      for (const { tablename } of tables) {
        const [count] = await tx.$queryRaw(Prisma.sql`SELECT count(*) AS total FROM ${safeIdentifier(tablename)}`)
        manifest.tables[tablename] = String(count.total)
      }
      manifest.buckets = await tx.$queryRaw`SELECT id, name, public, file_size_limit, allowed_mime_types FROM storage.buckets ORDER BY id`
      manifest.objects = await tx.$queryRaw`SELECT id, bucket_id, name, updated_at, metadata FROM storage.objects ORDER BY bucket_id, name`
      await run(join(bin, 'pg_dump.exe'), ['--format=custom', '--schema=public', '--no-owner', '--lock-wait-timeout=30s', `--snapshot=${snapshot.snapshot}`, `--file=${dump}`], pgEnvironment)
    }, { isolationLevel: 'RepeatableRead', maxWait: 30_000, timeout: 1_200_000 })
    manifest.files.database = await encryptFile(dump, join(backup, 'database.dump.enc'), key)
    await unlink(dump)
    manifest.files.environment = await encryptFile(resolve('.env'), join(backup, 'environment.env.enc'), key)
    const storage = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } }).storage
    console.log(`Copiando ${manifest.objects.length} arquivos do Storage...`)
    for (let index = 0; index < manifest.objects.length; index++) {
      const object = manifest.objects[index]
      const result = await storage.from(object.bucket_id).download(object.name)
      if (result.error || !result.data) throw new Error('Arquivo do Storage não pôde ser copiado; backup incompleto.')
      const temporary = join(workspace, 'storage-object')
      await writeFile(temporary, Buffer.from(await result.data.arrayBuffer()), { flag: 'wx' })
      object.backupFile = `object-${index}.enc`
      object.integrity = await encryptFile(temporary, join(backup, object.backupFile), key)
      await unlink(temporary)
      if (object.metadata?.size !== undefined && Number(object.metadata.size) !== object.integrity.bytes) throw new Error('Tamanho de arquivo mudou durante a cópia; refaça o backup em uma janela sem alterações.')
    }
    const objectsAfter = await prisma.$queryRaw`SELECT id, bucket_id, name, updated_at, metadata FROM storage.objects ORDER BY bucket_id, name`
    const originalObjects = manifest.objects.map(object => ({ id: object.id, bucket_id: object.bucket_id, name: object.name, updated_at: object.updated_at, metadata: object.metadata }))
    if (JSON.stringify(originalObjects) !== JSON.stringify(objectsAfter)) throw new Error('Storage mudou durante a cópia; backup não validado.')
    const manifestPath = join(workspace, 'manifest.json')
    await writeFile(manifestPath, JSON.stringify(manifest, (_key, value) => typeof value === 'bigint' ? value.toString() : value, 2))
    await encryptFile(manifestPath, join(backup, 'manifest.json.enc'), key)
    await unlink(manifestPath)

    // Verificação lê a chave persistida, não depende da chave ainda em memória.
    key.fill(0)
    key = Buffer.from((await readFile(keyFile, 'utf8')).trim(), 'hex')
    await decryptFile(join(backup, 'database.dump.enc'), dump, key)
    if (await hashFile(dump) !== manifest.files.database.sha256) throw new Error('Checksum do dump não corresponde.')
    console.log('Restaurando o dump em um cluster efêmero local...')
    const cluster = join(workspace, 'postgres-data')
    const pwfile = join(workspace, 'local-password')
    const localPassword = randomBytes(32).toString('hex')
    await writeFile(pwfile, localPassword, { flag: 'wx' })
    await run(join(bin, 'initdb.exe'), ['-D', cluster, '-U', 'postgres', '--encoding=UTF8', '--locale=C', '--auth=scram-sha-256', `--pwfile=${pwfile}`])
    await unlink(pwfile)
    const net = await import('node:net')
    const probe = net.createServer()
    await new Promise((accept, reject) => { probe.once('error', reject); probe.listen(0, '127.0.0.1', accept) })
    const port = probe.address().port
    await new Promise(accept => probe.close(accept))
    const localEnv = { ...process.env, PGHOST: '127.0.0.1', PGPORT: String(port), PGUSER: 'postgres', PGDATABASE: 'postgres', PGPASSWORD: localPassword, PGSSLMODE: 'disable' }
    // pg_ctl inicia postgres sem janela; apenas loopback e porta exclusiva.
    postgresStarted = true
    await run(join(bin, 'pg_ctl.exe'), ['-D', cluster, '-l', join(workspace, 'postgres.log'), '-o', `-h 127.0.0.1 -p ${port} -c lc_messages=C`, '-w', 'start'], localEnv)
    // O dump recria public. Remove apenas o schema vazio do cluster recém-criado.
    await run(join(bin, 'psql.exe'), ['-X', '-v', 'ON_ERROR_STOP=1', '-c', 'DROP SCHEMA public; CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role; CREATE ROLE supabase_admin; CREATE ROLE authenticator;'], localEnv)
    await run(join(bin, 'pg_restore.exe'), ['--exit-on-error', '--no-owner', '--no-privileges', '--dbname=postgres', dump], localEnv)
    const actualTables = (await run(join(bin, 'psql.exe'), ['-X', '-At', '-c', "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename"], localEnv)).trim().split(/\r?\n/)
    if (JSON.stringify(actualTables) !== JSON.stringify(tables.map(item => item.tablename))) throw new Error('Lista de tabelas restauradas não corresponde.')
    for (const [table, expected] of Object.entries(manifest.tables)) {
      safeIdentifier(table)
      const actual = (await run(join(bin, 'psql.exe'), ['-X', '-At', '-c', `SELECT count(*) FROM public."${table}"`], localEnv)).trim()
      if (actual !== expected) throw new Error('Contagem restaurada não corresponde ao snapshot.')
    }
    // GCM + SHA256 confirmam recuperação de cada anexo sem reupload na origem.
    for (const object of manifest.objects) {
      const temporary = join(workspace, 'verified-object')
      await decryptFile(join(backup, object.backupFile), temporary, key)
      if (await hashFile(temporary) !== object.integrity.sha256) throw new Error('Checksum do Storage não corresponde.')
      await unlink(temporary)
    }
    for (const [encrypted, record] of [['environment.env.enc', manifest.files.environment]]) {
      const temporary = join(workspace, 'verified-environment')
      await decryptFile(join(backup, encrypted), temporary, key)
      if (await hashFile(temporary) !== record.sha256) throw new Error('Checksum do ambiente não corresponde.')
      await unlink(temporary)
    }
    await decryptFile(join(backup, 'manifest.json.enc'), join(workspace, 'verified-manifest'), key)
    await writeFile(join(backup, 'verification.json'), JSON.stringify({ completedAt: new Date().toISOString(), applicationRestore: 'passed', tableCount: tables.length, storageFiles: manifest.objects.length, storageIntegrity: 'passed', environmentIntegrity: 'passed', notes: 'Not a full Supabase platform restore. Copy encrypted backup offsite and keep recovery key separately.' }, null, 2), { flag: 'wx' })
    console.log(`Backup validado: ${backup}`)
    console.log(`Chave de recuperação (não compartilhar): ${keyFile}`)
    console.log('Copie a pasta criptografada para outro local e guarde a chave separadamente. Nenhuma migração/deploy foi executado.')
  }
} catch (error) {
  console.error(error instanceof Error && !('code' in error) ? error.message : 'Backup falhou; origem não foi alterada. Não publique sem investigar.')
  process.exitCode = 1
} finally {
  await prisma.$disconnect()
  key?.fill(0)
  let canRemove = !postgresStarted
  if (postgresStarted) {
    try { await run(join(bin, 'pg_ctl.exe'), ['-D', join(workspace, 'postgres-data'), '-m', 'fast', '-w', 'stop']); canRemove = true } catch { console.error('Cluster temporário não encerrou; arquivos protegidos foram preservados.'); process.exitCode = 1 }
  }
  if (workspace && canRemove) {
    const expectedBase = outsideRepo(option('backup-root'))
    if (resolve(workspace).startsWith(`${expectedBase}\\`) && relative(expectedBase, workspace).startsWith('_temporary-')) {
      await rm(workspace, { recursive: true, force: true })
      console.log('Arquivos temporários em texto claro e cluster de teste removidos.')
    }
  }
}

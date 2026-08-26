import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, extname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const binaryExtensions = new Set(['.glb', '.png', '.wasm', '.ico', '.jpg', '.jpeg', '.webp'])
const patterns = [
  ['private-key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ['aws-access-key', /\bAKIA[0-9A-Z]{16}\b/],
  ['github-token', /\bgh[pousr]_[A-Za-z0-9_]{20,}\b/],
  ['supabase-secret', /\bsb_secret_(?!REPLACE)[A-Za-z0-9_-]{16,}\b/],
  ['database-credential', /postgres(?:ql)?:\/\/(?!USER:PASSWORD@|user:password@localhost)[^\s:@]+:[^\s@]+@/],
]
const findings = []

function inspect(label, path, content) {
  if (binaryExtensions.has(extname(path).toLowerCase())) return
  const sample = Buffer.isBuffer(content) ? content : Buffer.from(content)
  if (sample.subarray(0, 8_192).includes(0)) return
  const text = sample.toString('utf8')
  for (const [kind, pattern] of patterns) {
    if (pattern.test(text)) findings.push(`${kind}: ${label}:${path}`)
  }
}

const worktreeFiles = execFileSync(
  'git',
  ['ls-files', '--cached', '--others', '--exclude-standard', '-z'],
  { cwd: root },
).toString('utf8').split('\0').filter(Boolean)

for (const path of worktreeFiles) {
  const absolute = resolve(root, path)
  if (existsSync(absolute)) inspect('worktree', path, readFileSync(absolute))
}

const objects = execFileSync('git', ['rev-list', '--objects', '--all'], { cwd: root })
  .toString('utf8')
  .split(/\r?\n/)
  .filter(Boolean)
const seen = new Set()

for (const entry of objects) {
  const separator = entry.indexOf(' ')
  if (separator < 0) continue
  const objectId = entry.slice(0, separator)
  const path = entry.slice(separator + 1)
  if (seen.has(objectId) || binaryExtensions.has(extname(path).toLowerCase())) continue
  seen.add(objectId)

  const type = execFileSync('git', ['cat-file', '-t', objectId], { cwd: root }).toString('utf8').trim()
  if (type !== 'blob') continue
  const size = Number(execFileSync('git', ['cat-file', '-s', objectId], { cwd: root }).toString('utf8'))
  if (!Number.isFinite(size) || size > 2 * 1024 * 1024) continue
  inspect(objectId.slice(0, 12), path, execFileSync('git', ['cat-file', '-p', objectId], { cwd: root }))
}

if (findings.length > 0) {
  console.error('Possíveis segredos encontrados (os valores não são exibidos):')
  for (const finding of findings) console.error(`- ${finding}`)
  process.exitCode = 1
} else {
  console.log('Nenhum formato conhecido de segredo foi encontrado na árvore ou no histórico Git.')
}

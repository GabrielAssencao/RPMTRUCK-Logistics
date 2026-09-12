// Recuperação offline: nunca conecta ao banco nem imprime segredos.
import { readFile, mkdir } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { resolve, relative, isAbsolute, join, basename } from 'node:path'
import { decryptFile } from './lib/backup-crypto.mjs'

const option = name => process.argv.find(arg => arg.startsWith(`--${name}=`))?.slice(name.length + 3)
let key
try {
  const input = option('input'), keyFile = option('key'), outputDirectory = option('output-directory')
  if (!input || !keyFile || !outputDirectory) throw new Error('Informe --input, --key e --output-directory.')
  const destination = resolve(outputDirectory)
  const diff = relative(resolve('.'), destination)
  if (!diff || (!diff.startsWith('..') && !isAbsolute(diff))) throw new Error('Recupere os arquivos fora do repositório.')
  const hex = (await readFile(resolve(keyFile), 'utf8')).trim()
  if (!/^[a-f0-9]{64}$/i.test(hex)) throw new Error('Chave inválida.')
  key = Buffer.from(hex, 'hex')
  await mkdir(destination, { recursive: true })
  execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', resolve('scripts/protect-backup-directory.ps1'), '-TargetDirectory', destination], { windowsHide: true, stdio: 'pipe' })
  const output = join(destination, basename(input).replace(/\.enc$/, '') + '.recovered')
  await decryptFile(resolve(input), output, key)
  console.log(`Arquivo recuperado em pasta protegida: ${output}`)
} catch {
  console.error('Recuperação falhou. Confira os caminhos, a chave e a integridade do arquivo. Não use arquivos parciais; nenhum arquivo existente é sobrescrito.')
  process.exitCode = 1
} finally {
  key?.fill(0)
}

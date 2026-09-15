import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import ts from 'typescript'

const nativeRequire = createRequire(import.meta.url)
export function loadTs(file, overrides = {}, cache = new Map()) {
  const path = resolve(file)
  if (cache.has(path)) return cache.get(path)
  const exports = {}
  cache.set(path, exports)
  const source = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText
  const require = name => {
    if (name in overrides) return overrides[name]
    if (name === 'server-only') return {}
    if (name.startsWith('@/')) { if (name.endsWith('.mjs')) return nativeRequire(resolve(`src/${name.slice(2)}`)); return loadTs(`src/${name.slice(2)}.ts`, overrides, cache) }
    return nativeRequire(name)
  }
  new Function('exports', 'require', source)(exports, require)
  return exports
}

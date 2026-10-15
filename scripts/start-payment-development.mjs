import { spawn, spawnSync } from 'node:child_process'
import { createServer } from 'node:net'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

const LOCAL_HOST = '127.0.0.1'
const APP_PORT = 5500
const PROXY_PORT = 5501
const WEBHOOK_PATH = '/api/webhooks/asaas'
const CHECKOUT_RETURN_PATH = '/dashboard/empresa/configuracoes'
const ASAAS_SANDBOX_BASE_URL = 'https://api-sandbox.asaas.com/v3'
const TUNNEL_URL_PATTERN = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/iu
const children = new Set()
let shuttingDown = false

export function extractTunnelUrl(value) {
  return value.match(TUNNEL_URL_PATTERN)?.[0] ?? null
}

export function normalizeApiKey(value) {
  return value?.trim().replace(/^\\\$/, '$') ?? ''
}

export function selectWebhook(webhooks, explicitId = '') {
  if (explicitId) {
    const selected = webhooks.find(webhook => webhook.id === explicitId)
    if (!selected) throw new Error('ASAAS_WEBHOOK_ID não corresponde a um webhook do sandbox.')
    return selected
  }

  const candidates = webhooks.filter(webhook => {
    try {
      const url = new URL(webhook.url)
      return url.protocol === 'https:' && url.pathname === WEBHOOK_PATH && !url.search && !url.hash
    } catch {
      return false
    }
  })
  if (candidates.length === 1) return candidates[0]
  if (candidates.length === 0) {
    throw new Error('Nenhum webhook sandbox existente usa /api/webhooks/asaas. Cadastre-o uma vez no painel do Asaas.')
  }
  throw new Error('Há mais de um webhook sandbox para essa rota. Defina ASAAS_WEBHOOK_ID em .env.local.')
}

function assertSafeEnvironment() {
  if (process.env.LOCAL_ENVIRONMENT !== 'development') {
    throw new Error('Inicialização bloqueada: LOCAL_ENVIRONMENT deve ser development.')
  }
  if (process.env.ASAAS_ENABLED !== 'true' || process.env.ASAAS_ENVIRONMENT !== 'sandbox') {
    throw new Error('Inicialização bloqueada: o Asaas local deve estar habilitado exclusivamente no sandbox.')
  }
  if (!['http://127.0.0.1:5500', 'http://localhost:5500'].includes(process.env.NEXT_PUBLIC_SITE_URL)) {
    throw new Error('Inicialização bloqueada: NEXT_PUBLIC_SITE_URL deve continuar apontando para a porta local 5500.')
  }
  if (normalizeApiKey(process.env.ASAAS_API_KEY).length < 20) throw new Error('ASAAS_API_KEY do sandbox ausente.')
  if ((process.env.ASAAS_WEBHOOK_TOKEN?.trim().length ?? 0) < 32) throw new Error('ASAAS_WEBHOOK_TOKEN ausente ou inseguro.')
}

function assertCloudflaredAvailable() {
  const result = spawnSync('cloudflared', ['--version'], { encoding: 'utf8', windowsHide: true })
  if (result.status !== 0) throw new Error('cloudflared não foi encontrado no PATH.')
  return (result.stdout || result.stderr).trim().split(/\r?\n/u)[0]
}

async function assertPortAvailable(port) {
  await new Promise((resolvePromise, reject) => {
    const server = createServer()
    server.once('error', error => {
      reject(error.code === 'EADDRINUSE'
        ? new Error(`A porta ${port} já está ocupada. Encerre a execução anterior com Ctrl+C antes de iniciar novamente.`)
        : error)
    })
    server.listen(port, LOCAL_HOST, () => server.close(resolvePromise))
  })
}

async function requestAsaas(path, init = {}) {
  const apiKey = normalizeApiKey(process.env.ASAAS_API_KEY)
  const response = await fetch(`${ASAAS_SANDBOX_BASE_URL}${path}`, {
    ...init,
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      access_token: apiKey,
      'user-agent': 'RPMTruck-DevPayments/1.0',
      ...init.headers,
    },
    signal: AbortSignal.timeout(15_000),
  })
  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    const detail = payload?.errors?.map(item => item.description).filter(Boolean).join(' ')
    throw new Error(`Asaas sandbox respondeu HTTP ${response.status}: ${detail || 'erro sem detalhes'}`)
  }
  return payload
}

async function findSandboxWebhook() {
  const payload = await requestAsaas('/webhooks')
  return selectWebhook(payload.data ?? [], process.env.ASAAS_WEBHOOK_ID?.trim())
}

async function updateSandboxWebhook(webhook, publicUrl) {
  const destination = `${publicUrl}${WEBHOOK_PATH}`
  const updated = await requestAsaas(`/webhooks/${encodeURIComponent(webhook.id)}`, {
    method: 'PUT',
    body: JSON.stringify({
      url: destination,
      enabled: true,
      interrupted: false,
      authToken: process.env.ASAAS_WEBHOOK_TOKEN.trim(),
    }),
  })
  if (updated.url !== destination || updated.enabled !== true || updated.interrupted === true) {
    throw new Error('O Asaas não confirmou a configuração esperada do webhook sandbox.')
  }
  return destination
}

function pipeLines(stream, prefix, onText) {
  stream?.on('data', chunk => {
    const text = chunk.toString()
    onText?.(text)
    for (const line of text.split(/\r?\n/u)) {
      if (line.trim()) process.stdout.write(`${prefix} ${line}\n`)
    }
  })
}

function startChild(command, args, prefix, options = {}) {
  const child = spawn(command, args, {
    cwd: process.cwd(),
    env: options.env ?? process.env,
    stdio: ['inherit', 'pipe', 'pipe'],
    windowsHide: true,
  })
  children.add(child)
  pipeLines(child.stdout, prefix, options.onText)
  pipeLines(child.stderr, prefix, options.onText)
  child.once('error', error => {
    if (!shuttingDown) void shutdown(1, `${prefix} não pôde iniciar: ${error.message}`)
  })
  child.once('exit', code => {
    children.delete(child)
    if (!shuttingDown) void shutdown(code || 1, `${prefix} encerrou inesperadamente (código ${code ?? 'desconhecido'}).`)
  })
  return child
}

async function terminateTree(child) {
  if (!child.pid || child.exitCode !== null) return
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true })
  } else {
    child.kill('SIGTERM')
  }
}

async function shutdown(exitCode = 0, reason = '') {
  if (shuttingDown) return
  shuttingDown = true
  if (reason) process.stderr.write(`\n${reason}\n`)
  process.stdout.write('\nEncerrando servidor, proxy e túnel...\n')
  await Promise.all([...children].reverse().map(terminateTree))
  process.exit(exitCode)
}

function startTunnel() {
  return new Promise((resolvePromise, reject) => {
    let settled = false
    let output = ''
    const timeout = setTimeout(() => {
      if (!settled) reject(new Error('O Cloudflare Tunnel não forneceu uma URL em até 30 segundos.'))
    }, 30_000)
    const child = startChild(
      'cloudflared',
      ['tunnel', '--url', `http://${LOCAL_HOST}:${PROXY_PORT}`, '--no-autoupdate'],
      '[TÚNEL]',
      {
        onText(text) {
          output = `${output}${text}`.slice(-4_096)
          const url = extractTunnelUrl(output)
          if (!settled && url) {
            settled = true
            clearTimeout(timeout)
            resolvePromise({ child, url })
          }
        },
      },
    )
  })
}

async function waitForApp() {
  const deadline = Date.now() + 90_000
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://${LOCAL_HOST}:${APP_PORT}/api/planos`, { signal: AbortSignal.timeout(3_000) })
      if (response.ok) return
    } catch {}
    await new Promise(resolvePromise => setTimeout(resolvePromise, 1_000))
  }
  throw new Error('O servidor local não ficou disponível em até 90 segundos.')
}

async function verifyPublicWebhook(publicUrl) {
  const response = await fetch(`${publicUrl}${WEBHOOK_PATH}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{}',
    signal: AbortSignal.timeout(15_000),
  })
  if (response.status !== 401) throw new Error(`O túnel respondeu HTTP ${response.status}; era esperado 401 sem token.`)
}

async function verifyPublicCheckoutReturn(publicUrl) {
  const response = await fetch(`${publicUrl}${CHECKOUT_RETURN_PATH}`, {
    redirect: 'manual',
    signal: AbortSignal.timeout(15_000),
  })
  const expectedLocation = `http://${LOCAL_HOST}:${APP_PORT}${CHECKOUT_RETURN_PATH}`
  if (response.status !== 302 || response.headers.get('location') !== expectedLocation) {
    throw new Error('O retorno público do Checkout não redirecionou para o ambiente local esperado.')
  }
}

async function runCheck() {
  assertSafeEnvironment()
  const version = assertCloudflaredAvailable()
  const webhook = await findSandboxWebhook()
  console.log('Diagnóstico concluído:')
  console.log(`- ${version}`)
  console.log(`- webhook sandbox localizado: ${webhook.name || webhook.id}`)
  console.log(`- destino atual: ${webhook.url}`)
  console.log('- nenhuma configuração foi alterada')
}

async function main() {
  assertSafeEnvironment()
  const version = assertCloudflaredAvailable()
  await Promise.all([assertPortAvailable(APP_PORT), assertPortAvailable(PROXY_PORT)])
  const webhook = await findSandboxWebhook()

  console.log(`Ambiente seguro confirmado. ${version}`)
  startChild(process.execPath, ['scripts/asaas-webhook-proxy.mjs'], '[PROXY]')
  const { url: publicUrl } = await startTunnel()

  const appEnvironment = {
    ...process.env,
    ASAAS_API_KEY: normalizeApiKey(process.env.ASAAS_API_KEY),
    ASAAS_CALLBACK_BASE_URL: publicUrl,
  }
  if (process.platform === 'win32') {
    startChild(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', 'npm.cmd run dev:local'], '[APP]', { env: appEnvironment })
  } else {
    startChild('npm', ['run', 'dev:local'], '[APP]', { env: appEnvironment })
  }

  await waitForApp()
  await verifyPublicWebhook(publicUrl)
  await verifyPublicCheckoutReturn(publicUrl)
  const destination = await updateSandboxWebhook(webhook, publicUrl)

  console.log('\nSistema de pagamentos pronto:')
  console.log(`- aplicação: http://${LOCAL_HOST}:${APP_PORT}`)
  console.log(`- webhook sandbox: ${destination}`)
  console.log('- pressione Ctrl+C para encerrar todos os serviços\n')
}

process.once('SIGINT', () => void shutdown(0))
process.once('SIGTERM', () => void shutdown(0))

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])
if (isMain) {
  const action = process.argv[2]
  Promise.resolve(action === '--check' ? runCheck() : main()).catch(error => shutdown(1, error.message))
}

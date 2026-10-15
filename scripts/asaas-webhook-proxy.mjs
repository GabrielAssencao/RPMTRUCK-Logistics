import http from 'node:http'

const listenHost = '127.0.0.1'
const listenPort = 5501
const targetHost = '127.0.0.1'
const targetPort = 5500
const webhookPath = '/api/webhooks/asaas'
const checkoutReturnPath = '/dashboard/empresa/configuracoes'
const hopByHopHeaders = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
])

const server = http.createServer((request, response) => {
  const url = new URL(request.url ?? '/', `http://${listenHost}:${listenPort}`)

  if (request.method === 'GET' && url.pathname === checkoutReturnPath) {
    response.writeHead(302, {
      Location: `http://${targetHost}:${targetPort}${checkoutReturnPath}`,
      'Cache-Control': 'no-store',
      'Content-Type': 'text/plain; charset=utf-8',
    })
    response.end('Retornando ao ambiente local seguro.')
    return
  }

  if (request.method !== 'POST' || url.pathname !== webhookPath || url.search) {
    response.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
    response.end(JSON.stringify({ erro: 'Rota não disponível.' }))
    return
  }

  const headers = Object.fromEntries(
    Object.entries(request.headers).filter(([name]) => !hopByHopHeaders.has(name.toLowerCase())),
  )
  headers.host = `${targetHost}:${targetPort}`
  headers['x-forwarded-proto'] = 'https'
  if (typeof request.headers['cf-connecting-ip'] === 'string') {
    headers['x-forwarded-for'] = request.headers['cf-connecting-ip']
  }

  const upstream = http.request({
    host: targetHost,
    port: targetPort,
    method: 'POST',
    path: webhookPath,
    headers,
    timeout: 15_000,
  }, upstreamResponse => {
    const responseHeaders = Object.fromEntries(
      Object.entries(upstreamResponse.headers).filter(([name]) => !hopByHopHeaders.has(name.toLowerCase())),
    )
    response.writeHead(upstreamResponse.statusCode ?? 502, responseHeaders)
    upstreamResponse.pipe(response)
  })

  upstream.on('timeout', () => upstream.destroy(new Error('Tempo limite do servidor local excedido.')))
  upstream.on('error', () => {
    if (response.headersSent) response.destroy()
    else {
      response.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
      response.end(JSON.stringify({ erro: 'Webhook local indisponível.' }))
    }
  })

  request.pipe(upstream)
})

server.requestTimeout = 20_000
server.headersTimeout = 10_000
server.listen(listenPort, listenHost, () => {
  console.log(`Proxy restrito do webhook ativo em http://${listenHost}:${listenPort}${webhookPath}`)
})

function shutdown() {
  server.close(() => process.exit(0))
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

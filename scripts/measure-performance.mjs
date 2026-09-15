import { chromium } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import { SignJWT } from 'jose'

// Read-only measurements against the isolated local app. No authenticated data.
if (process.env.LOCAL_ENVIRONMENT !== 'development' || process.env.NEXT_PUBLIC_SITE_URL !== 'http://127.0.0.1:5500') {
  throw new Error('Use the isolated development environment on port 5500.')
}
const label = process.argv[2] || 'current'
if (!/^[a-z0-9-]+$/.test(label)) throw new Error('Invalid measurement label.')
const browser = await chromium.launch()
const results = []
const demoToken = await new SignJWT({ userId: 'performance-demo', email: 'demo@example.invalid', role: 'ADMIN_RPM', sessionVersion: 0 })
  .setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('5m')
  .sign(new TextEncoder().encode(process.env.JWT_SECRET))
try {
  for (const profile of [
    { name: 'desktop', cpu: 1, latency: 0, throughput: -1, width: 1440, height: 1000 },
    { name: 'modest-pc', cpu: 4, latency: 40, throughput: 5_000_000 / 8, width: 1440, height: 1000 },
    { name: 'mobile', cpu: 4, latency: 40, throughput: 5_000_000 / 8, width: 412, height: 915 },
    { name: 'admin', cpu: 4, latency: 40, throughput: 5_000_000 / 8, width: 1440, height: 1000 },
  ]) {
    for (let run = 1; run <= 3; run++) {
      const context = await browser.newContext({ viewport: { width: profile.width, height: profile.height } })
      const page = await context.newPage()
      if (profile.name === 'admin') {
        await context.addCookies([{ name: 'rpmtruck_session', value: demoToken, url: 'http://127.0.0.1:5500', httpOnly: true, sameSite: 'Lax' }])
        const companies = Array.from({ length: 1000 }, (_, index) => ({
          id: `demo-${index}`, nome: `Demo ${index}`, status: 'ATIVO', plano: 'ESSENCIAL',
          criado_em: new Date(2026, index % 9, 1).toISOString(), mensalidade: 200,
        }))
        await context.route('**/api/**', route => {
          const path = new URL(route.request().url()).pathname
          const body = path === '/api/empresas' ? companies
            : path === '/api/admin/stats' ? { resumo: { receitaTotal: 200000, solicitacoesPendentes: 0 } }
            : { tickets: [], resumo: { mensagensNaoLidas: 0 }, naoLidas: 0, pendenciasPorModulo: {}, alertas: [] }
          return route.fulfill({ json: body })
        })
      }
      const session = await context.newCDPSession(page)
      await session.send('Network.enable')
      await session.send('Network.setCacheDisabled', { cacheDisabled: true })
      await session.send('Emulation.setCPUThrottlingRate', { rate: profile.cpu })
      await session.send('Network.emulateNetworkConditions', {
        offline: false, latency: profile.latency,
        downloadThroughput: profile.throughput, uploadThroughput: profile.throughput,
      })
      const resources = new Map()
      session.on('Network.responseReceived', event => resources.set(event.requestId, {
        path: new URL(event.response.url).pathname, type: event.type, bytes: 0,
      }))
      session.on('Network.loadingFinished', event => {
        const resource = resources.get(event.requestId)
        if (resource) resource.bytes = event.encodedDataLength
      })
      const errors = []
      page.on('pageerror', error => errors.push(error.message))
      await page.addInitScript(() => {
        window.__measurement = { lcp: 0, cls: 0, blocking: 0, lcpElement: '' }
        new PerformanceObserver(list => {
          for (const entry of list.getEntries()) {
            window.__measurement.lcp = entry.startTime
            window.__measurement.lcpElement = entry.element?.tagName || ''
          }
        }).observe({ type: 'largest-contentful-paint', buffered: true })
        new PerformanceObserver(list => {
          for (const entry of list.getEntries()) if (!entry.hadRecentInput) window.__measurement.cls += entry.value
        }).observe({ type: 'layout-shift', buffered: true })
        new PerformanceObserver(list => {
          for (const entry of list.getEntries()) window.__measurement.blocking += Math.max(0, entry.duration - 50)
        }).observe({ type: 'longtask', buffered: true })
      })
      await page.goto(`http://127.0.0.1:5500/${profile.name === 'admin' ? 'dashboard/admin' : ''}`, { waitUntil: 'load' })
      if (profile.name === 'admin') await page.getByText('RECEITA TOTAL', { exact: true }).waitFor()
      await page.waitForTimeout(2500)
      const timing = await page.evaluate(() => {
        const navigation = performance.getEntriesByType('navigation')[0]
        const fcp = performance.getEntriesByName('first-contentful-paint')[0]
        return { ...window.__measurement, fcp: fcp?.startTime || 0,
          ttfb: navigation.responseStart, load: navigation.loadEventEnd,
          canvasCount: document.querySelectorAll('canvas').length,
        }
      })
      const downloaded = [...resources.values()]
      const result = { profile: profile.name, run, ...timing,
        transferBytes: downloaded.reduce((sum, item) => sum + item.bytes, 0),
        jsBytes: downloaded.filter(item => item.type === 'Script').reduce((sum, item) => sum + item.bytes, 0),
        modelRequests: downloaded.filter(item => /\.(glb|wasm)$/.test(item.path)).length,
        resources: downloaded, errors,
      }
      results.push(result)
      console.log(`${profile.name} ${run}: LCP=${timing.lcp.toFixed(0)}ms FCP=${timing.fcp.toFixed(0)}ms CLS=${timing.cls.toFixed(3)} JS=${Math.round(result.jsBytes / 1024)}KiB`)
      if (run === 1) {
        await mkdir('test-results/performance', { recursive: true })
        await page.screenshot({ path: `test-results/performance/${label}-${profile.name}.png` })
      }
      await context.close()
    }
  }
} finally { await browser.close() }
await mkdir('docs/performance', { recursive: true })
await writeFile(`docs/performance/${label}.json`, JSON.stringify({
  mode: 'optimized production build, isolated local database',
  profiles: 'cold browser cache; modest-pc/mobile: CPU 4x slowdown, 5 Mbps, 40 ms latency',
  adminData: '1000 synthetic companies; all authenticated APIs intercepted, no operational data read',
  results,
}, null, 2) + '\n')

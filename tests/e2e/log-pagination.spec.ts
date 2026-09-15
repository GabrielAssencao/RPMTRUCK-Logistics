import { expect, test } from '@playwright/test'
import { SignJWT } from 'jose'

test('logs avançam, voltam e reiniciam a página ao filtrar empresa', async ({ page, context, isMobile }) => {
  test.skip(isMobile || !process.env.JWT_SECRET || process.env.LOCAL_ENVIRONMENT !== 'development', 'Fixture de navegação desktop no ambiente isolado.')
  const token = await new SignJWT({ userId: 'synthetic-browser-fixture', email: 'fixture@example.invalid', role: 'ADMIN_RPM', sessionVersion: 0 }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('5m').sign(new TextEncoder().encode(process.env.JWT_SECRET))
  await context.addCookies([{ name: 'rpmtruck_session', value: token, url: 'http://127.0.0.1:5500', httpOnly: true, sameSite: 'Lax' }])
  await context.route('**/api/**', route => {
    const url = new URL(route.request().url())
    if (url.pathname === '/api/admin/seguranca') {
      const pagina = Number(url.searchParams.get('paginaEVENTOS') || 1)
      return route.fulfill({ json: {
        resumo: { sessoesAtivas: 0, falhasLogin24h: 0, bloqueiosRateLimit24h: 0 }, empresas: [], sessoes: [], auditoria: [], exclusoes: [],
        eventos: Array.from({ length: pagina === 1 ? 20 : 3 }, (_, index) => ({ id: `${pagina}-${index}`, tipo: `Evento ${pagina}-${index}`, criadoEm: '2026-09-14T12:00:00Z', ipCorrelacao: null, usuario: null, empresa: null })),
        paginacao: { SESSOES: { pagina: 1, temProxima: false }, EVENTOS: { pagina, temProxima: pagina === 1 }, AUDITORIA: { pagina: 1, temProxima: false }, EXCLUSOES: { pagina: 1, temProxima: false } },
      } })
    }
    return route.fulfill({ json: { tickets: [], resumo: { mensagensNaoLidas: 0 }, naoLidas: 0, pendenciasPorModulo: {}, alertas: [] } })
  })
  await page.goto('/dashboard/admin')
  await page.locator('aside').hover()
  await page.getByRole('button', { name: /LOGS \/ SEGURANÇA/ }).click()
  const nav = page.getByRole('navigation', { name: 'Paginação: Eventos de segurança' })
  await expect(page.getByRole('cell', { name: 'Evento 1-0', exact: true })).toBeVisible()
  await expect(nav.getByRole('button', { name: 'Anterior' })).toBeDisabled()
  await nav.getByRole('button', { name: 'Próxima' }).click()
  await expect(page.getByRole('cell', { name: 'Evento 2-0', exact: true })).toBeVisible()
  await expect(page.getByRole('cell', { name: 'Evento 1-0', exact: true })).toHaveCount(0)
  await expect(nav.getByRole('button', { name: 'Próxima' })).toBeDisabled()
  await nav.getByRole('button', { name: 'Anterior' }).click()
  await expect(page.getByRole('cell', { name: 'Evento 1-0', exact: true })).toBeVisible()
  await nav.getByRole('button', { name: 'Próxima' }).click()
  await expect(page.getByRole('cell', { name: 'Evento 2-0', exact: true })).toBeVisible()
  await page.getByLabel('Filtrar logs por empresa').selectOption('SISTEMA')
  await expect(page.getByRole('cell', { name: 'Evento 1-0', exact: true })).toBeVisible()
  await expect(nav.getByRole('button', { name: 'Anterior' })).toBeDisabled()
})

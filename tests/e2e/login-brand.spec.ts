import { expect, test } from '@playwright/test'

test('login sem download usa a marca e mantém as etapas do formulário', async ({ page, isMobile }) => {
  const models: string[] = []
  page.on('request', request => { if (/\.glb(?:\?|$)/.test(request.url())) models.push(request.url()) })
  await page.goto('/auth/login')
  await expect(page.getByRole('link', { name: 'RPMTruck — início' })).toBeVisible()
  await expect(page.locator('canvas')).toHaveCount(0)
  if (!isMobile) {
    const card = page.locator('[data-login-profile="usuario"]')
    await expect(card).toHaveAttribute('data-login-profile', 'usuario')
    await card.hover()
    await expect(card.locator('svg')).toBeVisible()
    await expect(card).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
    await expect(card).toHaveCSS('border-top-width', '0px')
  }
  await page.getByLabel('E-mail', { exact: true }).fill('demo@example.com')
  await page.getByRole('button', { name: /CONTINUAR/ }).click()
  await expect(page.getByRole('button', { name: /ENTRAR/ })).toBeVisible()
  expect(models).toEqual([])
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})

for (const perfil of [
  { role: 'OPERADOR', icon: 'equipe', destination: 'empresa' },
  { role: 'ADMIN_RPM', icon: 'admin', destination: 'admin' },
]) {
  test(`perfil ${perfil.role} aparece somente após autenticação`, async ({ page }) => {
    const reduced = await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)
    test.skip(reduced, 'Com movimento reduzido, o encaminhamento é imediato.')
    await page.route('**/api/auth/login', route => route.fulfill({ json: { usuario: { id: 'demo', role: perfil.role } } }))
    await page.route(`**/dashboard/${perfil.destination}**`, route => route.fulfill({ contentType: 'text/html', body: '<html><body>Demo</body></html>' }))
    await page.goto('/auth/login')
    await page.getByLabel('E-mail', { exact: true }).fill('demo@example.com')
    await page.getByRole('button', { name: /CONTINUAR/ }).click()
    await expect(page.locator(`[data-login-profile="${perfil.icon}"]`)).toHaveCount(0)
    await page.locator('input[type="password"]').fill('SenhaDeDemonstracao!2026')
    await page.getByRole('button', { name: /ENTRAR/ }).click()
    await expect(page.locator(`[data-login-profile="${perfil.icon}"]`)).toBeVisible()
    await expect(page).toHaveURL(new RegExp(`/dashboard/${perfil.destination}`))
  })
}

test('ativar sem confirmar o download mantém o login sem caminhão', async ({ page, isMobile }) => {
  test.skip(isMobile, 'A experiência 3D é oferecida no desktop.')
  const models: string[] = []
  page.on('request', request => { if (/\.glb(?:\?|$)/.test(request.url())) models.push(request.url()) })
  await page.goto('/')
  const aviso = page.getByRole('button', { name: 'Entendi', exact: true })
  if (await aviso.isVisible()) await aviso.click()
  await page.getByRole('button', { name: 'Ativar experiência 3D' }).click()
  await expect(page.getByRole('button', { name: 'Baixar e ativar' })).toBeVisible()
  await page.getByRole('link', { name: 'Fazer login', exact: true }).click()
  await expect(page.getByLabel('E-mail', { exact: true })).toBeVisible()
  await expect(page.locator('canvas')).toHaveCount(0)
  expect(models).toEqual([])
})

test('entrada aparece após autenticação e encaminha ao painel', async ({ page }) => {
  let requests = 0
  await page.route('**/api/auth/login', async route => {
    requests++
    await route.fulfill({ json: { usuario: { id: 'demo', nome: 'Demonstração', role: 'GESTOR_EMPRESA' } } })
  })
  await page.route('**/dashboard/empresa**', route => route.fulfill({ contentType: 'text/html', body: '<html><body>Painel de demonstração</body></html>' }))
  await page.goto('/auth/login')
  await page.getByLabel('E-mail', { exact: true }).fill('demo@example.com')
  await page.getByRole('button', { name: /CONTINUAR/ }).click()
  await page.locator('input[type="password"]').fill('SenhaDeDemonstracao!2026')
  await page.getByRole('button', { name: /ENTRAR/ }).evaluate(button => { (button as HTMLButtonElement).click(); (button as HTMLButtonElement).click() })
  const reduced = await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)
  if (!reduced) await expect(page.getByRole('heading', { name: 'Acesso confirmado' })).toBeVisible()
  await expect(page).toHaveURL(/\/dashboard\/empresa/)
  expect(requests).toBe(1)
})

test('falha na autenticação preserva senha e não inicia a entrada', async ({ page }) => {
  await page.route('**/api/auth/login', route => route.fulfill({ status: 401, json: { erro: 'Credenciais não conferem.' } }))
  await page.goto('/auth/login')
  await page.getByLabel('E-mail', { exact: true }).fill('demo@example.com')
  await page.getByRole('button', { name: /CONTINUAR/ }).click()
  await page.locator('input[type="password"]').fill('SenhaDeDemonstracao!2026')
  await page.getByRole('button', { name: /ENTRAR/ }).click()
  await expect(page.getByText('Credenciais não conferem.')).toBeVisible()
  await expect(page.locator('input[type="password"]')).toHaveValue('SenhaDeDemonstracao!2026')
  await expect(page.getByRole('heading', { name: 'Acesso confirmado' })).toHaveCount(0)
  await expect(page).toHaveURL(/\/auth\/login/)
})

test('login autenticado continua quando o navegador bloqueia o armazenamento local', async ({ page }) => {
  await page.addInitScript(() => {
    const originalSetItem = Storage.prototype.setItem
    Storage.prototype.setItem = function (key, value) {
      if (key === '@rpmtruck:user') throw new DOMException('Storage blocked', 'SecurityError')
      return originalSetItem.call(this, key, value)
    }
  })
  await page.route('**/api/auth/login', route => route.fulfill({ json: { usuario: { id: 'demo', role: 'GESTOR_EMPRESA' } } }))
  await page.route('**/dashboard/empresa**', route => route.fulfill({ contentType: 'text/html', body: '<html><body>Demo</body></html>' }))
  await page.goto('/auth/login')
  await page.getByLabel('E-mail', { exact: true }).fill('demo@example.com')
  await page.getByRole('button', { name: /CONTINUAR/ }).click()
  await page.locator('input[type="password"]').fill('SenhaDeDemonstracao!2026')
  await page.getByRole('button', { name: /ENTRAR/ }).click()
  await expect(page).toHaveURL(/\/dashboard\/empresa/)
})

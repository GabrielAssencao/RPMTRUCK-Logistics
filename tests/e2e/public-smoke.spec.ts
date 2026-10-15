import { expect, test } from '@playwright/test'

test.describe('rotas públicas essenciais', () => {
  test('landing permanece utilizável quando as estatísticas estão indisponíveis', async ({ page }) => {
    const erros: string[] = []
    page.on('pageerror', error => erros.push(error.message))
    page.on('console', message => {
      if (message.type() === 'error' && /estatísticas|landing/i.test(message.text())) erros.push(message.text())
    })
    await page.route('**/api/stats', route => route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ erro: 'Estatísticas temporariamente indisponíveis.' }),
    }))
    const resposta = page.waitForResponse('**/api/stats')
    await page.goto('/')
    expect((await resposta).status()).toBe(503)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    expect(erros).toEqual([])
  })

  test('login permanece acessível e utilizável', async ({ page }) => {
    await page.goto('/auth/login')

    const email = page.getByLabel('E-mail')
    const continuar = page.getByRole('button', { name: /continuar/i })
    await expect(email).toBeVisible()
    await expect(email).toHaveCSS('padding-top', '12px')
    await expect(email).toHaveCSS('padding-left', '16px')
    await expect(continuar).toBeDisabled()
    await expect(continuar).toHaveCSS('padding-top', '16px')
    await expect(continuar).toHaveCSS('font-weight', '900')
  })

  test('política de privacidade permanece acessível', async ({ page }) => {
    await page.goto('/privacidade')

    await expect(page.getByRole('heading', { level: 1, name: 'Política de Privacidade' })).toBeVisible()
    await expect(page.getByRole('navigation', { name: 'Sumário do documento' })).toBeVisible()
  })
})

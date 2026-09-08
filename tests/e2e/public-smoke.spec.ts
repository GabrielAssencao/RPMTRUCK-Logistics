import { expect, test } from '@playwright/test'

test.describe('rotas públicas essenciais', () => {
  test('login permanece acessível e utilizável', async ({ page }) => {
    await page.goto('/auth/login')

    await expect(page.getByLabel('E-mail')).toBeVisible()
    await expect(page.getByRole('button', { name: /continuar/i })).toBeDisabled()
  })

  test('política de privacidade permanece acessível', async ({ page }) => {
    await page.goto('/privacidade')

    await expect(page.getByRole('heading', { level: 1, name: 'Política de Privacidade' })).toBeVisible()
    await expect(page.getByRole('navigation', { name: 'Sumário do documento' })).toBeVisible()
  })
})

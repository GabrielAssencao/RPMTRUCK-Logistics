import { expect, test } from '@playwright/test'

test('cartas navegam sem carregar o modelo 3D e funcionam pelo teclado', async ({ page }) => {
  const modelos: string[] = []
  const erros: string[] = []
  page.on('request', request => { if (/\.glb(?:\?|$)/.test(request.url())) modelos.push(request.url()) })
  page.on('pageerror', error => erros.push(error.message))
  await page.goto('/')
  const aviso = page.getByRole('button', { name: 'Entendi', exact: true })
  if (await aviso.isVisible()) await aviso.click()
  const preview = page.getByRole('region', { name: 'Prévia do sistema', exact: true })
  const fractal = preview.locator('[data-fractal-background]')
  await expect(fractal).toBeVisible()
  const reduced = await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)
  await expect.poll(() => fractal.locator('g').first().evaluate(layer => getComputedStyle(layer).animationName === 'none')).toBe(reduced)
  await expect(preview.getByRole('heading')).toHaveText('A operação em uma visão.')
  await preview.getByRole('button', { name: 'Próxima tela' }).click()
  await expect(preview.getByRole('heading')).toHaveText('Uma equipe, na mesma direção.')
  await preview.getByRole('button', { name: 'Próxima tela' }).click()
  await expect(preview.getByRole('heading')).toHaveText('O próximo passo, no seu radar.')
  await preview.getByRole('button', { name: 'Próxima tela' }).press('ArrowRight')
  await expect(preview.getByRole('heading')).toHaveText('Cada carga, sob controle.')
  await expect.poll(() => preview.locator('article[aria-hidden="false"] img').evaluate(image => (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0)).toBe(true)
  await preview.getByRole('button', { name: 'Próxima tela' }).press('ArrowRight')
  await expect(preview.getByRole('heading')).toHaveText('Mais clareza em cada despesa.')
  await expect.poll(() => preview.locator('article[aria-hidden="false"] img').evaluate(image => (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0)).toBe(true)
  await preview.getByRole('button', { name: 'Próxima tela' }).press('ArrowRight')
  await expect(preview.getByRole('heading')).toHaveText('A operação em uma visão.')
  await preview.getByRole('button', { name: 'Tela anterior' }).click()
  await expect(preview.getByRole('heading')).toHaveText('Mais clareza em cada despesa.')
  await expect.poll(() => preview.locator('article[aria-hidden="false"] img').evaluate(image => (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0)).toBe(true)
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  expect(modelos).toEqual([])
  expect(erros).toEqual([])
})

test('marca e favicon acompanham a cor e o modo claro', async ({ page }) => {
  await page.goto('/')
  const roxo = page.getByRole('button', { name: 'Selecionar tema Roxo', exact: true })
  if (await roxo.isVisible()) {
    await roxo.click()
    await expect.poll(() => page.locator('link[rel="icon"]').getAttribute('href')).toContain('favicon-5e17eb.svg')
    await expect.poll(() => page.locator('nav svg path').first().evaluate(path => getComputedStyle(path).fill)).toBe('rgb(94, 23, 235)')
  }
  await page.getByRole('button', { name: 'Alternar tema', exact: true }).click()
  await expect(page.locator('html')).toHaveClass(/light/)
  await expect.poll(() => page.locator('nav svg path[fill="var(--foreground)"]').first().evaluate(path => getComputedStyle(path).fill)).toBe('rgb(10, 10, 10)')
})

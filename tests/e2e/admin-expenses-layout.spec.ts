import { expect, test } from '@playwright/test'
import { SignJWT } from 'jose'

test('painel preserva os gráficos e despesas ficam em uma aba própria', async ({ page, context, isMobile }) => {
  test.skip(!process.env.JWT_SECRET || process.env.LOCAL_ENVIRONMENT !== 'development', 'Navegação no ambiente local isolado.')

  const token = await new SignJWT({ userId: 'synthetic-browser-fixture', email: 'fixture@example.invalid', role: 'ADMIN_RPM', sessionVersion: 0, mfaVerified: true })
    .setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('5m')
    .sign(new TextEncoder().encode(process.env.JWT_SECRET))
  await context.addCookies([{ name: 'rpmtruck_session', value: token, url: 'http://127.0.0.1:5500', httpOnly: true, sameSite: 'Lax' }])

  await context.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname
    if (path === '/api/empresas') return route.fulfill({ json: [] })
    if (path === '/api/admin/stats') return route.fulfill({ json: {
      resumo: { solicitacoesPendentes: 0, receitaTotal: '250.00' },
      financeiro: { ano: new Date().getFullYear(), recebido: 250, despesas: 50, taxasAsaas: 0.99, saldo: 199.01,
        meses: Array.from({ length: 12 }, (_, index) => ({ mes: `${new Date().getFullYear()}-${String(index + 1).padStart(2, '0')}`, recebido: index === 8 ? 250 : 0, despesas: index === 8 ? 50 : 0, taxasAsaas: index === 8 ? 0.99 : 0 })) },
    } })
    if (path === '/api/admin/despesas') return route.fulfill({ json: { despesas: [], total: 0, pagina: 1, porPagina: 20 } })
    return route.fulfill({ json: { tickets: [], notificacoes: [], resumo: { mensagensNaoLidas: 0 }, pendenciasPorModulo: {}, alertas: [] } })
  })

  await page.goto('/dashboard/admin')
  await expect(page.getByText('ASSINATURAS RECENTES')).toBeVisible()
  await expect(page.getByText('Entradas e saídas por mês')).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Novo lançamento' })).toHaveCount(0)

  const navegar = async (nome: string) => {
    if (isMobile) {
      await page.getByRole('button', { name: 'Abrir menu do Superadmin' }).click()
      await page.getByRole('dialog', { name: 'Menu do Superadmin' }).getByRole('button', { name: nome }).click()
    } else {
      await page.locator('aside').hover()
      await page.locator('aside').getByRole('button', { name: nome }).click()
    }
  }

  await navegar('DESPESAS DO SISTEMA')
  await expect(page.getByRole('heading', { name: 'Despesas do sistema' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Novo lançamento' })).toBeVisible()
  await expect(page.getByText('ASSINATURAS RECENTES')).toHaveCount(0)

  await navegar('PAINEL MASTER')
  await expect(page.getByText('ASSINATURAS RECENTES')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Novo lançamento' })).toHaveCount(0)
})

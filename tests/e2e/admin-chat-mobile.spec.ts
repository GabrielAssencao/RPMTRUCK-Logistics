import { expect, test } from '@playwright/test'
import { SignJWT } from 'jose'

test('chamados do Superadmin usam navegação fila e detalhe no celular', async ({ page, context, isMobile }) => {
  test.skip(!isMobile || !process.env.JWT_SECRET || process.env.LOCAL_ENVIRONMENT !== 'development', 'Fluxo exclusivo do painel móvel no ambiente local isolado.')

  const token = await new SignJWT({ userId: 'synthetic-browser-fixture', email: 'fixture@example.invalid', role: 'ADMIN_RPM', sessionVersion: 0, mfaVerified: true })
    .setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('5m')
    .sign(new TextEncoder().encode(process.env.JWT_SECRET))
  await context.addCookies([{ name: 'rpmtruck_session', value: token, url: 'http://127.0.0.1:5500', httpOnly: true, sameSite: 'Lax' }])

  const ticket = {
    id: 'ticket-mobile-1',
    protocolo: 'SUP-MOBILE-001',
    assunto: 'Dúvida sobre fechamento mensal',
    categoria: 'DUVIDA',
    status: 'ABERTO',
    prioridade: 'NORMAL',
    origem: 'EMPRESA',
    classificacaoCobranca: 'ATENDIMENTO',
    respostasEmpresaHabilitadas: true,
    cobravelExtra: false,
    ordemNaCompetencia: 1,
    franquiaNoMomento: 5,
    naoLidas: 1,
    empresa: { id: 'empresa-mobile-1', nome: 'Transportes Horizonte' },
    abertoPor: { id: 'gestor-mobile-1', nome: 'Maria Gestora', role: 'GESTOR_EMPRESA' },
    ultimaMensagem: { conteudo: 'Preciso de ajuda para concluir o fechamento.' },
  }

  await context.route('**/api/**', route => {
    const url = new URL(route.request().url())
    if (url.pathname === '/api/admin/chat' && url.searchParams.get('resumo') !== 'true') {
      return route.fulfill({ json: {
        tickets: [ticket],
        empresas: [{ id: ticket.empresa.id, nome: ticket.empresa.nome, status: 'ATIVO', plano: 'ESSENCIAL' }],
        resumo: { ticketsAtivos: 1, mensagensNaoLidas: 1, extrasNoMes: 0, bugsConfirmadosNoMes: 0 },
      } })
    }
    if (url.pathname === '/api/chat') {
      return route.fulfill({ json: {
        mensagens: [{
          id: 'mensagem-mobile-1', conteudo: 'Preciso de ajuda para concluir o fechamento.', tipo: 'USUARIO', automatica: false,
          visibilidade: 'TODOS', criado_em: '2026-10-15T12:00:00.000Z', lida_em: null, editado_em: null,
          autor: { id: 'gestor-mobile-1', nome: 'Maria Gestora', role: 'GESTOR_EMPRESA' },
        }],
      } })
    }
    return route.fulfill({ json: { tickets: [], notificacoes: [], resumo: { mensagensNaoLidas: 0 }, pendenciasPorModulo: {}, alertas: [] } })
  })

  await page.goto('/dashboard/admin')
  await page.getByRole('button', { name: 'Abrir suporte e tickets' }).click()
  await expect(page.getByRole('heading', { name: 'CONVERSAS DAS EMPRESAS' })).toBeVisible()

  const fila = page.getByLabel('Fila de chamados')
  await expect(fila).toBeVisible()
  await fila.getByRole('button', { name: /Transportes Horizonte/ }).click()

  await expect(fila).toBeHidden()
  await expect(page.getByTestId('admin-ticket-detail')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Fila', exact: true })).toBeFocused()
  await expect(page.getByText('Preciso de ajuda para concluir o fechamento.', { exact: true })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)

  await page.getByRole('button', { name: 'Fila', exact: true }).click()
  await expect(fila).toBeVisible()
  await expect(page.getByTestId('admin-ticket-detail')).toHaveCount(0)
})

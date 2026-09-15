import { expect, test, type BrowserContext } from '@playwright/test'
import { SignJWT } from 'jose'

const empresaId = '11111111-1111-4111-8111-111111111111'
const checksum = 'a'.repeat(64)
const resumo = { Localizacoes: 0, Veiculos: 1, Motoristas: 0, Custos: 0, Manutencoes: 0, Containers: 0 }
test.beforeEach(() => { test.skip(!process.env.JWT_SECRET || process.env.LOCAL_ENVIRONMENT !== 'development', 'Authenticated fixtures require the isolated local environment.') })
async function session(context: BrowserContext, admin = false) {
  const token = await new SignJWT({ userId: 'synthetic-browser-fixture', email: 'fixture@example.invalid', role: admin ? 'ADMIN_RPM' : 'GESTOR_EMPRESA', ...(admin ? {} : { empresaId }), sessionVersion: 0 }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('5m').sign(new TextEncoder().encode(process.env.JWT_SECRET))
  await context.addCookies([{ name: 'rpmtruck_session', value: token, url: 'http://127.0.0.1:5500', httpOnly: true, sameSite: 'Lax' }])
}

test('empresa envia planilha, recebe orientação de correção e acompanha a revisão', async ({ page, context }) => {
  await session(context)
  let pending = false, attempts = 0
  const empresa = { id: empresaId, nome: 'Empresa de Demonstração', plano: 'ESSENCIAL', status: 'ATIVO', modulos: ['FROTA', 'GESTAO', 'CONTAS_PAGAR', 'NOTIFICACOES', 'TAREFAS'], permissoes: { historicoAnos: 1, telaTarefas: true, delegacaoTarefas: false } }
  await context.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname
    if (path === '/api/empresa/perfil') return route.fulfill({ json: { empresa, usuario: { id: 'fixture', nome: 'Thiago Lima', role: 'GESTOR_EMPRESA', corTema: '#5e17eb', temaClaro: false, ativo: true, modulosAcesso: empresa.modulos } } })
    if (path === '/api/empresa/importacao-inicial') {
      if (route.request().method() === 'POST') {
        attempts++
        expect(route.request().headers()['content-type']).toBe('application/octet-stream')
        if (attempts === 1) return route.fulfill({ status: 400, json: { erro: 'Corrija o CPF.', erros: [{ aba: 'Motoristas', linha: 2, campo: 'cpf', mensagem: 'CPF inválido.' }] } })
        pending = true
      }
      return route.fulfill({ json: { importacao: pending ? { status: 'PENDENTE', resumo, checksum } : null } })
    }
    return route.fulfill({ json: { tickets: [], resumo: { mensagensNaoLidas: 0 }, naoLidas: 0, pendenciasPorModulo: {}, alertas: [] } })
  })
  await page.goto('/dashboard/empresa/configuracoes?aba=importacao')
  const section = page.getByRole('region', { name: 'Importação inicial de dados' })
  await expect(section.getByRole('link', { name: 'Baixar modelo Excel' })).toBeVisible()
  await section.getByLabel('Planilha preenchida').setInputFiles({ name: 'dados.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: Buffer.from('synthetic fixture intercepted before server') })
  await section.getByRole('button', { name: 'Validar e enviar para revisão' }).click()
  await expect(section.getByText('CPF inválido.', { exact: true })).toBeVisible()
  await section.getByRole('button', { name: 'Validar e enviar para revisão' }).click()
  await expect(section.getByText('Aguardando revisão do superadmin', { exact: true })).toBeVisible()
  await expect(section.getByLabel('Planilha preenchida')).toHaveCount(0)
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})

test('superadmin confere o lote e confirma a aprovação antes da inclusão', async ({ page, context, isMobile }) => {
  test.skip(isMobile, 'This admin fixture exercises the desktop module navigation.')
  await session(context, true)
  let approved = false
  await context.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname
    if (path === '/api/empresas') return route.fulfill({ json: [{ id: empresaId, nome: 'Empresa de Demonstração', email: 'demo@example.invalid', status: 'ATIVO', plano: 'ESSENCIAL', modulos: ['FROTA', 'GESTAO'], usuarios_adicionais: 0, veiculos_adicionais: 0, limiteUsuarios: 4, mensalidade: 200, _count: { usuarios: 1, veiculos_frota: 0, motoristas: 0 }, importacao_inicial: { status: 'PENDENTE' } }] })
    if (path.endsWith('/importacao-inicial')) {
      if (route.request().method() === 'PATCH') { expect(route.request().postDataJSON()).toEqual({ acao: 'APROVAR', checksum }); approved = true }
      return route.fulfill({ json: { importacao: { status: approved ? 'APROVADO' : 'PENDENTE', resumo, checksum }, problemas: [], lote: approved ? null : { Localizacoes: [], Veiculos: [{ modelo: 'Volvo FH', placa: 'ABC1D23', quilometragem: 125000 }], Motoristas: [], Custos: [], Manutencoes: [], Containers: [] } } })
    }
    return route.fulfill({ json: { faturas: [], planos: [], tickets: [], resumo: { mensagensNaoLidas: 0 }, naoLidas: 0, pendenciasPorModulo: {}, alertas: [] } })
  })
  await page.goto('/dashboard/admin')
  await page.locator('aside').hover()
  await page.getByRole('button', { name: /EMPRESAS \/ CLIENTES/ }).click()
  await page.getByRole('button', { name: 'GERENCIAR', exact: true }).click()
  await page.getByRole('button', { name: 'IMPORTAÇÃO PENDENTE', exact: true }).click()
  const section = page.getByRole('region', { name: 'Importação inicial de dados' })
  await expect(section.getByText('ABC1D23', { exact: true })).toBeVisible()
  const approve = section.getByRole('button', { name: 'Aprovar e incluir os dados' })
  await expect(approve).toBeDisabled()
  await section.getByRole('checkbox').check()
  await approve.click()
  await expect(section.getByText('Importação inicial concluída', { exact: true })).toBeVisible()
  expect(approved).toBe(true)
})

import { expect, test } from '@playwright/test'

test('APIs de lembretes, tarefas e perfil recusam acesso sem sessão', async ({ request }) => {
  for (const path of ['/api/lembretes-pessoais', '/api/tarefas', '/api/empresa/perfil', '/api/empresa/importacao-inicial', '/api/admin/empresas/11111111-1111-4111-8111-111111111111/importacao-inicial']) {
    const response = await request.get(path)
    expect(response.status(), path).toBe(401)
  }
  const forged = await request.get('/api/lembretes-pessoais', {
    headers: { Cookie: 'rpmtruck_session=invalid.signature.token' },
  })
  expect(forged.status()).toBe(401)
})

test('mutações de outra origem são barradas antes das APIs', async ({ request }) => {
  for (const path of ['/api/lembretes-pessoais', '/api/tarefas', '/api/auth/logout']) {
    const response = await request.post(path, {
      headers: { Origin: 'https://external.example.invalid', 'Sec-Fetch-Site': 'cross-site' },
      data: {},
    })
    expect(response.status(), path).toBe(403)
  }
})

test('retenção não executa com autorização inválida', async ({ request }) => {
  const response = await request.get('/api/internal/retencao', {
    headers: { Authorization: 'Bearer deliberately-invalid-retention-token' },
  })
  // Ausência do segredo também fecha a rotina, com 503.
  expect([401, 503]).toContain(response.status())
})

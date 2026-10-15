import assert from 'node:assert/strict'
import test from 'node:test'
import { NextRequest } from 'next/server.js'
import { z } from 'zod'
import { loadTs } from './helpers/load-ts.mjs'

const admin = { userId: 'admin-a', role: 'ADMIN_RPM' }

test('SuperAdmin inicia conversa administrativa sem franquia e notifica somente gestores', async () => {
  let criacao
  let notificacao
  const conversa = {
    id: 'conversation-a', protocolo: 'REL-202610-TESTE', assunto: 'Acompanhamento',
    origem: 'SUPERADMIN', respostasEmpresaHabilitadas: true,
  }
  const tx = {
    conversaSuporte: { create: async input => { criacao = input; return conversa } },
  }
  const { POST } = loadTs('src/app/api/admin/chat/route.ts', {
    '@/lib/auth': { requireAdminAuth: async () => ({ error: null, status: 200, session: admin }) },
    '@/lib/domainValidation': { textoOperacional: (min, max) => z.string().trim().min(min).max(max) },
    '@/lib/prisma': { prisma: { empresa: { findFirst: async () => ({ id: 'company-a', nome: 'Empresa A' }) } } },
    '@/lib/rateLimit': { applyRateLimit: async () => null, RATE_LIMITS: { ADMIN_MUTATION: { limit: 10, windowMs: 60_000 } } },
    '@/lib/suporte': { gerarProtocoloRelacionamento: () => conversa.protocolo, inicioCompetencia: () => new Date('2026-10-01') },
    '@/lib/suporteConfig': { prioridadeInicialTicket: () => 'NORMAL' },
    '@/lib/notificacoes': { notificarUsuariosDaEmpresa: async (...args) => { notificacao = args } },
    '@/lib/auditoria': { executarComAuditoria: async (contexto, operacao) => { assert.deepEqual(contexto, { usuarioId: admin.userId, origem: 'SUPERADMIN' }); return operacao(tx) } },
  })

  const response = await POST(new NextRequest('http://localhost/api/admin/chat', {
    method: 'POST',
    body: JSON.stringify({ empresaId: '11111111-1111-4111-8111-111111111111', categoria: 'FINANCEIRO', assunto: 'Acompanhamento', mensagem: 'Podemos ajudar com a regularização?', respostasEmpresaHabilitadas: true }),
  }))
  const body = await response.json()

  assert.equal(response.status, 201)
  assert.equal(body.conversa.origem, 'SUPERADMIN')
  assert.equal(criacao.data.cobravelExtra, false)
  assert.equal(criacao.data.franquiaNoMomento, 0)
  assert.equal(criacao.data.empresaId, 'company-a')
  assert.deepEqual(notificacao[2], ['GESTOR_EMPRESA'])
  assert.equal(notificacao[1].ticketSuporteId, conversa.id)
})

test('gestor não consegue responder quando o SuperAdmin pausa a conversa', async () => {
  const session = { userId: 'manager-a', empresaId: 'company-a', role: 'GESTOR_EMPRESA' }
  const { POST } = loadTs('src/app/api/chat/route.ts', {
    '@/lib/auth': { requireAuth: async () => ({ error: null, status: 200, session }), isAdminRole: () => false },
    '@/lib/empresaAuth': { requireEmpresaAuth: async () => ({ error: null, status: 200, session, empresa: { id: 'company-a', nome: 'Empresa A', plano: 'ESSENCIAL' } }) },
    '@/lib/domainValidation': { textoOperacional: (min, max) => z.string().trim().min(min).max(max) },
    '@/lib/prisma': { prisma: { conversaSuporte: { findFirst: async () => ({ id: 'conversation-a', protocolo: 'REL-1', assunto: 'Contato', categoria: 'FINANCEIRO', status: 'AGUARDANDO_CLIENTE', primeiraRespostaEm: new Date(), etapaTriagem: 1, triagemConcluidaEm: null, origem: 'SUPERADMIN', respostasEmpresaHabilitadas: false, mensagens: [] }) } } },
    '@/lib/rateLimit': { applyRateLimit: async () => null, RATE_LIMITS: { CHAT_SEND: { limit: 10, windowMs: 60_000 } } },
    '@/lib/suporte': {}, '@/lib/suporteConfig': {}, '@/lib/notificacoes': {}, '@/lib/auditoria': {}, '@/lib/suporteBot': {},
  })
  const response = await POST(new NextRequest('http://localhost/api/chat', {
    method: 'POST',
    body: JSON.stringify({ ticketId: '22222222-2222-4222-8222-222222222222', mensagem: 'Minha resposta' }),
  }))
  assert.equal(response.status, 409)
  assert.match((await response.json()).erro, /respostas desta conversa estão pausadas/)
})

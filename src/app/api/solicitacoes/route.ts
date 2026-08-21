// src/app/api/solicitacoes/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminAuth } from '@/lib/auth';
import { notificarAdmins } from '@/lib/notificacoes';
import { nomeOperacional, nomePessoa, textoOperacional } from '@/lib/domainValidation';
import { prisma } from '@/lib/prisma';
import { applyRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rateLimit';
import { PLANOS_CONFIG } from '@/utils/planos';
import { executarComAuditoria } from '@/lib/auditoria';

const solicitacaoSchema = z.object({
  empresa: nomeOperacional(2, 150),
  responsavel: nomePessoa(3, 120),
  email: z.string().trim().email().max(254).toLowerCase(),
  whatsapp: z.string().trim().regex(/^\+?[\d\s().-]{10,20}$/, 'WhatsApp inválido.').optional().or(z.literal('')),
  plano: z.enum(['ESSENCIAL', 'AVANCADO', 'ENTERPRISE']),
  mensagem: textoOperacional(3, 1500).optional().or(z.literal('')),
  contatoPref: z.enum(['email', 'whatsapp']).default('email'),
  veiculos: z.coerce.number().int().min(0).max(100_000).optional(),
}).strict();

// ─── 1. ROTA DO ADMIN: LISTAR SOLICITAÇÕES (GET) ───
export async function GET(request: NextRequest) {
  const auth = await requireAdminAuth(request);
  if (auth.error || !auth.session) return NextResponse.json({ erro: auth.error }, { status: auth.status });
  try {
    // Busca todas as solicitações de acesso ordenadas pelas mais recentes
    const chamados = await prisma.solicitacaoAcesso.findMany({
      orderBy: { criado_em: 'desc' }
    });
    
    return NextResponse.json(chamados, { status: 200 });
  } catch (error) {
    console.error('Erro ao listar solicitações no Admin:', error);
    return NextResponse.json(
      { erro: 'Erro técnico ao recuperar fila de solicitações.' }, 
      { status: 500 }
    );
  }
}

// ─── 2. ROTA DO CLIENTE: ENVIAR FORMULÁRIO DA LANDING PAGE (POST) ───
export async function POST(request: NextRequest) {
  try {
    const bloqueio = await applyRateLimit(request, `solicitacao:${getClientIp(request)}`, RATE_LIMITS.SIGNUP.limit, RATE_LIMITS.SIGNUP.windowMs);
    if (bloqueio) return bloqueio;
    const parsed = solicitacaoSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ erro: 'Revise os dados da solicitação.' }, { status: 400 });
    const { empresa, responsavel, email, whatsapp, plano, mensagem, contatoPref } = parsed.data;

    // Bloqueio de duplicidade para e-mails corporativos em análise
    const leadExistente = await prisma.solicitacaoAcesso.findUnique({
      where: { email }
    });

    if (leadExistente) {
      return NextResponse.json(
        { erro: 'Este e-mail corporativo já possui uma solicitação de acesso ativa em nossa fila.' },
        { status: 400 }
      );
    }

    const novaSolicitacao = await executarComAuditoria({ origem: 'PUBLIC_API' }, (tx) => tx.solicitacaoAcesso.create({
      data: {
        empresa,
        responsavel,
        email,
        whatsapp: whatsapp || null,
        veiculos: PLANOS_CONFIG[plano].veiculosBase,
        plano,
        mensagem: mensagem || null,
        contatoPref: contatoPref || 'email',
        status: 'PENDENTE'
      }
    }));

    await notificarAdmins({ titulo: 'Nova solicitação de acesso', mensagem: `${novaSolicitacao.empresa} solicitou o plano ${novaSolicitacao.plano}.`, modulo: 'ACESSO' });

    return NextResponse.json(
      { sucesso: true, id: novaSolicitacao.id },
      { status: 201 }
    );

  } catch (error) {
    console.error('Erro crítico no recebimento do lead:', error);
    return NextResponse.json(
      { erro: 'Falha interna na engine de dados do servidor RPMTruck.' },
      { status: 500 }
    );
  }
}

// src/app/api/solicitacoes/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient, PlanoTipo } from '@prisma/client';
import { requireAdminAuth } from '@/lib/auth';
import { notificarAdmins } from '@/lib/notificacoes';

const prisma = new PrismaClient();

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
  } finally {
    await prisma.$disconnect();
  }
}

// ─── 2. ROTA DO CLIENTE: ENVIAR FORMULÁRIO DA LANDING PAGE (POST) ───
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { empresa, responsavel, email, whatsapp, veiculos, plano, mensagem, contatoPref } = body;

    // Validação estrita de campos obrigatórios no Servidor
    if (!empresa || !responsavel || !email || !plano) {
      return NextResponse.json(
        { erro: 'Parâmetros obrigatórios ausentes na requisição técnica.' },
        { status: 400 }
      );
    }

    // Bloqueio de duplicidade para e-mails corporativos em análise
    const leadExistente = await prisma.solicitacaoAcesso.findUnique({
      where: { email: email.toLowerCase().trim() }
    });

    if (leadExistente) {
      return NextResponse.json(
        { erro: 'Este e-mail corporativo já possui uma solicitação de acesso ativa em nossa fila.' },
        { status: 400 }
      );
    }

    // Conversão segura do Enum do Plano para casar com o prisma.schema
    const planoFormatado = plano.toUpperCase() as PlanoTipo;
    if (!Object.values(PlanoTipo).includes(planoFormatado)) {
      return NextResponse.json(
        { erro: 'O plano indicado não condiz com as cotas de produto da RPMTruck.' },
        { status: 400 }
      );
    }

    // Inserção limpa no banco via Prisma Client
    const novaSolicitacao = await prisma.solicitacaoAcesso.create({
      data: {
        empresa: empresa.trim(),
        responsavel: responsavel.trim(),
        email: email.toLowerCase().trim(),
        whatsapp: whatsapp || null,
        // Garante a gravação estrita dos limites numéricos travados do front-end
        veiculos: parseInt(veiculos) || 0,
        plano: planoFormatado,
        mensagem: mensagem || null,
        contatoPref: contatoPref || 'email',
        status: 'PENDENTE'
      }
    });

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
  } finally {
    await prisma.$disconnect();
  }
}

import { NextResponse } from 'next/server';
import { PrismaClient, Role, StatusEmpresa, StatusSolicitacao, StatusFatura } from '@prisma/client';
import bcrypt from 'bcrypt'; // Lembre-se de rodar 'npm i bcrypt' e 'npm i --save-dev @types/bcrypt'
import { requireAdminAuth } from '@/lib/auth';
import { NextRequest } from 'next/server';

const prisma = new PrismaClient();

// Configurações padrão de limites e valores para cada plano base do SaaS
const PLANOS_CONFIG = {
  ESSENCIAL: { base: 450, setup: 300, uBase: 4, vBase: 10, modulos: ['Módulo Frota'] },
  AVANCADO: { base: 650, setup: 500, uBase: 10, vBase: 25, modulos: ['Módulo Frota', 'Controle & Gestão'] },
  ENTERPRISE: { base: 1250, setup: 1000, uBase: 25, vBase: 80, modulos: ['Módulo Frota', 'Controle & Gestão', 'Relatórios & Dashboards'] },
  PREVIEW: { base: 0, setup: 0, uBase: 999, vBase: 999, modulos: ['Módulo Frota', 'Controle & Gestão', 'Relatórios & Dashboards'] }
};

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireAdminAuth(request);
  if (auth.error || !auth.session) return NextResponse.json({ erro: auth.error }, { status: auth.status });
  const { id } = params;

  try {
    // 1. Coleta e valida se a solicitação existe e está realmente PENDENTE
    const solicitacao = await prisma.solicitacaoAcesso.findUnique({
      where: { id }
    });

    if (!solicitacao) {
      return NextResponse.json({ erro: 'Solicitação de acesso não localizada na base de dados.' }, { status: 404 });
    }

    if (solicitacao.status !== StatusSolicitacao.PENDENTE) {
      return NextResponse.json({ erro: 'Esta solicitação já foi processada anteriormente.' }, { status: 400 });
    }

    const configPlano = PLANOS_CONFIG[solicitacao.plano];
    const dataAtual = new Date();
    const mesesValores = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const mesReferencia = mesesValores[dataAtual.getMonth()];
    const anoReferencia = dataAtual.getFullYear();

    // Gerando uma senha padrão temporária inicial forte para o cliente
    const senhaProvisoria = `RPM@${Math.floor(100000 + Math.random() * 900000)}`;
    const salt = await bcrypt.genSalt(10);
    const senhaHash = await bcrypt.hash(senhaProvisoria, salt);

    // 2. Executa a TRANSACTION (Garante que se um passo falhar, nenhum dado corrompido é gravado)
    const resultado = await prisma.$transaction(async (tx) => {
      
      // Passo A: Atualizar o status do Lead de entrada
      await tx.solicitacaoAcesso.update({
        where: { id },
        data: { status: StatusSolicitacao.APROVADO }
      });

      // Passo B: Criar a Instância da Empresa (Tenant)
      const novaEmpresa = await tx.empresa.create({
        data: {
          nome: solicitacao.empresa,
          email: solicitacao.email,
          nome_contato: solicitacao.responsavel,
          plano: solicitacao.plano,
          status: StatusEmpresa.ATIVO,
          modulos: configPlano.modulos,
          usuarios_adicionais: 0,
          veiculos_adicionais: 0
        }
      });

      // Passo C: Criar o Usuário Dono/Gestor master da transportadora
      const novoGestor = await tx.usuario.create({
        data: {
          nome: solicitacao.responsavel,
          email: solicitacao.email,
          senha_hash: senhaHash,
          role: Role.GESTOR_EMPRESA,
          empresaId: novaEmpresa.id
        }
      });

      // Passo D: Gerar Fatura de Implementação (Setup) - se houver custo
      if (configPlano.setup > 0) {
        await tx.fatura.create({
          data: {
            mes: mesReferencia,
            ano: anoReferencia,
            tipo: 'IMPLEMENTACAO',
            valor: configPlano.setup,
            status: StatusFatura.PENDENTE,
            empresaId: novaEmpresa.id
          }
        });
      }

      // Passo E: Gerar primeira Fatura de Mensalidade recorrente em aberto
      if (configPlano.base > 0) {
        await tx.fatura.create({
          data: {
            mes: mesReferencia,
            ano: anoReferencia,
            tipo: 'MENSALIDADE',
            valor: configPlano.base,
            status: StatusFatura.PENDENTE,
            empresaId: novaEmpresa.id
          }
        });
      }

      return { empresaId: novaEmpresa.id, email: novoGestor.email };
    });

    // FUTURO: É aqui onde dispararemos o serviço de e-mail (Nodemailer/Resend) enviando a senhaProvisoria para o cliente.
    return NextResponse.json({
      sucesso: true,
      mensagem: 'Instância multi-tenant implantada com sucesso e faturas anexadas.',
      credencialTemporaria: {
        email: resultado.email,
        senha: senhaProvisoria
      }
    }, { status: 200 });

  } catch (error) {
    console.error('Erro crítico ao aprovar e implantar tenant:', error);
    return NextResponse.json({ erro: 'Falha na transação técnica de implantação da infraestrutura.' }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

import { NextResponse } from 'next/server';
import { Role, StatusEmpresa, StatusSolicitacao, StatusFatura } from '@prisma/client';
import { hashPassword } from '@/lib/password';
import { requireAdminAuth } from '@/lib/auth';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { PLANOS_CONFIG as PLANOS_PADRONIZADOS } from '@/utils/planos';
import { randomBytes } from 'crypto';
import { executarComAuditoria } from '@/lib/auditoria';
import { applyRateLimit, RATE_LIMITS } from '@/lib/rateLimit';

export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const auth = await requireAdminAuth(request);
  if (auth.error || !auth.session) return NextResponse.json({ erro: auth.error }, { status: auth.status });
  const limited = await applyRateLimit(request, `admin-mutation:${auth.session.userId}`, RATE_LIMITS.ADMIN_MUTATION.limit, RATE_LIMITS.ADMIN_MUTATION.windowMs);
  if (limited) return limited;
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

    const configPlano = PLANOS_PADRONIZADOS[solicitacao.plano];
    const dataAtual = new Date();
    const mesesValores = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const mesReferencia = mesesValores[dataAtual.getMonth()];
    const anoReferencia = dataAtual.getFullYear();

    // Gerando uma senha padrão temporária inicial forte para o cliente
    const senhaProvisoria = `RPM@${randomBytes(6).toString('base64url')}`;
    const senhaHash = await hashPassword(senhaProvisoria);

    // 2. Executa a TRANSACTION (Garante que se um passo falhar, nenhum dado corrompido é gravado)
    const resultado = await executarComAuditoria({ usuarioId: auth.session.userId, origem: 'SUPERADMIN' }, async (tx) => {
      
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
          modulos: [...configPlano.modulosPadrao],
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

      await tx.notificacao.create({
        data: {
          titulo: 'Acesso aprovado',
          mensagem: `A empresa ${novaEmpresa.nome} foi ativada no plano ${novaEmpresa.plano}.`,
          modulo: 'GERAL',
          empresaId: novaEmpresa.id,
          usuarioId: novoGestor.id,
        }
      });

      // Passo D: Gerar Fatura de Implementação (Setup) - se houver custo
      if (configPlano.taxaImplantacao > 0) {
        await tx.fatura.create({
          data: {
            mes: mesReferencia,
            ano: anoReferencia,
            tipo: 'IMPLEMENTACAO',
            valor: configPlano.taxaImplantacao,
            status: StatusFatura.PENDENTE,
            empresaId: novaEmpresa.id
          }
        });
      }

      // Passo E: Gerar primeira Fatura de Mensalidade recorrente em aberto
      if (configPlano.precoBase > 0) {
        await tx.fatura.create({
          data: {
            mes: mesReferencia,
            ano: anoReferencia,
            tipo: 'MENSALIDADE',
            valor: configPlano.precoBase,
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
  }
}

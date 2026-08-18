import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { PlanoTipo } from '@prisma/client';
import { requireAdminAuth } from '@/lib/auth';
import { NextRequest } from 'next/server';

// TABELA DE PREÇOS FIXA E OFICIAL DO RPMTRUCK
const TABELA_PRECOS = {
  PREVIEW: { base: 0.00, veiculoExtra: 0.00, usuarioExtra: 0.00 },
  ESSENCIAL: { base: 450.00, veiculoExtra: 30.00, usuarioExtra: 25.00 },
  AVANCADO: { base: 650.00, veiculoExtra: 30.00, usuarioExtra: 25.00 },
  ENTERPRISE: { base: 1250.00, veiculoExtra: 30.00, usuarioExtra: 25.00 }
};

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdminAuth(req);
  if (auth.error || !auth.session) return NextResponse.json({ erro: auth.error }, { status: auth.status });
  try {
    const { id } = params;
    const dadosFormulario = await req.json();

    // 1. Busca os dados atuais da empresa no Supabase
    const empresaAtual = await prisma.empresa.findUnique({ where: { id } });
    if (!empresaAtual) return NextResponse.json({ erro: 'Empresa não encontrada' }, { status: 404 });

    // Mescla os dados recebidos com os já existentes
    const planoAlvo = (dadosFormulario.plano || empresaAtual.plano) as PlanoTipo;
    const modulosAlvo = dadosFormulario.modulos !== undefined ? dadosFormulario.modulos : empresaAtual.modulos;
    const veiculosExtras = dadosFormulario.veiculos_adicionais !== undefined ? dadosFormulario.veiculos_adicionais : empresaAtual.veiculos_adicionais;
    const usuariosExtras = dadosFormulario.usuarios_adicionais !== undefined ? dadosFormulario.usuarios_adicionais : empresaAtual.usuarios_adicionais;

    // 2. Coleta as taxas com base na tabela oficial
    const precosDoPlano = TABELA_PRECOS[planoAlvo];

    // 3. CÁLCULO AUTOMÁTICO DE DEBITO / CRÉDITO
    // Se for PREVIEW, a conta resulta em 0 automaticamente
    const novaMensalidade = precosDoPlano.base + 
      (veiculosExtras * precosDoPlano.veiculoExtra) + 
      (usuariosExtras * precosDoPlano.usuarioExtra);

    // 4. Salva o novo contrato recalculado de forma transparente
    const empresaAtualizada = await prisma.empresa.update({
      where: { id },
      data: {
        plano: planoAlvo,
        modulos: modulosAlvo,
        veiculos_adicionais: veiculosExtras,
        usuarios_adicionais: usuariosExtras
      }
    });

    return NextResponse.json({
      ...empresaAtualizada,
      mensalidade: parseFloat(novaMensalidade.toFixed(2))
    });
  } catch (error) {
    console.error('Erro ao recalcular faturamento do SaaS:', error);
    return NextResponse.json({ erro: 'Erro interno no cálculo de faturamento.' }, { status: 500 });
  }
}

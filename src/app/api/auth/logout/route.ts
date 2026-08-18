// src/app/api/auth/logout/route.ts
import { NextResponse, NextRequest } from 'next/server';
import { clearSession } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    await clearSession();

    return NextResponse.json(
      { sucesso: true, mensagem: 'Logout realizado com sucesso' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Erro no logout:', error);
    return NextResponse.json(
      { erro: 'Erro ao fazer logout' },
      { status: 500 }
    );
  }
}

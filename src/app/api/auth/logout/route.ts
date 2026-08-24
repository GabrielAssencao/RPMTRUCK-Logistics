// src/app/api/auth/logout/route.ts
import { NextResponse, NextRequest } from 'next/server';
import { clearSession } from '@/lib/auth';
import { verifySession } from '@/lib/sessionToken';
import { getClientIp } from '@/lib/rateLimit';
import { recordSecurityEvent } from '@/lib/securityEvents';

export async function POST(request: NextRequest) {
  try {
    const session = await verifySession(request);
    await clearSession(request);
    if (session) {
      await recordSecurityEvent({
        tipo: 'LOGOUT', request, usuarioId: session.userId,
        empresaId: session.empresaId, email: session.email, ip: getClientIp(request),
      });
    }

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

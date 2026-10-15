import { NextRequest, NextResponse } from 'next/server'
import { requireEmpresaAuth } from '@/lib/empresaAuth'
import { AsaasError, obterQrCodeAsaas } from '@/lib/financeiro/asaas'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest, context: RouteContext<'/api/empresa/faturas/[id]/pix-qr'>) {
  const auth = await requireEmpresaAuth(request, { acao: 'GESTAO' })
  if (auth.error || !auth.session?.empresaId) return NextResponse.json({ erro: auth.error }, { status: auth.status })
  const { id } = await context.params
  const fatura = await prisma.fatura.findFirst({
    where: { id, empresaId: auth.session.empresaId, status: 'PENDENTE', provedorPagamento: 'ASAAS' },
    select: { gatewayPaymentId: true },
  })
  if (!fatura?.gatewayPaymentId) return NextResponse.json({ erro: 'Emita a cobrança antes de visualizar o QR Code.' }, { status: 404 })
  try {
    const qr = await obterQrCodeAsaas(fatura.gatewayPaymentId)
    const image = Buffer.from(qr.encodedImage.replace(/^data:image\/png;base64,/, ''), 'base64')
    if (!image.length) throw new Error('QR_VAZIO')
    return new NextResponse(image, {
      headers: {
        'Content-Type': 'image/png',
        'Content-Disposition': `inline; filename="pix-${id}.png"`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (error) {
    if (error instanceof AsaasError) return NextResponse.json({ erro: error.message }, { status: error.status })
    console.error('Falha ao carregar QR Code do Asaas:', error)
    return NextResponse.json({ erro: 'Não foi possível carregar o QR Code.' }, { status: 502 })
  }
}

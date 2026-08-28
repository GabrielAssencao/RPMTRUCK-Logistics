import type { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request)
  if (auth.error || !auth.session) {
    return new Response(null, { status: auth.status })
  }

  return new Response(null, {
    status: 204,
    headers: { 'Cache-Control': 'private, no-store' },
  })
}

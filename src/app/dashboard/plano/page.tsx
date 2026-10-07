'use client'

import Link from 'next/link'
import SubscriptionManagement from '@/app/dashboard/empresa/configuracoes/_componentes/SubscriptionManagement'

export default function GestaoPlanoPage() {
  return (
    <main className="mx-auto min-h-dvh max-w-6xl space-y-6 p-4 sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold font-rajdhani">Plano e pagamentos</h1>
          <p className="mt-1 max-w-2xl text-sm text-foreground-muted">Consulte o acesso da empresa, pague cobranças, gerencie o cartão automático e solicite alterações do plano.</p>
        </div>
        <Link href="/dashboard/empresa" className="text-sm underline">Voltar ao painel operacional</Link>
      </header>
      <SubscriptionManagement />
    </main>
  )
}

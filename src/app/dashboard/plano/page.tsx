'use client'

import Link from 'next/link'
import SubscriptionManagement from '@/app/dashboard/empresa/configuracoes/_componentes/SubscriptionManagement'

export default function GestaoPlanoPage() {
  return (
    <main className="mx-auto min-h-dvh max-w-6xl space-y-6 p-4 sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b pb-4">
        <h1 className="text-2xl font-bold font-rajdhani">Gestão do plano e pagamentos</h1>
        <Link href="/dashboard/empresa" className="text-sm underline">Voltar ao painel operacional</Link>
      </header>
      <SubscriptionManagement />
    </main>
  )
}

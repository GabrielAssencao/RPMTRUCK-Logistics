'use client'

import ChatWorkspace from '@/components/dashboard/ChatWorkspace'

export default function EmpresaChatPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div><p className="text-[10px] font-bold uppercase tracking-[0.25em] text-foreground-muted">Canal privado</p><h1 className="mt-1 text-2xl font-black font-rajdhani sm:text-3xl">CHAT COM O ADMINISTRADOR</h1><p className="mt-1 text-sm text-foreground-muted">Fale diretamente com a equipe RPMTruck. Apenas o gestor da empresa pode acessar este canal.</p></div>
      <ChatWorkspace />
    </div>
  )
}

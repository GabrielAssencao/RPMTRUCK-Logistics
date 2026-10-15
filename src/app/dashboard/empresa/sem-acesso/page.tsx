import Link from 'next/link'
import { BookOpen, Headset, ShieldAlert } from 'lucide-react'

export default function SemModulosPage() {
  return (
    <main className="mx-auto grid min-h-[60vh] max-w-3xl place-items-center px-4 py-10">
      <section className="w-full border p-6 text-center sm:p-10" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background-secondary)' }}>
        <span className="mx-auto grid h-14 w-14 place-items-center border text-primary" style={{ borderColor: 'currentColor' }} aria-hidden="true">
          <ShieldAlert size={25} />
        </span>
        <p className="mt-5 text-[10px] font-black uppercase tracking-[0.22em] text-primary">Acesso ativo</p>
        <h1 className="mt-2 font-rajdhani text-2xl font-black uppercase sm:text-3xl">Nenhum módulo foi liberado</h1>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-foreground-muted">
          Sua conta está funcionando, mas ainda não possui módulos operacionais. Peça ao gestor da empresa para revisar suas permissões em Operadores.
        </p>
        <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
          <Link href="/dashboard/empresa/chat" className="inline-flex min-h-11 items-center justify-center gap-2 border px-4 text-xs font-black uppercase text-primary" style={{ borderColor: 'currentColor' }}>
            <Headset size={16} /> Abrir suporte
          </Link>
          <Link href="/dashboard/empresa/tutoriais" className="inline-flex min-h-11 items-center justify-center gap-2 border px-4 text-xs font-black uppercase text-foreground-muted" style={{ borderColor: 'var(--border)' }}>
            <BookOpen size={16} /> Ver tutoriais
          </Link>
        </div>
      </section>
    </main>
  )
}

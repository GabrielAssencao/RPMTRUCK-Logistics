import Link from 'next/link'
import { TUTORIAIS_MODULOS } from '@/data/tutoriais'
import { TUTORIAIS_SUPORTE } from '@/lib/suporteBot'

export default function TutoriaisPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-6 text-foreground">
      <header className="space-y-2">
        <p className="text-[10px] font-bold uppercase tracking-widest text-primary">Central de ajuda</p>
        <h1 className="font-rajdhani text-2xl font-black uppercase">Tutoriais e dúvidas</h1>
        <p className="text-sm text-foreground-muted">Encontre o passo a passo, entenda o motivo de cada cadastro e resolva dúvidas da rotina. Os recursos disponíveis dependem do seu papel e do plano da empresa.</p>
      </header>
      <nav aria-label="Assuntos dos tutoriais" className="flex flex-wrap gap-2 border-y border-border py-4">
        {TUTORIAIS_MODULOS.map(item => <a key={item.id} href={`#${item.id}`} className="border border-border bg-background px-3 py-2 text-xs hover:border-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">{item.titulo}</a>)}
        <a href="#problemas-comuns" className="border border-primary px-3 py-2 text-xs text-primary">Resolver um problema</a>
      </nav>
      <section aria-label="Passo a passo por módulo" className="divide-y divide-border border border-border bg-background-secondary">
        {TUTORIAIS_MODULOS.map(item => (
          <details key={item.id} id={item.id} className="group scroll-mt-4 p-4 sm:p-5">
            <summary className="cursor-pointer text-sm font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">{item.titulo}<span className="mt-1 block text-xs font-normal text-foreground-muted">{item.objetivo}</span></summary>
            <div className="mt-4 space-y-4 text-sm leading-relaxed">
              <ol className="list-decimal space-y-2 pl-5">{item.passos.map(passo => <li key={passo}>{passo}</li>)}</ol>
              <p><strong>Como funciona: </strong>{item.logica}</p>
              <p className="text-foreground-muted"><strong>Dica prática: </strong>{item.dica}</p>
            </div>
          </details>
        ))}
      </section>
      <section id="problemas-comuns" className="scroll-mt-4 space-y-4">
        <h2 className="font-rajdhani text-xl font-bold">Problemas comuns</h2>
        <p className="text-xs text-foreground-muted">Estas são as mesmas orientações usadas pelo assistente no primeiro atendimento.</p>
        {TUTORIAIS_SUPORTE.map(item => <details key={item.titulo} className="border border-border bg-background-secondary p-4"><summary className="cursor-pointer text-sm font-bold">{item.titulo}</summary><p className="mt-3 text-sm leading-relaxed">Primeiro, {item.orientacao}.</p></details>)}
        <p className="text-sm text-foreground-muted">Não resolveu? Informe ao gestor a tela, a ação realizada, o horário e o resultado esperado. O gestor pode abrir um chamado pelo chat para o assistente orientar ou encaminhar ao atendimento humano. Não envie senhas ou dados sensíveis.</p>
        <Link href="/guia" className="inline-block text-sm text-primary underline">Consultar também o guia de primeiros passos</Link>
      </section>
    </div>
  )
}

import type { ReactNode } from 'react'
import Link from 'next/link'
import Navbar from '@/components/landing/Navbar'
import Footer from '@/components/landing/Footer'

export interface DocumentSectionLink {
  id: string
  label: string
}

export default function PublicDocumentLayout({
  eyebrow,
  title,
  description,
  updatedAt,
  sections,
  children,
}: {
  eyebrow: string
  title: string
  description: string
  updatedAt?: string
  sections: DocumentSectionLink[]
  children: ReactNode
}) {
  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-background px-6 pb-20 pt-32 text-foreground md:px-12">
        <div className="mx-auto max-w-7xl">
          <Link href="/" className="text-sm font-semibold text-primary hover:underline">
            ← Voltar para a página inicial
          </Link>
          <header className="mt-10 max-w-4xl border-b border-border pb-10">
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.28em] text-primary">{eyebrow}</p>
            <h1 className="text-4xl font-black leading-tight md:text-6xl" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
              {title}
            </h1>
            <p className="mt-5 max-w-3xl text-lg text-foreground-muted">{description}</p>
            {updatedAt && <p className="mt-5 text-sm text-foreground-muted">Última atualização: {updatedAt}</p>}
          </header>

          <div className="mt-10 grid gap-12 lg:grid-cols-[16rem_minmax(0,1fr)]">
            <aside className="lg:sticky lg:top-28 lg:self-start">
              <p className="mb-3 text-xs font-bold uppercase tracking-widest text-foreground-muted">Nesta página</p>
              <nav aria-label="Sumário do documento" className="border-l border-border">
                {sections.map((section) => (
                  <a
                    key={section.id}
                    href={`#${section.id}`}
                    className="block border-l border-transparent px-4 py-2 text-sm text-foreground-muted transition-colors hover:border-primary hover:text-foreground"
                  >
                    {section.label}
                  </a>
                ))}
              </nav>
            </aside>
            <article className="min-w-0 space-y-12 text-[1.02rem] leading-7 text-foreground-muted [&_a]:text-primary [&_a]:underline-offset-4 hover:[&_a]:underline [&_h2]:scroll-mt-28 [&_h2]:text-2xl [&_h2]:font-black [&_h2]:text-foreground [&_h2]:md:text-3xl [&_h3]:mt-7 [&_h3]:text-lg [&_h3]:font-bold [&_h3]:text-foreground [&_li]:ml-5 [&_li]:pl-1 [&_ul]:mt-4 [&_ul]:list-disc [&_ul]:space-y-2">
              {children}
            </article>
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}

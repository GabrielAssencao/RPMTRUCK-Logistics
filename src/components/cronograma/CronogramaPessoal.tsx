'use client'

import { useCallback, useMemo, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, StickyNote } from 'lucide-react'
import { LembretesPessoaisBoard, type LembretePessoal } from '@/components/cronograma/LembretesPessoaisBoard'
import { useTheme } from '@/contexts/ThemeContext'

function chaveDia(data: Date) {
  return [data.getFullYear(), data.getMonth(), data.getDate()].join('-')
}

export default function CronogramaPessoal({ permitirLembretes = true }: { permitirLembretes?: boolean }) {
  const { primary, semanticColors } = useTheme()
  const [aba, setAba] = useState<'LEMBRETES' | 'CALENDARIO'>(permitirLembretes ? 'LEMBRETES' : 'CALENDARIO')
  const [carregamento, setCarregamento] = useState<'loading' | 'ready' | 'error'>(permitirLembretes ? 'loading' : 'ready')
  const [lembretes, setLembretes] = useState<LembretePessoal[]>([])
  const [mes, setMes] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1))
  const atualizarLembretes = useCallback((lista: LembretePessoal[]) => setLembretes(lista), [])
  const porDia = useMemo(() => {
    const mapa = new Map<string, LembretePessoal[]>()
    for (const lembrete of lembretes) {
      if (lembrete.concluido) continue
      const chave = chaveDia(new Date(lembrete.dataHora))
      mapa.set(chave, [...(mapa.get(chave) ?? []), lembrete])
    }
    return mapa
  }, [lembretes])
  const dias = useMemo(() => {
    const inicio = new Date(mes.getFullYear(), mes.getMonth(), 1)
    inicio.setDate(1 - inicio.getDay())
    return Array.from({ length: 42 }, (_, indice) => new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() + indice))
  }, [mes])
  const alterarMes = (delta: number) => setMes((atual) => new Date(atual.getFullYear(), atual.getMonth() + delta, 1))

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-rajdhani text-2xl font-bold uppercase">Cronograma</h1>
        <p className="mt-1 text-xs text-foreground-muted">Organize seus lembretes pessoais e acompanhe os compromissos no calendário.</p>
      </div>
      <nav className="flex flex-wrap gap-2" aria-label="Visualização do cronograma">
        {([{ id: 'LEMBRETES', titulo: 'Lembretes', icon: StickyNote }, { id: 'CALENDARIO', titulo: 'Calendário', icon: CalendarDays }] as const).map((item) => (
          <button key={item.id} type="button" aria-pressed={aba === item.id} disabled={!permitirLembretes && item.id === 'LEMBRETES'} onClick={() => setAba(item.id)} className="interactive-control flex min-h-10 items-center gap-2 border px-4 text-xs font-bold uppercase" style={{ borderColor: 'var(--border)', backgroundColor: aba === item.id ? primary : 'var(--background-secondary)', color: aba === item.id ? '#000' : 'var(--foreground)' }}><item.icon size={16} />{item.titulo}</button>
        ))}
      </nav>
      {permitirLembretes && <LembretesPessoaisBoard active={aba === 'LEMBRETES'} onChange={atualizarLembretes} onLoadState={setCarregamento} />}
      {aba === 'CALENDARIO' && (
        <section className="border" aria-label="Calendário de lembretes pessoais" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background-secondary)' }}>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4" style={{ borderColor: 'var(--border)' }}>
            <h2 className="font-rajdhani text-xl font-bold capitalize" aria-live="polite">{mes.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</h2>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => alterarMes(-1)} className="interactive-control flex min-h-10 min-w-10 items-center justify-center border" style={{ borderColor: 'var(--border)' }} aria-label="Mês anterior"><ChevronLeft size={17} /></button>
              <button type="button" onClick={() => setMes(new Date(new Date().getFullYear(), new Date().getMonth(), 1))} className="interactive-control min-h-10 border px-3 text-xs" style={{ borderColor: 'var(--border)' }}>Hoje</button>
              <button type="button" onClick={() => alterarMes(1)} className="interactive-control flex min-h-10 min-w-10 items-center justify-center border" style={{ borderColor: 'var(--border)' }} aria-label="Próximo mês"><ChevronRight size={17} /></button>
            </div>
          </div>
          <p className="px-4 py-3 text-xs text-foreground-muted">O calendário mostra seus lembretes ativos. Abra um compromisso para consultar o quadro.</p>
          {carregamento !== 'ready' && <div className="p-4 text-xs" role="status">{carregamento === 'loading' ? 'Carregando lembretes...' : <><p>Não foi possível carregar os lembretes do calendário.</p><button type="button" className="interactive-control mt-2 min-h-10 border px-3" style={{ borderColor: 'var(--border)' }} onClick={() => setAba('LEMBRETES')}>Abrir lembretes para conferir o erro</button></>}</div>}
          <div hidden={carregamento !== 'ready'} className="overflow-x-auto" tabIndex={0} role="region" aria-label="Grade mensal; role horizontalmente em telas pequenas">
            <div className="min-w-[700px]">
              <div className="grid grid-cols-7 border-b" style={{ borderColor: 'var(--border)' }}>{['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'].map((dia) => <div key={dia} className="p-2 text-center text-[10px] font-bold text-foreground-muted">{dia}</div>)}</div>
              <div className="grid grid-cols-7">
                {dias.map((dia) => {
                  const itens = porDia.get(chaveDia(dia)) ?? []
                  const hoje = chaveDia(dia) === chaveDia(new Date())
                  return (
                    <div key={chaveDia(dia)} className="min-h-28 border-b border-r p-2" style={{ borderColor: 'var(--border)', opacity: dia.getMonth() === mes.getMonth() ? 1 : 0.5 }}>
                      <time dateTime={[dia.getFullYear(), String(dia.getMonth() + 1).padStart(2, '0'), String(dia.getDate()).padStart(2, '0')].join('-')} aria-current={hoje ? 'date' : undefined} className="inline-flex h-6 min-w-6 items-center justify-center text-xs" style={hoje ? { backgroundColor: primary, color: '#000' } : undefined}>{dia.getDate()}</time>
                      <div className="mt-2 space-y-1">
                        {itens.slice(0, 3).map((item) => <button type="button" key={item.id} onClick={() => setAba('LEMBRETES')} className="interactive-control block w-full truncate border-l-2 px-1.5 py-1 text-left text-[10px]" style={{ borderColor: semanticColors.warning, backgroundColor: 'var(--background)' }} title={item.titulo}>{new Date(item.dataHora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} · {item.titulo}</button>)}
                        {itens.length > 3 && <button type="button" onClick={() => setAba('LEMBRETES')} className="interactive-control text-[10px] text-foreground-muted">Ver mais {itens.length - 3} lembrete(s)</button>}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  )
}

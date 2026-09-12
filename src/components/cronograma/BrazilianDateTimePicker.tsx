'use client'

import { useMemo, useState } from 'react'
import { CalendarDays, Clock3, X } from 'lucide-react'

interface PartesDataHora {
  dia: string
  mes: string
  ano: string
  hora: string
  minuto: string
}

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

function extrairPartes(valor: string, horarioPadrao?: string): PartesDataHora {
  const resultado = /^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2})$/.exec(valor)
  if (!resultado) {
    const [hora = '', minuto = ''] = horarioPadrao?.split(':') ?? []
    return { dia: '', mes: '', ano: '', hora, minuto }
  }
  return { dia: resultado[1], mes: resultado[2], ano: resultado[3], hora: resultado[4], minuto: resultado[5] }
}

function quantidadeDias(mes: string, ano: string) {
  if (!mes) return 31
  return new Date(Number(ano) || new Date().getFullYear(), Number(mes), 0).getDate()
}

export function BrazilianDateTimePicker({
  value,
  onChange,
  required = false,
  horarioPadrao,
}: {
  value: string
  onChange: (value: string) => void
  required?: boolean
  horarioPadrao?: string
}) {
  const [partes, setPartes] = useState<PartesDataHora>(() => extrairPartes(value, horarioPadrao))
  const anoAtual = new Date().getFullYear()
  const anos = useMemo(() => {
    const lista = Array.from({ length: 26 }, (_, indice) => String(anoAtual - 10 + indice))
    return partes.ano && !lista.includes(partes.ano) ? [partes.ano, ...lista] : lista
  }, [anoAtual, partes.ano])
  const dias = quantidadeDias(partes.mes, partes.ano)

  const atualizar = (alteracoes: Partial<PartesDataHora>) => {
    const proximas = { ...partes, ...alteracoes }
    const limiteDias = quantidadeDias(proximas.mes, proximas.ano)
    if (Number(proximas.dia) > limiteDias) proximas.dia = String(limiteDias).padStart(2, '0')
    setPartes(proximas)
    const completo = proximas.dia && proximas.mes && proximas.ano && proximas.hora && proximas.minuto
    onChange(completo ? `${proximas.dia}/${proximas.mes}/${proximas.ano} ${proximas.hora}:${proximas.minuto}` : '')
  }

  const limpar = () => {
    const vazio = { dia: '', mes: '', ano: '', hora: '', minuto: '' }
    setPartes(vazio)
    onChange('')
  }

  const classeSelect = 'input-cronograma min-w-0 appearance-auto px-2'

  return (
    <div className="grid gap-2">
      <div className="grid grid-cols-[auto_minmax(0,0.7fr)_minmax(0,1.35fr)_minmax(0,0.9fr)] items-center gap-2">
        <CalendarDays size={15} className="text-foreground-muted" aria-hidden="true" />
        <select required={required} aria-label="Dia" value={partes.dia} onChange={(event) => atualizar({ dia: event.target.value })} className={classeSelect}>
          <option value="">Dia</option>
          {Array.from({ length: dias }, (_, indice) => String(indice + 1).padStart(2, '0')).map((dia) => <option key={dia} value={dia}>{dia}</option>)}
        </select>
        <select required={required} aria-label="Mês" value={partes.mes} onChange={(event) => atualizar({ mes: event.target.value })} className={classeSelect}>
          <option value="">Mês</option>
          {MESES.map((mes, indice) => <option key={mes} value={String(indice + 1).padStart(2, '0')}>{mes}</option>)}
        </select>
        <select required={required} aria-label="Ano" value={partes.ano} onChange={(event) => atualizar({ ano: event.target.value })} className={classeSelect}>
          <option value="">Ano</option>
          {anos.map((ano) => <option key={ano} value={ano}>{ano}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto_minmax(0,1fr)_auto] items-center gap-2">
        <Clock3 size={15} className="text-foreground-muted" aria-hidden="true" />
        <select required={required} aria-label="Hora no formato de 24 horas" value={partes.hora} onChange={(event) => atualizar({ hora: event.target.value })} className={classeSelect}>
          <option value="">Hora</option>
          {Array.from({ length: 24 }, (_, indice) => String(indice).padStart(2, '0')).map((hora) => <option key={hora} value={hora}>{hora}</option>)}
        </select>
        <span aria-hidden="true" className="font-black">:</span>
        <select required={required} aria-label="Minuto" value={partes.minuto} onChange={(event) => atualizar({ minuto: event.target.value })} className={classeSelect}>
          <option value="">Min</option>
          {Array.from({ length: 60 }, (_, indice) => String(indice).padStart(2, '0')).map((minuto) => <option key={minuto} value={minuto}>{minuto}</option>)}
        </select>
        <button type="button" onClick={limpar} disabled={!Object.values(partes).some(Boolean)} className="interactive-control p-2 text-foreground-muted disabled:invisible" aria-label="Limpar data e horário"><X size={14} /></button>
      </div>
      <span className="text-[8px] font-normal normal-case tracking-normal text-foreground-muted">Formato brasileiro · horário de 24 horas</span>
    </div>
  )
}

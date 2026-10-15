'use client'

import { useEffect, useState } from 'react'
import { competenciaBrasil } from '@/lib/financeiro/situacaoFinanceira'

export function useAnoFinanceiro() {
  const [anos, setAnos] = useState(() => {
    const ano = competenciaBrasil(new Date()).ano
    return { atual: ano, selecionado: ano }
  })

  useEffect(() => {
    const atualizar = () => {
      const atual = competenciaBrasil(new Date()).ano
      setAnos(anteriores => anteriores.atual === atual ? anteriores : {
        atual,
        selecionado: anteriores.selecionado === anteriores.atual ? atual : anteriores.selecionado,
      })
    }
    const timer = window.setInterval(atualizar, 60_000)
    window.addEventListener('focus', atualizar)
    document.addEventListener('visibilitychange', atualizar)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', atualizar)
      document.removeEventListener('visibilitychange', atualizar)
    }
  }, [])

  const selecionarAno = (ano: number) => setAnos(anteriores => ({ ...anteriores, selecionado: ano }))
  return { anoAtual: anos.atual, anoSelecionado: anos.selecionado, selecionarAno }
}

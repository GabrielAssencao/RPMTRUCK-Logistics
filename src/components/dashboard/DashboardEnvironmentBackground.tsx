'use client'

import { useEffect, useId, useRef } from 'react'
import { useReducedMotion } from 'framer-motion'
import type { EstiloFundoEmpresa } from '@/lib/empresaPreferences'
import { useTheme } from '@/contexts/ThemeContext'

type Aresta = 0 | 1 | 2 | 3
type Segmento = [Aresta, Aresta]

const NIVEIS = [0.16, 0.23, 0.31, 0.4, 0.5, 0.61, 0.73, 0.86, 1, 1.15, 1.31]
const SEGMENTOS: Record<number, Segmento[]> = {
  1: [[3, 0]], 2: [[0, 1]], 3: [[3, 1]], 4: [[1, 2]],
  6: [[0, 2]], 7: [[3, 2]], 8: [[2, 3]], 9: [[0, 2]],
  11: [[1, 2]], 12: [[1, 3]], 13: [[0, 1]], 14: [[3, 0]],
}

const limitar = (valor: number, minimo: number, maximo: number) => Math.min(maximo, Math.max(minimo, valor))

interface DimensoesCanvas {
  largura: number
  altura: number
  proporcao: number
}

interface ConexaoComEconomiaDeDados {
  saveData?: boolean
  addEventListener?: (type: 'change', listener: EventListener) => void
  removeEventListener?: (type: 'change', listener: EventListener) => void
}

function medirCanvas(canvas: HTMLCanvasElement): DimensoesCanvas {
  return {
    largura: canvas.clientWidth,
    altura: canvas.clientHeight,
    proporcao: Math.min(window.devicePixelRatio || 1, 1.5),
  }
}

function valorDoRelevo(x: number, y: number, fase: number) {
  const relevos = [
    { x: 0.16 + Math.sin(fase) * 0.055, y: 0.18 + Math.cos(fase) * 0.035, sx: 0.23, sy: 0.31, altura: 1.12 },
    { x: 0.79 + Math.cos(fase) * 0.06, y: 0.2 + Math.sin(fase * 2) * 0.025, sx: 0.3, sy: 0.28, altura: 0.98 },
    { x: 0.53 + Math.sin(fase + 1.8) * 0.07, y: 0.82 + Math.cos(fase) * 0.045, sx: 0.34, sy: 0.3, altura: 1.24 },
    { x: -0.08 + Math.cos(fase + 0.7) * 0.035, y: 0.67, sx: 0.25, sy: 0.37, altura: 0.82 },
  ]

  let valor = 0
  for (const relevo of relevos) {
    const dx = (x - relevo.x) / relevo.sx
    const dy = (y - relevo.y) / relevo.sy
    valor += relevo.altura * Math.exp(-(dx * dx + dy * dy) * 1.15)
  }

  const fluxo = Math.sin(x * 5.2 + y * 3.1 + Math.sin(fase) * 0.55) * 0.035
  return valor + fluxo
}

function pontoNaAresta(aresta: Aresta, coluna: number, linha: number, nivel: number, cantos: [number, number, number, number]) {
  const [superiorEsquerdo, superiorDireito, inferiorDireito, inferiorEsquerdo] = cantos
  const interpolar = (inicio: number, fim: number) => limitar((nivel - inicio) / (fim - inicio || 1), 0, 1)

  if (aresta === 0) return [coluna + interpolar(superiorEsquerdo, superiorDireito), linha] as const
  if (aresta === 1) return [coluna + 1, linha + interpolar(superiorDireito, inferiorDireito)] as const
  if (aresta === 2) return [coluna + interpolar(inferiorEsquerdo, inferiorDireito), linha + 1] as const
  return [coluna, linha + interpolar(superiorEsquerdo, inferiorEsquerdo)] as const
}

function desenharTopografia(canvas: HTMLCanvasElement, fase: number, dimensoes: DimensoesCanvas) {
  const contexto = canvas.getContext('2d')
  if (!contexto) return

  const { largura, altura, proporcao } = dimensoes
  if (largura <= 0 || altura <= 0) return

  const larguraFisica = Math.round(largura * proporcao)
  const alturaFisica = Math.round(altura * proporcao)
  if (canvas.width !== larguraFisica || canvas.height !== alturaFisica) {
    canvas.width = larguraFisica
    canvas.height = alturaFisica
  }

  contexto.setTransform(proporcao, 0, 0, proporcao, 0, 0)
  contexto.clearRect(0, 0, largura, altura)

  const colunas = limitar(Math.round(largura / 17), 48, 96)
  const linhas = limitar(Math.round(altura / 17), 32, 68)
  const valores = new Float32Array((colunas + 1) * (linhas + 1))

  for (let linha = 0; linha <= linhas; linha += 1) {
    for (let coluna = 0; coluna <= colunas; coluna += 1) {
      valores[linha * (colunas + 1) + coluna] = valorDoRelevo(coluna / colunas, linha / linhas, fase)
    }
  }

  contexto.strokeStyle = getComputedStyle(canvas).color
  contexto.lineWidth = 1.15
  contexto.lineCap = 'round'
  contexto.lineJoin = 'round'
  contexto.globalAlpha = 0.72
  contexto.beginPath()

  for (const nivel of NIVEIS) {
    for (let linha = 0; linha < linhas; linha += 1) {
      for (let coluna = 0; coluna < colunas; coluna += 1) {
        const indice = linha * (colunas + 1) + coluna
        const cantos: [number, number, number, number] = [
          valores[indice],
          valores[indice + 1],
          valores[indice + colunas + 2],
          valores[indice + colunas + 1],
        ]
        const caso = (cantos[0] >= nivel ? 1 : 0)
          | (cantos[1] >= nivel ? 2 : 0)
          | (cantos[2] >= nivel ? 4 : 0)
          | (cantos[3] >= nivel ? 8 : 0)
        let segmentos = SEGMENTOS[caso] ?? []

        if (caso === 5) segmentos = (cantos[0] + cantos[1] + cantos[2] + cantos[3]) / 4 >= nivel ? [[3, 2], [0, 1]] : [[3, 0], [1, 2]]
        if (caso === 10) segmentos = (cantos[0] + cantos[1] + cantos[2] + cantos[3]) / 4 >= nivel ? [[3, 0], [1, 2]] : [[0, 1], [2, 3]]

        for (const [inicio, fim] of segmentos) {
          const pontoInicial = pontoNaAresta(inicio, coluna, linha, nivel, cantos)
          const pontoFinal = pontoNaAresta(fim, coluna, linha, nivel, cantos)
          contexto.moveTo(pontoInicial[0] / colunas * largura, pontoInicial[1] / linhas * altura)
          contexto.lineTo(pontoFinal[0] / colunas * largura, pontoFinal[1] / linhas * altura)
        }
      }
    }
  }

  contexto.stroke()
}

function TopographicCanvas({ preview = false }: { preview?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const movimentoReduzido = useReducedMotion() === true
  const { primary } = useTheme()

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const canvasAtivo = canvas

    let quadro = 0
    let temporizadorResize = 0
    let ultimoDesenho = 0
    let visivel = true
    let paginaVisivel = !document.hidden
    let dimensoes = medirCanvas(canvas)
    const inicio = performance.now()
    const duracaoCiclo = 24_000
    const dispositivoCompacto = window.matchMedia('(max-width: 767px), (pointer: coarse)')
    const conexao = (navigator as Navigator & { connection?: ConexaoComEconomiaDeDados }).connection
    let economiaDeDados = conexao?.saveData === true

    const podeAnimar = () => visivel && paginaVisivel && !economiaDeDados && !movimentoReduzido && !preview

    const cancelarQuadro = () => {
      if (quadro) window.cancelAnimationFrame(quadro)
      quadro = 0
    }

    const agendarQuadro = () => {
      if (podeAnimar() && !quadro) quadro = window.requestAnimationFrame(desenhar)
    }

    function desenhar(agora: number, forcar = false) {
      quadro = 0
      const intervaloEntreQuadros = dispositivoCompacto.matches ? 60 : 40
      if (visivel && paginaVisivel && (forcar || agora - ultimoDesenho >= intervaloEntreQuadros)) {
        const fase = podeAnimar() ? ((agora - inicio) % duracaoCiclo) / duracaoCiclo * Math.PI * 2 : 0
        desenharTopografia(canvasAtivo, fase, dimensoes)
        ultimoDesenho = agora
      }
      agendarQuadro()
    }

    const sincronizarExecucao = () => {
      paginaVisivel = !document.hidden
      economiaDeDados = conexao?.saveData === true
      if (podeAnimar()) {
        ultimoDesenho = 0
        agendarQuadro()
      } else {
        cancelarQuadro()
        if (paginaVisivel && visivel) desenhar(performance.now(), true)
      }
    }

    const observarVisibilidade = new IntersectionObserver(([entrada]) => {
      visivel = entrada.isIntersecting
      sincronizarExecucao()
    })
    const observarTamanho = new ResizeObserver(() => {
      window.clearTimeout(temporizadorResize)
      temporizadorResize = window.setTimeout(() => {
        dimensoes = medirCanvas(canvas)
        if (paginaVisivel && visivel) {
          cancelarQuadro()
          desenhar(performance.now(), true)
        }
      }, 160)
    })
    const aoMudarConexao: EventListener = () => sincronizarExecucao()

    document.addEventListener('visibilitychange', sincronizarExecucao)
    dispositivoCompacto.addEventListener('change', sincronizarExecucao)
    conexao?.addEventListener?.('change', aoMudarConexao)
    observarVisibilidade.observe(canvas)
    observarTamanho.observe(canvas)
    desenhar(inicio, true)

    return () => {
      cancelarQuadro()
      window.clearTimeout(temporizadorResize)
      document.removeEventListener('visibilitychange', sincronizarExecucao)
      dispositivoCompacto.removeEventListener('change', sincronizarExecucao)
      conexao?.removeEventListener?.('change', aoMudarConexao)
      observarVisibilidade.disconnect()
      observarTamanho.disconnect()
    }
  }, [movimentoReduzido, preview, primary])

  return <canvas ref={canvasRef} className="dashboard-topographic-canvas" />
}

function GlassAuroraBackground() {
  return (
    <div className="dashboard-glass-aurora" aria-hidden="true">
      <div className="dashboard-glass-aurora__wave">
        {Array.from({ length: 3 }, (_, index) => <span key={index} />)}
      </div>
      <span className="dashboard-glass-aurora__haze" />
      <span className="dashboard-glass-aurora__pane" />
    </div>
  )
}

function GlassLayersBackground() {
  return (
    <div className="dashboard-glass-stack" aria-hidden="true">
      <div className="dashboard-glass-stack__halo" />
      <div className="dashboard-glass-stack__panels">
        {Array.from({ length: 7 }, (_, index) => <span key={index} />)}
      </div>
    </div>
  )
}

function OrganicDrawingBackground() {
  const motifId = `rpm-organic-${useId().replaceAll(':', '')}`

  return (
    <svg className="dashboard-organic-drawing" viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <g id={motifId} fill="none" stroke="currentColor" strokeWidth="13" strokeLinecap="round" strokeLinejoin="round">
          <path d="M34 58c0-30 48-42 69-19 18 19-2 42 18 59 21 18 54 1 55-28" />
          <path d="M229 26c-26 8-39 39-23 60 17 23 59 17 66-12 7-30 35-45 61-29" />
          <path d="M395 34c-10 35 5 64 37 72 28 7 61-9 72-36" />
          <path d="M570 24c-9 23-7 49 12 66 25 21 67 10 75-21 8-29 40-41 65-23" />
          <path d="M790 34c-25 2-43 23-41 47 3 30 40 46 65 30 22-14 48-9 63 11" />
          <path d="M955 30c-8 34 12 68 46 76 31 7 63-12 69-43" />
          <path d="M64 162c26-30 72-31 99-2 22 24 24 59 7 85" />
          <path d="M260 166c-15 17-15 43 1 59 18 18 49 16 64-5 14-19 39-26 61-17" />
          <path d="M474 166c30-15 67 0 77 32 8 26-5 54-29 65" />
          <path d="M650 167c15 28 45 44 77 38 27-5 48-27 51-54" />
          <path d="M865 178c-6 28 11 56 39 63 30 8 60-11 67-41 6-26 31-43 57-38" />
          <path d="M1082 157c-24 13-34 43-22 68 10 22 35 34 58 27" />
        </g>
      </defs>
      <g className="dashboard-organic-drawing__layer dashboard-organic-drawing__layer--primary">
        <use href={`#${motifId}`} x="0" y="0" />
        <use href={`#${motifId}`} x="-70" y="280" />
        <use href={`#${motifId}`} x="40" y="560" />
      </g>
      <g className="dashboard-organic-drawing__layer dashboard-organic-drawing__layer--secondary">
        <use href={`#${motifId}`} x="100" y="130" />
        <use href={`#${motifId}`} x="-20" y="420" />
        <use href={`#${motifId}`} x="80" y="700" />
      </g>
    </svg>
  )
}

function BackgroundArtwork({ estilo, preview }: { estilo: Exclude<EstiloFundoEmpresa, 'DESLIGADO'>; preview: boolean }) {
  if (estilo === 'DIGITAL') return <span className="dashboard-ambient-layer" />
  if (estilo === 'TOPOGRAFICO') return <TopographicCanvas preview={preview} />
  if (estilo === 'VIDRO_FLUIDO') return <GlassAuroraBackground />
  if (estilo === 'VIDRO_CAMADAS') return <GlassLayersBackground />
  return <OrganicDrawingBackground />
}

export default function DashboardEnvironmentBackground({ estilo, preview = false }: { estilo: EstiloFundoEmpresa; preview?: boolean }) {
  if (estilo === 'DESLIGADO') return null

  return (
    <div className="dashboard-environment-layer" data-environment-style={estilo.toLowerCase()} data-environment-preview={preview ? 'true' : 'false'} aria-hidden="true">
      <BackgroundArtwork estilo={estilo} preview={preview} />
      <span className="dashboard-environment-glow" />
    </div>
  )
}

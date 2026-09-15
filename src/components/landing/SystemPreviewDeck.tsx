'use client'

import { useState } from 'react'
import Image from 'next/image'
import { m as motion, useReducedMotion } from 'framer-motion'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import styles from './HeroShowcase.module.css'
import FractalBackdrop from '@/components/brand/FractalBackdrop'

const SCREENS = [
  { label: 'PAINEL', image: '/previews/dashboard.png', title: 'A operação em uma visão.', detail: 'Sinta o pulso da operação: indicadores, custos e prioridades juntos.', alt: 'Tela demonstrativa do painel de gestão de frota RPMTruck' },
  { label: 'TAREFAS', image: '/previews/tasks.png', title: 'Uma equipe, na mesma direção.', detail: 'Dê ritmo à execução com responsáveis e prazos definidos.', alt: 'Tela demonstrativa do quadro de tarefas da RPMTruck' },
  { label: 'CALENDÁRIO', image: '/previews/calendar.png', title: 'O próximo passo, no seu radar.', detail: 'Organize os lembretes de hoje e os compromissos que vêm pela frente.', alt: 'Tela demonstrativa do calendário mensal da RPMTruck' },
  { label: 'CONTAINERS', image: '/previews/containers.png', title: 'Cada carga, sob controle.', detail: 'Containers, trajetos e fretes organizados em uma só operação.', alt: 'Tela demonstrativa do módulo de containers da RPMTruck' },
  { label: 'CUSTOS / DESPESAS', image: '/previews/costs.png', title: 'Mais clareza em cada despesa.', detail: 'Enxergue o que pesa na operação, do abastecimento à manutenção.', alt: 'Tela demonstrativa do módulo de custos e despesas da RPMTruck' },
] as const

export default function SystemPreviewDeck() {
  const [active, setActive] = useState(0)
  const [failed, setFailed] = useState<string[]>([])
  const reduced = useReducedMotion()
  const change = (delta: number) => setActive((value) => (value + delta + SCREENS.length) % SCREENS.length)
  return (
    <section className={styles.showcase} aria-label="Prévia do sistema" aria-roledescription="carrossel" onKeyDown={(event) => { if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); change(event.key === 'ArrowLeft' ? -1 : 1) } }}>
      <FractalBackdrop className={styles.fractalBackdrop} />
      <div className={styles.deck}>
        {SCREENS.map((screen, index) => {
          const position = (index - active + SCREENS.length) % SCREENS.length
          const front = position === 0
          const depth = Math.min(position, 3)
          return (
            <motion.article key={screen.image} className={styles.card} aria-hidden={!front} aria-label={front ? screen.alt : undefined} initial={false} animate={{ x: depth * -28, y: depth * -34, rotate: -5 + depth * -4, scale: 1 - depth * 0.045 }} whileHover={front && !reduced ? { rotate: -2, scale: 1.02, y: -6 } : undefined} onPointerMove={(event) => {
              if (!front || reduced || event.pointerType !== 'mouse') return
              const bounds = event.currentTarget.getBoundingClientRect()
              event.currentTarget.style.setProperty('--reflection-x', ((event.clientX - bounds.left) / bounds.width * 100) + '%')
              event.currentTarget.style.setProperty('--reflection-y', ((event.clientY - bounds.top) / bounds.height * 100) + '%')
            }} transition={{ duration: reduced ? 0 : 0.45, ease: [0.4, 0, 0.2, 1] }} style={{ zIndex: SCREENS.length - position }}>
              <div className={styles.cardHeader}><span className={styles.cardDot} /><span>RPMTRUCK / {screen.label}</span><span className={styles.cardNumber}>0{index + 1}</span></div>
              <div className={styles.screen}>
                {failed.includes(screen.image) ? <div className={styles.imageError}>Prévia indisponível. Explore as outras telas pelas setas.</div> : <Image src={screen.image} alt={front ? screen.alt : ''} fill sizes="(max-width: 767px) 85vw, (max-width: 1279px) 55vw, 680px" className={styles.screenshot} loading={front ? 'eager' : 'lazy'} fetchPriority={front ? 'high' : 'low'} onError={() => setFailed((images) => images.includes(screen.image) ? images : [...images, screen.image])} />}
              </div>
              <div className={styles.cardFooter}><span>RPMTRUCK / SUA OPERAÇÃO NO RITMO CERTO</span><span aria-hidden="true">↗</span></div>
            </motion.article>
          )
        })}
      </div>
      <div className={styles.showcaseBottom}>
        <div className={styles.caption} aria-live="polite" aria-atomic="true"><span className={styles.counter}>0{active + 1} / 0{SCREENS.length}</span><h2>{SCREENS[active].title}</h2><p>{SCREENS[active].detail}</p></div>
        <div className={styles.arrows}><button type="button" onClick={() => change(-1)} aria-label="Tela anterior"><ArrowLeft size={20} /></button><button type="button" onClick={() => change(1)} aria-label="Próxima tela"><ArrowRight size={20} /></button></div>
      </div>
      <p className={styles.disclaimer}>Telas do sistema com dados de demonstração. Recursos variam conforme o plano.</p>
    </section>
  )
}

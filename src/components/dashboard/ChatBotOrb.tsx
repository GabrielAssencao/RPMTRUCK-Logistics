'use client'

import { useSyncExternalStore } from 'react'
import { Bot } from 'lucide-react'

interface ConnectionWithSaveData extends EventTarget {
  saveData?: boolean
}

function connection() {
  return (navigator as Navigator & { connection?: ConnectionWithSaveData }).connection
}

function observeAnimationAvailability(onChange: () => void) {
  const network = connection()
  document.addEventListener('visibilitychange', onChange)
  network?.addEventListener('change', onChange)
  return () => {
    document.removeEventListener('visibilitychange', onChange)
    network?.removeEventListener('change', onChange)
  }
}

function shouldPauseAnimation() {
  return document.hidden || connection()?.saveData === true
}

function animationAvailableOnServer() {
  return false
}

interface ChatBotOrbProps {
  active?: boolean
  compact?: boolean
  label?: string
}

export function ChatBotOrb({ active = false, compact = false, label }: ChatBotOrbProps) {
  const paused = useSyncExternalStore(observeAnimationAvailability, shouldPauseAnimation, animationAvailableOnServer)

  return (
    <span
      className="chat-bot-orb shrink-0"
      data-active={active ? 'true' : 'false'}
      data-compact={compact ? 'true' : 'false'}
      data-paused={paused ? 'true' : 'false'}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <span className="chat-bot-orb__fire" aria-hidden="true" />
      <span className="chat-bot-orb__flare chat-bot-orb__flare--one" aria-hidden="true" />
      <span className="chat-bot-orb__flare chat-bot-orb__flare--two" aria-hidden="true" />
      <span className="chat-bot-orb__core" aria-hidden="true"><Bot size={compact ? 12 : 15} /></span>
    </span>
  )
}

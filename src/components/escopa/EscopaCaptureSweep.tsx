'use client'

import { useEffect, useRef } from 'react'

import { SpanishCard } from './SpanishCard'
import { toDisplayRank, toDisplaySuit } from './escopa-card-display'
import type { EscopaSweepGhost } from './escopa-sweep-ghosts'

function SweepGhost({ ghost, onDone }: { ghost: EscopaSweepGhost; onDone: (key: string) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone

  useEffect(() => {
    const element = ref.current
    if (element == null) return
    const dx = ghost.to.x - ghost.from.x
    const dy = ghost.to.y - ghost.from.y
    const animation = element.animate(
      [
        { transform: 'translate(-50%, -50%) scale(1) rotate(0deg)', opacity: 1 },
        {
          transform: `translate(calc(-50% + ${dx * 0.55}px), calc(-50% + ${dy * 0.45}px)) scale(0.9) rotate(${dx > 0 ? 6 : -6}deg)`,
          opacity: 1,
          offset: 0.55,
        },
        {
          transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(0.66) rotate(0deg)`,
          opacity: 0,
        },
      ],
      {
        duration: 560,
        delay: ghost.delayMs,
        easing: 'cubic-bezier(.18, .78, .22, 1)',
        fill: 'forwards',
      },
    )
    animation.onfinish = () => { onDoneRef.current(ghost.key) }
    return () => { animation.cancel() }
  }, [ghost])

  return (
    <div
      ref={ref}
      className="et-sweep-ghost"
      style={{ left: ghost.from.x, top: ghost.from.y }}
    >
      <SpanishCard
        rank={toDisplayRank(ghost.card.rank)}
        suit={toDisplaySuit(ghost.card.suit)}
        size="sm"
        faceDown={ghost.faceDown}
      />
    </div>
  )
}

export function EscopaCaptureSweep({
  ghosts,
  onGhostDone,
}: {
  ghosts: EscopaSweepGhost[]
  onGhostDone: (key: string) => void
}) {
  if (ghosts.length === 0) return null

  return (
    <div className="et-sweep-layer" aria-hidden="true">
      {ghosts.map((ghost) => (
        <SweepGhost key={ghost.key} ghost={ghost} onDone={onGhostDone} />
      ))}
    </div>
  )
}

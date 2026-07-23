import type { Card } from '../../lib/escopa-engine'

export interface EscopaSweepGhost {
  key: string
  card: Card
  faceDown: boolean
  from: { x: number; y: number }
  to: { x: number; y: number }
  delayMs: number
}

/**
 * Reads the on-table positions of the cards a play is about to remove, so the
 * sweep can replay their journey to the captor's pile. Must run before the
 * snapshot updates and the source elements unmount.
 */
export function collectSweepGhosts({
  playedCard,
  capturedCards,
  captor,
}: {
  playedCard: Card
  capturedCards: Card[]
  captor: 0 | 1
}): EscopaSweepGhost[] {
  if (typeof window === 'undefined') return []
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return []

  const pileSpot = document.querySelector(
    `[data-testid="${captor === 0 ? 'escopa-side-you' : 'escopa-side-villain'}"] .et-pile-spot`,
  )
  if (pileSpot == null) return []
  const target = pileSpot.getBoundingClientRect()
  const to = { x: target.left + target.width / 2, y: target.top + target.height / 2 }

  const ghosts: EscopaSweepGhost[] = []
  for (const [index, card] of [playedCard, ...capturedCards].entries()) {
    const source = document.querySelector(`[data-card-id="${card.id}"]`)
    if (source == null) continue
    const rect = source.getBoundingClientRect()
    ghosts.push({
      key: `${card.id}-${Date.now()}`,
      card,
      faceDown: false,
      from: { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 },
      to,
      delayMs: index * 55,
    })
  }
  return ghosts
}

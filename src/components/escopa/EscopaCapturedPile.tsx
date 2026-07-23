'use client'

import type { CSSProperties } from 'react'

import { SpanishCard } from './SpanishCard'

const MAX_VISIBLE_PILE_CARDS = 4
const MAX_VISIBLE_SCOPA_MARKERS = 4

export function EscopaCapturedPile({
  owner,
  capturedCount,
  scopaCount,
}: {
  owner: 'you' | 'villain'
  capturedCount: number
  scopaCount: number
}) {
  const visibleCards = Math.min(capturedCount, MAX_VISIBLE_PILE_CARDS)
  const visibleMarkers = Math.min(scopaCount, MAX_VISIBLE_SCOPA_MARKERS)
  const label = owner === 'you' ? 'Your captured pile' : "Opponent's captured pile"
  const noteParts: string[] = []
  if (capturedCount > 0) {
    noteParts.push(`${capturedCount} ${capturedCount === 1 ? 'card' : 'cards'}`)
  }
  if (scopaCount > 0) {
    noteParts.push(`${scopaCount} ${scopaCount === 1 ? 'escopa' : 'escopas'}`)
  }

  return (
    <aside
      className={`et-pile et-pile-${owner}`}
      data-testid={owner === 'you' ? 'escopa-side-you' : 'escopa-side-villain'}
      aria-label={`${label}: ${capturedCount} cards, ${scopaCount} escopas`}
    >
      <div className="et-pile-spot" key={`pile-${capturedCount}`}>
        {/* escopa markers rest sideways under the pile, the way a real scopa is kept */}
        {Array.from({ length: visibleMarkers }, (_, index) => (
          <span
            key={`scopa-${index}`}
            className="et-pile-marker"
            style={{ '--marker-index': index } as CSSProperties}
          >
            <SpanishCard rank={1} suit="oros" size="sm" faceDown />
          </span>
        ))}
        {Array.from({ length: visibleCards }, (_, index) => (
          <span
            key={`card-${index}`}
            className="et-pile-card"
            style={{ '--pile-index': index } as CSSProperties}
          >
            <SpanishCard rank={1} suit="oros" size="sm" faceDown />
          </span>
        ))}
      </div>
      <div className="et-pile-note">{noteParts.length > 0 ? noteParts.join(' · ') : 'nothing yet'}</div>
    </aside>
  )
}

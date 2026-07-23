'use client'

import { SpanishCard } from './SpanishCard'
import type { EscopaDeckDockState } from '../../lib/escopa-ui-state'

export function EscopaDeckDock({ dock }: { dock: EscopaDeckDockState }) {
  if (dock.variant === 'none') {
    return (
      <div className="et-deck et-deck--none" data-testid="escopa-deck-dock" aria-label="Stock exhausted">
        <span className="et-deck-note">stock is out</span>
      </div>
    )
  }

  if (dock.variant === 'count-only') {
    return (
      <div className="et-deck et-deck--count" data-testid="escopa-deck-dock" aria-label={dock.stockLabel}>
        <span className="et-deck-count">{dock.stockRemaining}</span>
        <span className="et-deck-note">in stock</span>
      </div>
    )
  }

  if (dock.variant === 'icon') {
    return (
      <div className="et-deck et-deck--icon" data-testid="escopa-deck-dock" aria-label={dock.stockLabel}>
        <span className="et-deck-icon-card">
          <SpanishCard rank={1} suit="oros" size="sm" faceDown />
        </span>
        <span className="et-deck-count">{dock.stockRemaining}</span>
      </div>
    )
  }

  return (
    <div className="et-deck et-deck--full" data-testid="escopa-deck-dock" aria-label={dock.stockLabel}>
      <div className="et-deck-stack">
        <SpanishCard rank={1} suit="oros" size="sm" faceDown className="et-deck-layer et-deck-layer-0" />
        <SpanishCard rank={1} suit="oros" size="sm" faceDown className="et-deck-layer et-deck-layer-1" />
        <SpanishCard rank={1} suit="oros" size="sm" faceDown className="et-deck-layer et-deck-layer-2" />
      </div>
      <div className="et-deck-note">
        {dock.stockRemaining} in stock
        {dock.redealsRemaining > 0 && (
          <>
            <br />
            {dock.redealsRemaining} {dock.redealsRemaining === 1 ? 'deal' : 'deals'} to come
          </>
        )}
      </div>
    </div>
  )
}

'use client'

import type { CSSProperties } from 'react'

import { SpanishCard } from './SpanishCard'
import type { EscopaTableCardStack } from '../../lib/escopa-ui-state'
import { casualTilt, toDisplayRank, toDisplaySuit } from './escopa-card-display'

export function EscopaTableRack({
  stacks,
  highlightedCardIds,
}: {
  stacks: EscopaTableCardStack[]
  highlightedCardIds: ReadonlySet<string>
}) {
  return (
    <div className="et-rack">
      {stacks.map((stack) => (
        <div
          key={stack.rank}
          className="et-stack"
          style={{ '--stack-depth': stack.cards.length - 1 } as CSSProperties}
        >
          {/* index 0 is the logical top card, so paint it last */}
          {[...stack.cards].reverse().map((card, paintIndex) => {
            const depth = stack.cards.length - 1 - paintIndex
            const isTop = depth === 0
            const isTarget = highlightedCardIds.has(card.id)
            return (
              <div
                key={card.id}
                data-card-id={card.id}
                className={`et-stack-card ${isTop ? 'is-top' : ''} ${isTarget ? 'is-capture-target' : ''}`}
                style={{
                  '--depth': depth,
                  '--tilt': `${casualTilt(card.id)}deg`,
                } as CSSProperties}
              >
                <SpanishCard
                  rank={toDisplayRank(card.rank)}
                  suit={toDisplaySuit(card.suit)}
                  size="sm"
                />
                {isTop && stack.isScoringSuitTop && <span className="et-jewel" aria-hidden="true" />}
              </div>
            )
          })}
        </div>
      ))}
      {stacks.length === 0 && <div className="et-rack-empty">a clean table</div>}
    </div>
  )
}

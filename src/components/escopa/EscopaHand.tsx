'use client'

import type { CSSProperties, KeyboardEvent } from 'react'

import { SpanishCard } from './SpanishCard'
import type { EscopaCaptureChoiceState } from '../../lib/escopa-ui-state'
import type { Card } from '../../lib/escopa-engine'
import { casualTilt, spokenCardName, toDisplayRank, toDisplaySuit } from './escopa-card-display'

type CardChoice = EscopaCaptureChoiceState['byCard'][string]

function affordanceClass(choice: CardChoice | undefined): string {
  if (choice == null) return ''
  if (choice.mustDiscard || choice.captureGroups.length === 0) return 'is-discard-candidate'
  return choice.selectedCaptureGroupId != null && choice.captureGroups.length > 1
    ? 'is-capture-selected'
    : 'is-capture-candidate'
}

function EscopaHandCard({
  card,
  choice,
  active,
  onPlay,
  onCycle,
  onHoverChange,
}: {
  card: Card
  choice: CardChoice | undefined
  active: boolean
  onPlay: (cardId: string) => void
  onCycle: (cardId: string, direction: 'previous' | 'next') => void
  onHoverChange: (cardId: string | null) => void
}) {
  const captureCount = choice?.captureGroups.length ?? 0
  const showCycle = active && captureCount > 1
  const spoken = spokenCardName(card)

  const onPlayKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!showCycle) return
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault()
      onCycle(card.id, 'next')
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault()
      onCycle(card.id, 'previous')
    }
  }

  return (
    <li
      data-card-id={card.id}
      className={`et-hand-card ${affordanceClass(choice)} ${active ? '' : 'is-inactive-player'}`}
      onPointerEnter={() => { onHoverChange(card.id) }}
      onPointerLeave={() => { onHoverChange(null) }}
      onFocus={() => { onHoverChange(card.id) }}
      onBlur={() => { onHoverChange(null) }}
    >
      <div className="et-card-shell">
        <SpanishCard
          rank={toDisplayRank(card.rank)}
          suit={toDisplaySuit(card.suit)}
          size="md"
        />
        <button
          type="button"
          className="et-play-card"
          onClick={() => { onPlay(card.id) }}
          onKeyDown={onPlayKeyDown}
          disabled={!active}
          aria-label={
            captureCount > 0
              ? `Play ${spoken} and capture${captureCount > 1 ? ' (arrow keys change the capture)' : ''}`
              : `Lay down ${spoken}`
          }
        />
      </div>
      {showCycle && (
        <span className="et-hand-cycle">
          <button
            type="button"
            onClick={() => { onCycle(card.id, 'previous') }}
            aria-label={`Previous capture choice for ${spoken}`}
          >‹</button>
          <span className="et-hand-cycle-count" aria-hidden="true">
            {(choice?.selectedCaptureGroupIndex ?? 0) + 1} of {captureCount}
          </span>
          <button
            type="button"
            onClick={() => { onCycle(card.id, 'next') }}
            aria-label={`Next capture choice for ${spoken}`}
          >›</button>
        </span>
      )}
    </li>
  )
}

export function EscopaHand({
  cards,
  choices,
  owner,
  active,
  onPlay,
  onCycle,
  onHoverChange,
}: {
  cards: Card[]
  choices: EscopaCaptureChoiceState | null
  owner: 'hero' | 'villain'
  active: boolean
  onPlay?: (cardId: string) => void
  onCycle?: (cardId: string, direction: 'previous' | 'next') => void
  onHoverChange?: (cardId: string | null) => void
}) {
  if (owner === 'villain') {
    return (
      <ul className="et-hand et-hand-villain" data-testid="escopa-villain-hand" aria-label="Opponent hand">
        {cards.map((card) => (
          <li key={card.id} data-card-id={card.id} className="et-hand-card is-face-down" style={{ '--tilt': `${casualTilt(card.id, 2)}deg` } as CSSProperties}>
            <SpanishCard rank={1} suit="oros" size="sm" faceDown />
          </li>
        ))}
      </ul>
    )
  }

  return (
    <ul className="et-hand et-hand-hero" data-testid="escopa-hero-hand" aria-label="Your hand">
      {cards.map((card) => (
        <EscopaHandCard
          key={card.id}
          card={card}
          choice={choices?.byCard[card.id]}
          active={active}
          onPlay={onPlay ?? (() => {})}
          onCycle={onCycle ?? (() => {})}
          onHoverChange={onHoverChange ?? (() => {})}
        />
      ))}
    </ul>
  )
}

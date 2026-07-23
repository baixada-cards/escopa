import type { Card } from '../../lib/escopa-engine'
import type { Suit } from './SpanishCard'

/**
 * Engine ranks carry capture values (Q=8, J=9, K=10) but the Spanish deck has
 * no 8 or 9: those ranks are Sota, Caballo and Rey, which SpanishCard renders
 * from the display numbers 10, 11 and 12.
 */
const ENGINE_RANK_TO_DISPLAY: Record<Card['rank'], number> = {
  A: 1,
  '2': 2,
  '3': 3,
  '4': 4,
  '5': 5,
  '6': 6,
  '7': 7,
  Q: 10,
  J: 11,
  K: 12,
}

const ENGINE_RANK_SPOKEN: Record<Card['rank'], string> = {
  A: 'ace',
  '2': 'two',
  '3': 'three',
  '4': 'four',
  '5': 'five',
  '6': 'six',
  '7': 'seven',
  Q: 'sota',
  J: 'caballo',
  K: 'rey',
}

export function toDisplayRank(rank: Card['rank']): number {
  return ENGINE_RANK_TO_DISPLAY[rank]
}

export function toDisplaySuit(suit: Card['suit']): Suit {
  if (suit === 'OROS') return 'oros'
  if (suit === 'COPAS') return 'copas'
  if (suit === 'ESPADAS') return 'espadas'
  return 'bastos'
}

export function spokenCardName(card: Card): string {
  return `${ENGINE_RANK_SPOKEN[card.rank]} of ${card.suit.toLowerCase()}`
}

/** Small deterministic tilt so cards rest casually instead of on a grid. */
export function casualTilt(seed: string, spread = 3): number {
  let hash = 0
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) | 0
  }
  const normalized = ((hash % 1000) + 1000) % 1000 / 1000
  return Math.round((normalized * 2 - 1) * spread * 10) / 10
}

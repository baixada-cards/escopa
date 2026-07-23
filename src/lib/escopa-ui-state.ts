import type { Card, EscopaScoringSuit, HandMap, Score } from './escopa-engine.ts'

export type EscopaHandChoiceClass =
  | 'is-discard-candidate'
  | 'is-capture-candidate'
  | 'is-capture-selected'
  | 'is-capture-failed'
  | 'is-capture-success'

export type EscopaHandOutcome = 'discard' | 'capture'
export type EscopaScopaBurst = 'opening' | 'double' | 'normal'
export type EscopaPlayer = 0 | 1

type RankValueMap = Record<string, number>

const CARD_VALUES: RankValueMap = {
  A: 1,
  '2': 2,
  '3': 3,
  '4': 4,
  '5': 5,
  '6': 6,
  '7': 7,
  Q: 8,
  J: 9,
  K: 10,
}

const BELO_RANKS = new Set(['A', '7', 'Q', 'K'])

const SORTED_PLAYER_KEYS = [0, 1] as const

function cardValue(rank: string): number {
  return CARD_VALUES[rank] ?? 0
}

export interface EscopaTableCardStack {
  rank: Card['rank']
  cards: Card[]
  topCard: Card
  isScoringSuitTop: boolean
}

export interface EscopaCaptureGroup {
  indices: number[]
  cardIds: string[]
  cards: Card[]
  id: string
  value: number
  visualRank: string
  isPrimary: boolean
  isScopaPotential: boolean
}

export interface EscopaCaptureChoiceState {
  byCard: Record<string, {
    cardId: string
    playable: boolean
    mustDiscard: boolean
    captureGroups: EscopaCaptureGroup[]
    selectedCaptureGroupId: string | null
    selectedCaptureGroupIndex: number
    nextCaptureGroupId: string | null
    previousCaptureGroupId: string | null
  }>
}

export interface EscopaHandChoicesParams {
  state: {
    hands: {
      0: Card[]
      1: Card[]
    }
    table: Card[]
    next_player: EscopaPlayer | null
  }
  player: EscopaPlayer
  scoringSuit?: EscopaScoringSuit
  selectedCaptureChoiceIdByCardId?: Record<string, string | null>
}

export interface EscopaPontoSlot {
  count: number
  isSatisfied: boolean
}

export interface EscopaPlayerScoreSlots {
  capturedStackCount: number
  escopaCount: number
  belos: EscopaPontoSlot
  moreThan20Cards: EscopaPontoSlot
  moreThanFiveScoringSuitCards: EscopaPontoSlot
  sevens: EscopaPontoSlot
  majorityCards: EscopaPontoSlot
}

export interface EscopaScoreSlots {
  0: EscopaPlayerScoreSlots
  1: EscopaPlayerScoreSlots
}

export interface EscopaRoundTransitionPlayerOutcome {
  player: EscopaPlayer | null
  captureType: EscopaHandOutcome | null
  playedCardId: string | null
  capturedCardIds: string[]
  cardResultFlags: EscopaHandChoiceClass[]
  scopaBurst: EscopaScopaBurst | null
}

export interface EscopaRoundOutcome {
  byPlayer: {
    0: EscopaRoundTransitionPlayerOutcome
    1: EscopaRoundTransitionPlayerOutcome
  }
}

export interface EscopaHudCounters {
  stockRemaining: number
  redealsRemaining: number
  tableCardCount: number
  tableTotal: number
  roundNumber: number
  dealer?: EscopaPlayer
}

export type EscopaDeckDockVariant = 'full' | 'icon' | 'count-only' | 'none'

export interface EscopaDeckDockParams {
  stockRemaining: number
  redealsRemaining?: number
  compactMode?: boolean
  viewportWidth?: number
}

export interface EscopaDeckDockState {
  variant: EscopaDeckDockVariant
  stockRemaining: number
  redealsRemaining: number
  stockLabel: string
  redealsLabel: string
}

export function deriveEscopaTableStacks(
  table: Card[],
  scoringSuit: EscopaScoringSuit,
): EscopaTableCardStack[] {
  const rankBuckets = new Map<Card['rank'], Card[]>()
  const rankOrder: Card['rank'][] = []

  for (const card of table) {
    if (!rankBuckets.has(card.rank)) {
      rankOrder.push(card.rank)
      rankBuckets.set(card.rank, [])
    }
    rankBuckets.get(card.rank)!.push(card)
  }

  return rankOrder.map((rank) => {
    const cardsInRank = rankBuckets.get(rank) ?? []
    const cards = [
      ...cardsInRank.filter((card) => card.suit === scoringSuit),
      ...cardsInRank.filter((card) => card.suit !== scoringSuit),
    ]

    return {
      rank,
      cards,
      topCard: cards[0],
      isScoringSuitTop: cards.length > 0 && cards[0].suit === scoringSuit,
    }
  })
}

export function computeCaptureGroups(table: Card[], playedValue: number): number[][] {
  const needed = 15 - playedValue
  if (needed <= 0) {
    return []
  }

  const cardValues = table.map((card) => cardValue(card.rank))
  const results: number[][] = []
  const visit = (start: number, sum: number, selected: number[]): void => {
    if (sum > needed) {
      return
    }
    if (sum === needed) {
      results.push(selected.slice())
      return
    }

    for (let index = start; index < cardValues.length; index += 1) {
      visit(index + 1, sum + cardValues[index], [...selected, index])
    }
  }

  visit(0, 0, [])

  results.sort((left, right) => {
    if (left.length !== right.length) {
      return left.length - right.length
    }

    const max = Math.min(left.length, right.length)
    for (let index = 0; index < max; index += 1) {
      if (left[index] !== right[index]) {
        return left[index] - right[index]
      }
    }

    return 0
  })

  return results
}

export function normalizeCaptureGroupLabels(
  table: Card[],
  playedValue: number,
  groups: number[][],
): EscopaCaptureGroup[] {
  return groups.map((indices, groupIndex) => {
    const cards = indices.map((tableIndex) => table[tableIndex])
    const visualRank = cards.length === 1 ? cards[0].rank : cards.map((card) => card.rank).join('+')

    return {
      indices,
      cardIds: cards.map((card) => card.id),
      cards,
      id: `capture:${indices.join('-')}`,
      value: playedValue + cards.reduce((sum, card) => sum + cardValue(card.rank), 0),
      visualRank,
      isPrimary: groupIndex === 0,
      isScopaPotential: indices.length === table.length,
    }
  })
}

function captureGroupMaterialSignature(
  cards: Card[],
  isScopaPotential: boolean,
  scoringSuit?: EscopaScoringSuit,
): string {
  const ranks = cards.map((card) => card.rank).join('+')
  if (scoringSuit == null) {
    return `${ranks}|${isScopaPotential ? 1 : 0}`
  }

  let scoringSuitCount = 0
  let scoringSuitBeloCount = 0
  for (const card of cards) {
    if (card.suit !== scoringSuit) {
      continue
    }
    scoringSuitCount += 1
    if (BELO_RANKS.has(card.rank)) {
      scoringSuitBeloCount += 1
    }
  }

  return `${ranks}|${isScopaPotential ? 1 : 0}|${scoringSuitCount}|${scoringSuitBeloCount}`
}

function dedupeCaptureGroups(
  groups: EscopaCaptureGroup[],
  scoringSuit?: EscopaScoringSuit,
): EscopaCaptureGroup[] {
  const seen = new Set<string>()
  const deduped: EscopaCaptureGroup[] = []

  for (const group of groups) {
    const signature = captureGroupMaterialSignature(group.cards, group.isScopaPotential, scoringSuit)
    if (seen.has(signature)) {
      continue
    }
    seen.add(signature)
    deduped.push(group)
  }

  return deduped
}

export function deriveEscopaHandChoices({
  state,
  player,
  scoringSuit = 'OROS',
  selectedCaptureChoiceIdByCardId = {},
}: EscopaHandChoicesParams): EscopaCaptureChoiceState {
  const playable = state.next_player === player
  const byCard: EscopaCaptureChoiceState['byCard'] = {}

  for (const card of state.hands[player]) {
    const rawGroups = computeCaptureGroups(state.table, cardValue(card.rank))
    const captureGroups = dedupeCaptureGroups(
      normalizeCaptureGroupLabels(state.table, cardValue(card.rank), rawGroups),
      scoringSuit,
    )
    const selectedCaptureGroupId = captureGroups.find(
      (group) => group.id === (selectedCaptureChoiceIdByCardId[card.id] ?? null),
    )?.id ?? (captureGroups[0]?.id ?? null)

    const selectedCaptureGroupIndex = selectedCaptureGroupId == null
      ? -1
      : captureGroups.findIndex((group) => group.id === selectedCaptureGroupId)
    const nextCaptureGroupId =
      selectedCaptureGroupIndex >= 0 && captureGroups.length > 1
        ? captureGroups[(selectedCaptureGroupIndex + 1) % captureGroups.length].id
        : null
    const previousCaptureGroupId =
      selectedCaptureGroupIndex >= 0 && captureGroups.length > 1
        ? captureGroups[(selectedCaptureGroupIndex - 1 + captureGroups.length) % captureGroups.length].id
        : null

    byCard[card.id] = {
      cardId: card.id,
      playable,
      mustDiscard: playable && captureGroups.length === 0,
      captureGroups,
      selectedCaptureGroupId,
      selectedCaptureGroupIndex,
      nextCaptureGroupId,
      previousCaptureGroupId,
    }
  }

  return { byCard }
}

export function deriveEscopaScoreSlots(
  captured: HandMap,
  scopas: Score,
  scoringSuit: EscopaScoringSuit,
): EscopaScoreSlots {
  const playerSlots: EscopaScoreSlots = {
    0: {
      capturedStackCount: 0,
      escopaCount: scopas[0],
      belos: { count: 0, isSatisfied: false },
      moreThan20Cards: { count: 0, isSatisfied: false },
      moreThanFiveScoringSuitCards: { count: 0, isSatisfied: false },
      sevens: { count: 0, isSatisfied: false },
      majorityCards: { count: 0, isSatisfied: false },
    },
    1: {
      capturedStackCount: 0,
      escopaCount: scopas[1],
      belos: { count: 0, isSatisfied: false },
      moreThan20Cards: { count: 0, isSatisfied: false },
      moreThanFiveScoringSuitCards: { count: 0, isSatisfied: false },
      sevens: { count: 0, isSatisfied: false },
      majorityCards: { count: 0, isSatisfied: false },
    },
  }

  for (const player of SORTED_PLAYER_KEYS) {
    const playerCards = captured[player]
    const capturedStackCount = playerCards.length
    let beloCount = 0
    let scoringSuitCount = 0
    let sevenCount = 0

    for (const card of playerCards) {
      if (BELO_RANKS.has(card.rank) && card.suit === scoringSuit) {
        beloCount += 1
      }
      if (card.suit === scoringSuit) {
        scoringSuitCount += 1
      }
      if (card.rank === '7') {
        sevenCount += 1
      }
    }

    playerSlots[player] = {
      capturedStackCount,
      escopaCount: scopas[player],
      belos: {
        count: beloCount,
        isSatisfied: beloCount > 0,
      },
      moreThan20Cards: {
        count: capturedStackCount,
        isSatisfied: capturedStackCount > 20,
      },
      moreThanFiveScoringSuitCards: {
        count: scoringSuitCount,
        isSatisfied: scoringSuitCount > 5,
      },
      sevens: { count: sevenCount, isSatisfied: sevenCount > 0 },
      majorityCards: { count: capturedStackCount, isSatisfied: capturedStackCount > captured[SORTED_PLAYER_KEYS[1 - player]].length },
    }
  }

  return playerSlots
}

export function deriveEscopaRoundOutcome({
  previous,
  current,
}: {
  previous: {
    hands: HandMap
    captured: HandMap
    scopas: Score
    table: Card[]
  }
  current: {
    hands: HandMap
    captured: HandMap
    scopas: Score
    table: Card[]
  }
}): EscopaRoundOutcome {
  const byPlayer: EscopaRoundOutcome['byPlayer'] = {
    0: {
      player: 0,
      captureType: null,
      playedCardId: null,
      capturedCardIds: [],
      cardResultFlags: [],
      scopaBurst: null,
    },
    1: {
      player: 1,
      captureType: null,
      playedCardId: null,
      capturedCardIds: [],
      cardResultFlags: [],
      scopaBurst: null,
    },
  }

  for (const player of SORTED_PLAYER_KEYS) {
    const currentHandIds = new Set(current.hands[player].map((card) => card.id))
    const playedCards = previous.hands[player].filter((card) => !currentHandIds.has(card.id))
    if (playedCards.length === 0) {
      continue
    }

    const playedCardId = playedCards[0].id
    const previousCapturedIds = new Set(previous.captured[player].map((card) => card.id))
    const addedCapturedIds = current.captured[player]
      .map((card) => card.id)
      .filter((cardId) => !previousCapturedIds.has(cardId))

    const capturedFromTableIds = addedCapturedIds.filter((cardId) => cardId !== playedCardId)
    const captureType = capturedFromTableIds.length > 0 ? 'capture' : 'discard'
    const classFlags: EscopaHandChoiceClass[] =
      captureType === 'capture'
        ? ['is-capture-success']
        : ['is-capture-failed', 'is-discard-candidate']

    let scopaBurst: EscopaScopaBurst | null = null
    if (captureType === 'capture' && current.table.length === 0 && current.scopas[player] > previous.scopas[player]) {
      if (previous.scopas[player] === 0) {
        scopaBurst = 'opening'
      } else if (previous.scopas[player] === 1) {
        scopaBurst = 'double'
      } else {
        scopaBurst = 'normal'
      }
    }

    byPlayer[player] = {
      player,
      captureType,
      playedCardId,
      capturedCardIds: capturedFromTableIds,
      cardResultFlags: classFlags,
      scopaBurst,
    }
  }

  return { byPlayer }
}

export function deriveEscopaHudCounters({
  stock_remaining,
  table,
  roundNumber = 0,
  redealsRemaining = 0,
  dealer,
}: {
  stock_remaining: number
  table: Card[]
  roundNumber?: number
  redealsRemaining?: number
  dealer?: EscopaPlayer
}): EscopaHudCounters {
  return {
    stockRemaining: stock_remaining,
    redealsRemaining,
    tableCardCount: table.length,
    tableTotal: table.reduce((sum, card) => sum + cardValue(card.rank), 0),
    roundNumber,
    dealer,
  }
}

export function deriveEscopaDeckDockState({
  stockRemaining,
  redealsRemaining = 0,
  compactMode = false,
  viewportWidth,
}: EscopaDeckDockParams): EscopaDeckDockState {
  const hasDeckCards = stockRemaining > 0 || redealsRemaining > 0
  let variant: EscopaDeckDockVariant = hasDeckCards ? 'full' : 'none'

  if (!hasDeckCards) {
    return {
      variant,
      stockRemaining,
      redealsRemaining,
      stockLabel: `${stockRemaining} in stock`,
      redealsLabel: `${redealsRemaining} redraws`,
    }
  }

  if (compactMode) {
    if (viewportWidth != null && viewportWidth < 420) {
      variant = 'icon'
    } else if (viewportWidth != null && viewportWidth < 560) {
      variant = 'count-only'
    } else {
      variant = 'full'
    }
  } else if (viewportWidth != null && viewportWidth < 700) {
    variant = 'count-only'
  }

  return {
    variant,
    stockRemaining,
    redealsRemaining,
    stockLabel: `${stockRemaining} in stock`,
    redealsLabel: `${redealsRemaining} redraws`,
  }
}

import { computeCaptureGroups, deriveEscopaHandChoices, normalizeCaptureGroupLabels } from './escopa-ui-state.ts'
import type { Card, EscopaScoringSuit, EscopaState, HandMap, Score } from './escopa-engine.ts'

type MatchControllerErrorCode =
  | 'match_complete'
  | 'round_complete'
  | 'out_of_turn'
  | 'card_not_in_hand'
  | 'card_not_on_table'
  | 'captured_card_id_duplicate'
  | 'captured_set_not_15'
  | 'missing_capture'
  | 'no_stock_for_new_hand'
  | 'match_redeals_exhausted'
  | 'action_not_allowed_in_round'

interface MatchControllerError extends Error {
  code: MatchControllerErrorCode
}

interface MatchControllerState extends EscopaState {
  round_number: number
  redeals_remaining: number
}

interface MatchControllerConfigDeck {
  deck: Card[]
}

type MatchControllerSeedConfig = Omit<EscopaMatchControllerConfig, 'deck'> & {
  deck?: Card[]
}

interface RoundScratchState {
  hasCapture: boolean
  roundCaptor: EscopaPlayer | null
  roundScopas: Score
  roundCaptured: HandMap
}

export type EscopaDeckType = 'spanish' | 'french'

type EscopaPlayer = 0 | 1

export interface EscopaMatchControllerConfig {
  deck_type?: EscopaDeckType
  dealer?: EscopaPlayer
  target_score?: number
  redeals_remaining?: number
  deck?: Card[]
  shuffle?: (cards: Card[]) => Card[]
}

export interface EscopaMatchPlayAction {
  player: EscopaPlayer
  card_id: string
  capture_group_id?: string | null
  captured_card_ids?: string[]
}

export function resolveDeterministicEscopaAction(
  state: EscopaState,
  player: EscopaPlayer,
  selectedCaptureChoiceIds: Record<string, string | null> = {},
): EscopaMatchPlayAction {
  if (state.round_complete) {
    throw new Error('deterministic action rejected: round complete')
  }

  if (state.match_complete) {
    throw new Error('deterministic action rejected: match complete')
  }

  if (state.next_player == null) {
    throw new Error('deterministic action rejected: no active turn')
  }

  if (state.next_player !== player) {
    throw new Error(`deterministic action rejected: expected player ${state.next_player}, got ${player}`)
  }

  const choices = deriveEscopaHandChoices({
    state: {
      hands: state.hands,
      table: state.table,
      next_player: state.next_player,
    },
    player,
    scoringSuit: state.scoring_suit,
    selectedCaptureChoiceIdByCardId: selectedCaptureChoiceIds,
  })

  let fallbackDiscardCardId: string | null = null
  let fallbackDiscardCardValue = Number.POSITIVE_INFINITY

  for (const handCard of state.hands[player]) {
    const choice = choices.byCard[handCard.id]
    if (choice == null || !choice.playable) {
      continue
    }

    if (choice.captureGroups.length > 0) {
      return {
        player,
        card_id: handCard.id,
        capture_group_id: choice.selectedCaptureGroupId ?? choice.captureGroups[0]?.id ?? null,
      }
    }

    const handCardValue = cardValue(handCard.rank)
    if (handCardValue < fallbackDiscardCardValue) {
      fallbackDiscardCardValue = handCardValue
      fallbackDiscardCardId = handCard.id
    }
  }

  if (fallbackDiscardCardId == null) {
    throw new Error('deterministic action rejected: no playable cards')
  }

  return {
    player,
    card_id: fallbackDiscardCardId,
    capture_group_id: null,
  }
}

export type EscopaMatchController = {
  snapshot: () => MatchControllerState
  resolveNextCaptureChoices: (
    player: EscopaPlayer,
    selectedCaptureChoiceIds?: Record<string, string | null>,
  ) => ReturnType<typeof deriveEscopaHandChoices>
  play: (action: EscopaMatchPlayAction) => void
  start_next_hand: () => void
  redeal_match: () => void
}

export interface EscopaMatchControllerDeckParams {
  deck_type: EscopaDeckType
}

const DECKS: Record<EscopaDeckType, string[]> = {
  spanish: ['OROS', 'COPAS', 'ESPADAS', 'BASTOS'],
  french: ['DIAMONDS', 'HEARTS', 'SPADES', 'CLUBS'],
}

const RANKS: ReadonlyArray<Card['rank']> = ['A', '2', '3', '4', '5', '6', '7', 'Q', 'J', 'K'] as const

const SCORE_VALUES: Record<Card['rank'], number> = {
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

const DEFAULT_MATCH_SCORE = 15
const DEFAULT_MATCH_REDEALS = 2

export function createEscopaDeck({ deck_type }: EscopaMatchControllerDeckParams): Card[] {
  const suits = DECKS[deck_type]
  const cards: Card[] = []
  let counter = 0

  for (const suit of suits) {
    for (const rank of RANKS) {
      cards.push({
        id: `${deck_type}-${suit.toLowerCase()}-${rank}-${counter}`,
        rank,
        suit: suit as Card['suit'],
      })
      counter += 1
    }
  }

  return cards
}

function throwControllerError(code: MatchControllerErrorCode, message: string): never {
  const error = new Error(message) as MatchControllerError
  error.code = code
  throw error
}

function cloneCards(cards: readonly Card[]): Card[] {
  return cards.map((card) => ({ ...card }))
}

function ensureDeckType(deckType: EscopaDeckType | undefined): EscopaDeckType {
  return deckType ?? 'spanish'
}

function resolveScoringSuit(deckType: EscopaDeckType): EscopaScoringSuit {
  return deckType === 'spanish' ? 'OROS' : 'DIAMONDS'
}

function cardValue(rank: Card['rank']): number {
  return SCORE_VALUES[rank]
}

function initialTableScopas(table: Card[]): [number, Card[]] {
  if (table.length !== 4) {
    return [0, []]
  }

  const total = table.reduce((sum, card) => sum + cardValue(card.rank), 0)
  if (total === 15) {
    return [1, [...table]]
  }

  for (let start = 0; start < table.length; start += 1) {
    for (let mask = 1; mask < (1 << table.length); mask += 1) {
      if ((mask & (1 << start)) === 0) {
        continue
      }

      let subsetTotal = 0
      for (let index = 0; index < table.length; index += 1) {
        if ((mask & (1 << index)) !== 0) {
          subsetTotal += cardValue(table[index]!.rank)
        }
      }

      if (subsetTotal === 15) {
        const complementTotal = total - subsetTotal
        if (complementTotal === 15) {
          return [2, [...table]]
        }
      }
    }
  }

  return [0, []]
}

function nextPlayer(player: EscopaPlayer): EscopaPlayer {
  return player === 0 ? 1 : 0
}

function defaultShuffle<T>(cards: T[]): T[] {
  const remaining = [...cards]
  for (let index = remaining.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1))
    const current = remaining[index]
    remaining[index] = remaining[swap] ?? current
    remaining[swap] = current
  }
  return remaining
}

function drawCards(stock: Card[], count: number): Card[] {
  return stock.splice(0, count)
}

function cardById(cards: Card[], ids: string[]): Card[] {
  if (ids.length === 0) {
    return []
  }

  const index = new Map(cards.map((card) => [card.id, card]))
  return ids.map((id) => {
    const card = index.get(id)
    if (card == null) {
      throwControllerError('card_not_on_table', `card ${id} not on table`)
    }
    return card
  })
}

function shouldMatchComplete(score: Score, target: number): boolean {
  const p0 = score[0]
  const p1 = score[1]
  return (p0 >= target || p1 >= target) && p0 !== p1
}

function belaPoints(scoringSuit: EscopaScoringSuit, captured: HandMap): Score {
  const beloCards = new Set<Card['rank']>(['A', '7', 'Q', 'K'])
  return {
    0: captured[0].filter((card) => card.suit === scoringSuit && beloCards.has(card.rank)).length,
    1: captured[1].filter((card) => card.suit === scoringSuit && beloCards.has(card.rank)).length,
  }
}

function majorityCards(captured: HandMap): { winner: EscopaPlayer | null; counts: Score } {
  const counts: Score = {
    0: captured[0].length,
    1: captured[1].length,
  }

  if (counts[0] === counts[1]) {
    return { winner: null, counts }
  }

  return {
    winner: counts[0] > counts[1] ? 0 : 1,
    counts,
  }
}

function majoritySevens(captured: HandMap): { winner: EscopaPlayer | null; counts: Score } {
  const counts: Score = {
    0: captured[0].filter((card) => card.rank === '7').length,
    1: captured[1].filter((card) => card.rank === '7').length,
  }

  if (counts[0] === counts[1]) {
    return { winner: null, counts }
  }

  return {
    winner: counts[0] > counts[1] ? 0 : 1,
    counts,
  }
}

function majorityScoringSuit(scoringSuit: EscopaScoringSuit, captured: HandMap): { winner: EscopaPlayer | null; counts: Score } {
  const counts: Score = {
    0: captured[0].filter((card) => card.suit === scoringSuit).length,
    1: captured[1].filter((card) => card.suit === scoringSuit).length,
  }

  if (counts[0] === counts[1]) {
    return { winner: null, counts }
  }

  return {
    winner: counts[0] > counts[1] ? 0 : 1,
    counts,
  }
}

function computeRoundScoring(scopas: Score, scoringSuit: EscopaScoringSuit, captured: HandMap): Score {
  const belos = belaPoints(scoringSuit, captured)
  const majorityCardsResult = majorityCards(captured)
  const majoritySevensResult = majoritySevens(captured)
  const majoritySuitResult = majorityScoringSuit(scoringSuit, captured)

  return {
    0:
      scopas[0]
      + belos[0]
      + (majorityCardsResult.winner === 0 ? 1 : 0)
      + (majoritySevensResult.winner === 0 ? 1 : 0)
      + (majoritySuitResult.winner === 0 ? 1 : 0),
    1:
      scopas[1]
      + belos[1]
      + (majorityCardsResult.winner === 1 ? 1 : 0)
      + (majoritySevensResult.winner === 1 ? 1 : 0)
      + (majoritySuitResult.winner === 1 ? 1 : 0),
  }
}

function applyRoundComplete(
  state: MatchControllerState,
  scratch: RoundScratchState,
): void {
  if (scratch.hasCapture) {
    if (scratch.roundCaptor == null) {
      throw new Error('round completion invariant violation: missing captor')
    }

    state.last_captor = scratch.roundCaptor
    state.captured[scratch.roundCaptor] = [...state.captured[scratch.roundCaptor], ...state.table]
    scratch.roundCaptured[scratch.roundCaptor] = [...scratch.roundCaptured[scratch.roundCaptor], ...state.table]
  } else {
    state.captured[state.dealer] = [...state.captured[state.dealer], ...state.table]
    scratch.roundCaptured[state.dealer] = [...scratch.roundCaptured[state.dealer], ...state.table]
    state.last_captor = null
  }

  const roundPoints = computeRoundScoring(scratch.roundScopas, state.scoring_suit, scratch.roundCaptured)
  state.round_points = roundPoints
  state.score[0] += roundPoints[0]
  state.score[1] += roundPoints[1]
  state.match_complete = shouldMatchComplete(state.score, state.target_score)
  state.round_complete = true
  state.next_player = null
  state.table = []
}

function applyInitialTableCapture(state: MatchControllerState, scratch: RoundScratchState): void {
  const [scopas, captureTable] = initialTableScopas(state.table)
  if (captureTable.length === 0) {
    return
  }

  state.captured[state.dealer] = [...state.captured[state.dealer], ...captureTable]
  state.scopas[state.dealer] += scopas
  scratch.roundScopas[state.dealer] += scopas
  scratch.roundCaptured[state.dealer] = [...scratch.roundCaptured[state.dealer], ...captureTable]
  scratch.hasCapture = true
  scratch.roundCaptor = state.dealer
  state.last_captor = state.dealer
  state.table = []
}

function buildInitialState(config: MatchControllerConfigDeck & MatchControllerSeedConfig): {
  state: MatchControllerState
  deck: Card[]
  scratch: RoundScratchState
} {
  const deckType = ensureDeckType(config.deck_type)
  const source = cloneCards(config.deck)
  const shuffle = config.shuffle ?? defaultShuffle
  const deck = cloneCards(shuffle(source))

  if (deck.length < 40) {
    throw new Error('deck must contain at least 40 cards')
  }

  const dealer = config.dealer ?? 0
  const state: MatchControllerState = {
    dealer,
    next_player: nextPlayer(dealer),
    score: { 0: 0, 1: 0 },
    round_complete: false,
    match_complete: false,
    stock_remaining: 0,
    hands: {
      0: drawCards(deck, 3),
      1: drawCards(deck, 3),
    },
    captured: { 0: [], 1: [] },
    table: drawCards(deck, 4),
    last_captor: null,
    scopas: { 0: 0, 1: 0 },
    target_score: config.target_score ?? DEFAULT_MATCH_SCORE,
    scoring_suit: resolveScoringSuit(deckType),
    round_number: 1,
    redeals_remaining: config.redeals_remaining ?? DEFAULT_MATCH_REDEALS,
  }

  const scratch: RoundScratchState = {
    hasCapture: false,
    roundCaptor: null,
    roundScopas: { 0: 0, 1: 0 },
    roundCaptured: {
      0: [],
      1: [],
    },
  }

  state.stock_remaining = deck.length
  applyInitialTableCapture(state, scratch)

  return { state, deck, scratch }
}

class EscopaMatchControllerImpl implements EscopaMatchController {
  private state: MatchControllerState
  private deck: Card[]
  private scratch: RoundScratchState
  private roundNumber: number
  private redealsRemaining: number
  private readonly deckType: EscopaDeckType
  private readonly shuffle: (cards: Card[]) => Card[]
  private readonly seedDeck: Card[]
  private readonly targetScore: number

  constructor(config: EscopaMatchControllerConfig = {}) {
    const deckType = ensureDeckType(config.deck_type)
    const seedDeck = config.deck == null ? createEscopaDeck({ deck_type: deckType }) : cloneCards(config.deck)
    const { state, deck, scratch } = buildInitialState({
      deck_type: deckType,
      deck: seedDeck,
      dealer: config.dealer,
      target_score: config.target_score,
      redeals_remaining: config.redeals_remaining,
      shuffle: config.shuffle ?? defaultShuffle,
    })

    this.state = state
    this.deck = deck
    this.scratch = scratch
    this.roundNumber = 1
    this.deckType = deckType
    this.shuffle = config.shuffle ?? defaultShuffle
    this.seedDeck = seedDeck
    this.targetScore = this.state.target_score
    this.redealsRemaining = state.redeals_remaining
    this.state.round_number = this.roundNumber
    this.state.redeals_remaining = this.redealsRemaining
  }

  private shouldEndRound(): boolean {
    return this.deck.length === 0 && this.state.hands[0].length === 0 && this.state.hands[1].length === 0
  }

  private dealNextHands(): void {
    if (this.deck.length < 6) {
      throwControllerError('no_stock_for_new_hand', 'no stock remaining for next hand')
    }

    this.state.hands = {
      0: drawCards(this.deck, 3),
      1: drawCards(this.deck, 3),
    }
    this.state.stock_remaining = this.deck.length
  }

  snapshot(): MatchControllerState {
    return {
      ...this.state,
      hands: {
        0: [...this.state.hands[0]],
        1: [...this.state.hands[1]],
      },
      captured: {
        0: [...this.state.captured[0]],
        1: [...this.state.captured[1]],
      },
      // score maps are mutated in place by play(); clone them so consumers can
      // diff consecutive snapshots (cue derivation depends on this)
      score: { 0: this.state.score[0], 1: this.state.score[1] },
      scopas: { 0: this.state.scopas[0], 1: this.state.scopas[1] },
      round_points: this.state.round_points == null
        ? undefined
        : { 0: this.state.round_points[0], 1: this.state.round_points[1] },
      table: [...this.state.table],
      round_number: this.roundNumber,
      redeals_remaining: this.redealsRemaining,
      stock_remaining: this.deck.length,
    }
  }

  resolveNextCaptureChoices(
    player: EscopaPlayer,
    selectedCaptureChoiceIds: Record<string, string | null> = {},
  ): ReturnType<typeof deriveEscopaHandChoices> {
    return deriveEscopaHandChoices({
      state: {
        hands: this.state.hands,
        table: this.state.table,
        next_player: this.state.next_player,
      },
      player,
      scoringSuit: this.state.scoring_suit,
      selectedCaptureChoiceIdByCardId: selectedCaptureChoiceIds,
    })
  }

  play(action: EscopaMatchPlayAction): void {
    if (this.state.match_complete) {
      throwControllerError('match_complete', 'play rejected: match already complete')
    }

    if (this.state.next_player == null) {
      throwControllerError('round_complete', 'play rejected: round already complete')
    }

    if (action.player !== this.state.next_player) {
      throwControllerError('out_of_turn', `play rejected: expected player ${this.state.next_player}, got ${action.player}`)
    }

    if (this.state.round_complete) {
      throwControllerError('action_not_allowed_in_round', 'play rejected: round already complete')
    }

    const hand = this.state.hands[action.player]
    const handIndex = hand.findIndex((card) => card.id === action.card_id)
    if (handIndex < 0) {
      throwControllerError('card_not_in_hand', `play rejected: card ${action.card_id} not in hand`)
    }

    const playedCard = hand[handIndex]
    const playedValue = cardValue(playedCard.rank)
    const legalCaptureIndexSets = computeCaptureGroups(this.state.table, playedValue)

    let capturedCardIds = action.captured_card_ids
    if (capturedCardIds == null && action.capture_group_id != null) {
      const groups = normalizeCaptureGroupLabels(this.state.table, playedValue, legalCaptureIndexSets)
      const selected = groups.find((group) => group.id === action.capture_group_id)
      if (selected == null) {
        throwControllerError('card_not_on_table', 'play rejected: capture group was not valid for this card')
      }
      capturedCardIds = selected.cardIds
    }

    if (capturedCardIds == null || capturedCardIds.length === 0) {
      if (legalCaptureIndexSets.length > 0) {
        throwControllerError('missing_capture', 'play rejected: capture exists but no captured_card_ids provided')
      }

      this.state.hands[action.player] = this.state.hands[action.player].filter((card) => card.id !== action.card_id)
      this.state.table = [...this.state.table, playedCard]
    } else {
      const seen = new Set<string>()
      const capturedCards = cardById(this.state.table, capturedCardIds)

      for (const capturedId of capturedCardIds) {
        if (seen.has(capturedId)) {
          throwControllerError('captured_card_id_duplicate', `play rejected: duplicate captured card id ${capturedId}`)
        }
        seen.add(capturedId)
      }

      const capturedSum = capturedCards.reduce((sum, card) => sum + cardValue(card.rank), 0)
      if (playedValue + capturedSum !== 15) {
        throwControllerError('captured_set_not_15', 'play rejected: capture does not sum to 15')
      }

      const capturedIds = new Set(capturedCards.map((card) => card.id))
      this.state.hands[action.player] = this.state.hands[action.player].filter((card) => card.id !== action.card_id)
      this.state.table = this.state.table.filter((card) => !capturedIds.has(card.id))
      this.state.captured[action.player] = [...this.state.captured[action.player], playedCard, ...capturedCards]
      this.scratch.roundCaptured[action.player] = [...this.scratch.roundCaptured[action.player], playedCard, ...capturedCards]
      if (this.state.table.length === 0) {
        this.state.scopas[action.player] += 1
        this.scratch.roundScopas[action.player] += 1
      }

      this.scratch.hasCapture = true
      this.scratch.roundCaptor = action.player
      this.state.last_captor = action.player
    }

    if (this.shouldEndRound()) {
      applyRoundComplete(this.state, this.scratch)
      this.state.stock_remaining = this.deck.length
      return
    }

    if (this.state.hands[0].length === 0 && this.state.hands[1].length === 0) {
      this.dealNextHands()
      this.state.next_player = nextPlayer(action.player)
      this.state.stock_remaining = this.deck.length
      return
    }

    this.state.next_player = nextPlayer(action.player)
    this.state.stock_remaining = this.deck.length
  }

  start_next_hand(): void {
    if (!this.state.round_complete) {
      throwControllerError('action_not_allowed_in_round', 'start_next_hand rejected: round not complete')
    }

    if (this.state.match_complete) {
      throwControllerError('action_not_allowed_in_round', 'start_next_hand rejected: match complete')
    }

    const nextDealer = nextPlayer(this.state.dealer)
    const { state, deck, scratch } = buildInitialState({
      deck_type: this.deckType,
      deck: this.seedDeck,
      dealer: nextDealer,
      target_score: this.targetScore,
      redeals_remaining: this.redealsRemaining,
      shuffle: this.shuffle,
    })

    const preservedScore = this.state.score
    this.state = {
      ...state,
      score: {
        0: preservedScore[0],
        1: preservedScore[1],
      },
      round_number: this.roundNumber + 1,
      redeals_remaining: this.redealsRemaining,
    }
    this.deck = deck
    this.scratch = scratch
    this.roundNumber += 1
    this.state.next_player = nextPlayer(this.state.dealer)
  }

  redeal_match(): void {
    if (this.state.round_complete || this.state.next_player == null) {
      if (this.redealsRemaining <= 0) {
        throwControllerError('match_redeals_exhausted', 'no redeals remaining')
      }
    } else {
      throwControllerError('action_not_allowed_in_round', 'redeal_match rejected: active round in progress')
    }

    const { state, deck, scratch } = buildInitialState({
      deck_type: this.deckType,
      deck: this.seedDeck,
      dealer: this.state.dealer,
      target_score: this.targetScore,
      redeals_remaining: this.redealsRemaining - 1,
      shuffle: this.shuffle,
    })

    this.state = {
      ...state,
      redeals_remaining: this.redealsRemaining - 1,
      round_number: 1,
    }
    this.deck = deck
    this.scratch = scratch
    this.redealsRemaining = this.redealsRemaining - 1
    this.roundNumber = 1
  }
}

export function createEscopaMatchController(config: EscopaMatchControllerConfig = {}): EscopaMatchController {
  return new EscopaMatchControllerImpl(config)
}

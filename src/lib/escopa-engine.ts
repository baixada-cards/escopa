type DeckType = 'spanish' | 'french'
type SpanishSuit = 'OROS' | 'COPAS' | 'ESPADAS' | 'BASTOS'
type FrenchSuit = 'DIAMONDS' | 'HEARTS' | 'SPADES' | 'CLUBS'
export type EscopaSuit = SpanishSuit | FrenchSuit
export type EscopaScoringSuit = 'OROS' | 'DIAMONDS'
export type Rank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | 'Q' | 'J' | 'K'
type Player = 0 | 1
type CardValue = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10

const BELLO_RANKS = ['A', '7', 'Q', 'K'] as const

const RANK_VALUES: Record<Rank, CardValue> = {
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

type RejectionCategory =
  | 'out_of_turn_play'
  | 'card_not_in_hand'
  | 'captured_card_not_on_table'
  | 'captured_card_id_duplicate'
  | 'captured_set_not_15'
  | 'missing_capture_when_available'
  | 'play_after_round_completion'
  | 'invalid_mixed_deck_state'
  | 'invalid_scoring_state'

interface FixtureRejectionExpectation {
  category: RejectionCategory
  message_contains?: string
}

const DECK: Record<DeckType, EscopaSuit[]> = {
  spanish: ['OROS', 'COPAS', 'ESPADAS', 'BASTOS'],
  french: ['DIAMONDS', 'HEARTS', 'SPADES', 'CLUBS'],
} as const

const RANKS: readonly Rank[] = ['A', '2', '3', '4', '5', '6', '7', 'Q', 'J', 'K']

export interface Card {
  id: string
  rank: Rank
  suit: EscopaSuit
}

export interface Score {
  0: number
  1: number
}

export interface HandMap {
  0: Card[]
  1: Card[]
}

export interface EscopaState {
  dealer: Player
  next_player: Player | null
  score: Score
  stock_remaining: number
  hands: HandMap
  captured: HandMap
  table: Card[]
  scopas: Score
  target_score: number
  scoring_suit: EscopaScoringSuit
  last_captor?: Player | null
  round_complete?: boolean
  match_complete?: boolean
  round_points?: Score
}

export interface PlayCardAction {
  type: 'play_card'
  player: Player
  card_id: string
  captured_card_ids?: string[]
}

export interface ResolveInitialTableAction {
  type: 'resolve_initial_table'
}

export interface AssertDeckAction {
  type: 'assert_deck'
}

export type EscopaAction = PlayCardAction | ResolveInitialTableAction | AssertDeckAction

export interface EscopaFixture {
  fixture_version: 'escopa-fixture/v1'
  id: string
  ruleset: 'escopa-2p-v1'
  description: string
  deck_type: DeckType
  initial_state: EscopaState
  action: EscopaAction
  expected: {
    state?: Partial<EscopaState>
    assertions?: Record<string, unknown>
    rejection?: FixtureRejectionExpectation
  }
}

export interface FixtureRunReport {
  fixture_id: string
  status: 'pass' | 'fail'
  message: string
}

interface EscopaEngineState extends EscopaState {
  _roundHasCapture: boolean
  _roundCaptor: Player | null
  _roundScopas: Score
  _roundCaptured: HandMap
}

export function executeFixture(fixture: EscopaFixture): FixtureRunReport {
  try {
    const message = executeFixtureInner(fixture)
    if (fixture.expected.rejection != null) {
      return {
        fixture_id: fixture.id,
        status: 'fail',
        message: `expected rejection ${fixture.expected.rejection.category}, but action succeeded`,
      }
    }
    return {
      fixture_id: fixture.id,
      status: 'pass',
      message,
    }
  } catch (error) {
    if (fixture.expected.rejection != null) {
      return assertExpectedRejection(fixture.id, error, fixture.expected.rejection)
    }
    return {
      fixture_id: fixture.id,
      status: 'fail',
      message: error instanceof Error ? error.message : String(error),
    }
  }
}

function executeFixtureInner(fixture: EscopaFixture): string {
  validateFixtureState(fixture.initial_state, fixture.deck_type)

  const state: EscopaEngineState = {
    ...cloneState(fixture.initial_state),
    _roundHasCapture: false,
    _roundCaptor: fixture.initial_state.last_captor ?? null,
    _roundScopas: {
      0: 0,
      1: 0,
    },
    _roundCaptured: {
      0: [],
      1: [],
    },
  }

  switch (fixture.action.type) {
    case 'play_card':
      applyPlayCardAction(state, fixture.action)
      break
    case 'resolve_initial_table':
      applyInitialTableResolution(state)
      break
    case 'assert_deck':
      break
  }

  if (fixture.expected.state != null) {
    assertExpectedSubset(state, fixture.expected.state, 'state')
  }

  if (fixture.expected.assertions != null) {
    assertFixtureAssertions(state, fixture.expected.assertions, fixture.deck_type)
  }

  return `${fixture.action.type} executed`
}

function applyPlayCardAction(state: EscopaEngineState, action: PlayCardAction): void {
  if (state.next_player == null) {
    throwFixtureRejection('play_after_round_completion', 'play_card rejected: round already complete')
  }
  if (action.player !== state.next_player) {
    throwFixtureRejection(
      'out_of_turn_play',
      `play_card rejected: expected player ${state.next_player}, got ${action.player}`,
    )
  }

  const hand = state.hands[action.player]
  const playedIndex = hand.findIndex((card) => card.id === action.card_id)
  if (playedIndex < 0) {
    throwFixtureRejection(
      'card_not_in_hand',
      `play_card rejected: card ${action.card_id} is not in player's hand`,
    )
  }

  const playedCard = hand[playedIndex]
  const playedValue = RANK_VALUES[playedCard.rank]
  const need = 15 - playedValue
  const legalCaptures = findCaptureIndexSets(state.table, need)

  if (action.captured_card_ids != null && action.captured_card_ids.length > 0) {
    const tableById = new Map(state.table.map((card) => [card.id, card]))
    const seen = new Set<string>()
    const capturedCards: Card[] = []
    for (const capturedCardId of action.captured_card_ids) {
      if (seen.has(capturedCardId)) {
        throwFixtureRejection(
          'captured_card_id_duplicate',
          `play_card rejected: duplicate captured card id ${capturedCardId}`,
        )
      }
      seen.add(capturedCardId)

      const capturedCard = tableById.get(capturedCardId)
      if (capturedCard == null) {
        throwFixtureRejection(
          'captured_card_not_on_table',
          `play_card rejected: table card ${capturedCardId} not found`,
        )
      }
      capturedCards.push(capturedCard)
    }

    const capturedSum = capturedCards.reduce((total, card) => total + RANK_VALUES[card.rank], 0)
    if (playedValue + capturedSum !== 15) {
      throwFixtureRejection(
        'captured_set_not_15',
        `play_card rejected: captured card set ${JSON.stringify(action.captured_card_ids)} does not sum to 15`,
      )
    }

    state.table = state.table.filter((card) => !seen.has(card.id))
    state.captured[action.player] = [...state.captured[action.player], playedCard, ...capturedCards]
    state._roundCaptured[action.player] = [...state._roundCaptured[action.player], playedCard, ...capturedCards]
    if (state.table.length === 0) {
      state.scopas[action.player] += 1
      state._roundScopas[action.player] += 1
    }
    state._roundHasCapture = true
    state._roundCaptor = action.player
    state.last_captor = action.player
  } else {
    if (legalCaptures.length > 0) {
      throwFixtureRejection('missing_capture_when_available', 'play_card rejected: capture exists but no captured_card_ids provided')
    }
    state.table = [...state.table, playedCard]
  }

  state.hands[action.player] = state.hands[action.player].filter((_, index) => index !== playedIndex)
  if (shouldEndRound(state)) {
    completeRound(state)
    return
  }

  state.next_player = action.player === 0 ? 1 : 0
}

function assertExpectedRejection(
  fixtureId: string,
  error: unknown,
  expected: FixtureRejectionExpectation,
): FixtureRunReport {
  const details = extractFixtureError(error)
  if (details.category !== expected.category) {
    return {
      fixture_id: fixtureId,
      status: 'fail',
      message: `expected rejection ${expected.category}, got ${details.category}: ${details.message}`,
    }
  }
  if (expected.message_contains != null && !details.message.includes(expected.message_contains)) {
    return {
      fixture_id: fixtureId,
      status: 'fail',
      message: `expected rejection message to contain ${expected.message_contains}, got ${details.message}`,
    }
  }
  return {
    fixture_id: fixtureId,
    status: 'pass',
    message: details.message,
  }
}

function extractFixtureError(error: unknown): { category: string; message: string } {
  if (error instanceof Error && 'rejectionCategory' in error) {
    return {
      category: (error as { rejectionCategory: string }).rejectionCategory,
      message: error.message,
    }
  }
  if (error instanceof Error) {
    return {
      category: 'unknown',
      message: error.message,
    }
  }
  return {
    category: 'unknown',
    message: String(error),
  }
}

function throwFixtureRejection(category: RejectionCategory, message: string): never {
  const error = new Error(message) as Error & { rejectionCategory: RejectionCategory }
  error.rejectionCategory = category
  throw error
}

function validateFixtureState(state: EscopaState, deckType: DeckType): void {
  validateDeckCards(state, deckType)
  validateScoringSuit(state.scoring_suit, deckType)
}

function validateDeckCards(state: EscopaState, deckType: DeckType): void {
  const allowedSuits = new Set(DECK[deckType])
  const seenIds = new Set<string>()
  const allCards = [
    ...state.hands[0],
    ...state.hands[1],
    ...state.captured[0],
    ...state.captured[1],
    ...state.table,
  ]
  for (const card of allCards) {
    if (!RANKS.includes(card.rank)) {
      throwFixtureRejection('invalid_mixed_deck_state', `invalid card rank in state: ${card.rank}`)
    }
    if (!allowedSuits.has(card.suit)) {
      throwFixtureRejection(
        'invalid_mixed_deck_state',
        `invalid card suit for deck type ${deckType}: ${card.suit} (${card.id})`,
      )
    }
    if (seenIds.has(card.id)) {
      throwFixtureRejection('invalid_mixed_deck_state', `duplicate card id in initial state: ${card.id}`)
    }
    seenIds.add(card.id)
  }
}

function validateScoringSuit(scoringSuit: EscopaScoringSuit, deckType: DeckType): void {
  const expectedScoringSuit = deckType === 'spanish' ? 'OROS' : 'DIAMONDS'
  if (scoringSuit !== expectedScoringSuit) {
    throwFixtureRejection(
      'invalid_scoring_state',
      `invalid scoring_suit for deck type ${deckType}: expected ${expectedScoringSuit}, got ${scoringSuit}`,
    )
  }
}

function applyInitialTableResolution(state: EscopaEngineState): void {
  const [scopas, captureTable] = initialTableScopas(state.table)
  if (captureTable.length === 0) {
    return
  }
  state.captured[state.dealer] = [...state.captured[state.dealer], ...captureTable]
  state.scopas[state.dealer] += scopas
  state._roundScopas[state.dealer] += scopas
  state.last_captor = state.dealer
  state.table = []
  state._roundHasCapture = true
  state._roundCaptor = state.dealer
  state.next_player = state.dealer === 0 ? 1 : 0
}

function initialTableScopas(table: Card[]): [number, Card[]] {
  if (table.length !== 4) {
    return [0, []]
  }

  const totalValue = table.reduce((total, card) => total + RANK_VALUES[card.rank], 0)
  if (totalValue === 15) {
    return [1, [...table]]
  }

  for (let i = 0; i < table.length; i++) {
    for (let mask = 1; mask < 1 << table.length; mask++) {
      if ((mask & (1 << i)) === 0) {
        continue
      }
      const subsetSum = sumByMask(table, mask)
      const complementSum = totalValue - subsetSum
      if (subsetSum === 15 && complementSum === 15) {
        return [2, [...table]]
      }
    }
  }

  return [0, []]
}

function completeRound(state: EscopaEngineState): void {
  if (state._roundHasCapture) {
    const captor = state._roundCaptor ?? null
    if (captor == null) {
      throw new Error('round completion internal error: missing captor')
    }
    state.last_captor = captor
    state.captured[captor] = [...state.captured[captor], ...state.table]
    state._roundCaptured[captor] = [...state._roundCaptured[captor], ...state.table]
  } else {
    state.captured[state.dealer] = [...state.captured[state.dealer], ...state.table]
    state._roundCaptured[state.dealer] = [...state._roundCaptured[state.dealer], ...state.table]
    state.last_captor = null
  }
  state.table = []

  const roundPoints = evaluateRoundPoints(
    state._roundScopas,
    state.scoring_suit,
    state._roundCaptured,
  )
  state.round_points = roundPoints
  state.round_complete = true
  state.score[0] += roundPoints[0]
  state.score[1] += roundPoints[1]
  state.match_complete = shouldMatchComplete(state)
  state.next_player = null
}

function shouldMatchComplete(state: EscopaEngineState): boolean {
  const p0 = state.score[0]
  const p1 = state.score[1]
  const target = state.target_score

  if (p0 >= target || p1 >= target) {
    if (p0 === p1) {
      return false
    }
    return true
  }

  return false
}

function shouldEndRound(state: EscopaEngineState): boolean {
  return state.stock_remaining === 0 && state.hands[0].length === 0 && state.hands[1].length === 0
}

function evaluateRoundPoints(
  scopas: Score,
  scoringSuit: EscopaScoringSuit,
  allCaptured: HandMap,
): Score {
  const belos = beloScores(scoringSuit, allCaptured)
  const majorityCards = majorityCardWinner(allCaptured)
  const majoritySevens = majoritySevensWinner(allCaptured)
  const majorityScoringSuitCards = majorityScoringSuitCardWinner(scoringSuit, allCaptured)

  return {
    0:
      scopas[0]
      + belos[0]
      + (majorityCards.winner === 0 ? 1 : 0)
      + (majoritySevens.winner === 0 ? 1 : 0)
      + (majorityScoringSuitCards.winner === 0 ? 1 : 0),
    1:
      scopas[1]
      + belos[1]
      + (majorityCards.winner === 1 ? 1 : 0)
      + (majoritySevens.winner === 1 ? 1 : 0)
      + (majorityScoringSuitCards.winner === 1 ? 1 : 0),
  }
}

function majorityScoringSuitCardWinner(scoringSuit: EscopaScoringSuit, captured: HandMap): { winner: Player | null; counts: Score } {
  const counts = {
    0: captured[0].filter((card) => card.suit === scoringSuit).length,
    1: captured[1].filter((card) => card.suit === scoringSuit).length,
  }
  if (counts[0] === counts[1]) {
    return { winner: null, counts }
  }
  return { winner: counts[0] > counts[1] ? 0 : 1, counts }
}

function beloScores(suit: EscopaScoringSuit, captured: HandMap): Score {
  const beloCards = new Set<Rank>(BELLO_RANKS)
  return {
    0: captured[0].filter((card) => card.suit === suit && beloCards.has(card.rank)).length,
    1: captured[1].filter((card) => card.suit === suit && beloCards.has(card.rank)).length,
  }
}

function majorityCardWinner(captured: HandMap): { winner: Player | null; counts: Score } {
  const counts = {
    0: captured[0].length,
    1: captured[1].length,
  }
  if (counts[0] === counts[1]) {
    return { winner: null, counts }
  }
  return { winner: counts[0] > counts[1] ? 0 : 1, counts }
}

function majoritySevensWinner(captured: HandMap): { winner: Player | null; counts: Score } {
  const counts = {
    0: captured[0].filter((card) => card.rank === '7').length,
    1: captured[1].filter((card) => card.rank === '7').length,
  }
  if (counts[0] === counts[1]) {
    return { winner: null, counts }
  }
  return { winner: counts[0] > counts[1] ? 0 : 1, counts }
}

function findCaptureIndexSets(table: Card[], need: number): number[][] {
  if (need <= 0) {
    return []
  }

  const results: number[][] = []
  const recurse = (index: number, sum: number, selected: number[]): void => {
    if (sum > need) {
      return
    }
    if (sum === need && selected.length > 0) {
      results.push(selected.slice())
      return
    }
    if (index >= table.length) {
      return
    }

    recurse(index + 1, sum, selected)
    recurse(index + 1, sum + RANK_VALUES[table[index].rank], [...selected, index])
  }

  recurse(0, 0, [])
  return results
}

function assertFixtureAssertions(
  state: EscopaState,
  assertions: Record<string, unknown>,
  deckType: DeckType,
): void {
  const deck = createDeck(deckType)
  if (assertions.deck_suits != null) {
    const expected = assertions.deck_suits
    if (!Array.isArray(expected)) {
      throw new Error('assert_deck: deck_suits must be an array')
    }
    const deckSuits = [...new Set(deck.map((card) => card.suit))]
    assertStringSetEquals('deck_suits', expected as string[], deckSuits)
  }

  if (assertions.deck_ranks != null) {
    const expected = assertions.deck_ranks
    if (!Array.isArray(expected)) {
      throw new Error('assert_deck: deck_ranks must be an array')
    }
    assertStringSetEquals('deck_ranks', expected as string[], RANKS)
  }

  if (assertions.deck_card_count != null) {
    if (typeof assertions.deck_card_count !== 'number') {
      throw new Error('assert_deck: deck_card_count must be a number')
    }
    if (deck.length !== assertions.deck_card_count) {
      throw new Error(`assert_deck: expected deck_card_count=${assertions.deck_card_count}, got ${deck.length}`)
    }
  }

  if (assertions.scoring_suit != null) {
    if (assertions.scoring_suit !== state.scoring_suit) {
      throw new Error(`assert_deck: expected scoring_suit=${assertions.scoring_suit}, got ${state.scoring_suit}`)
    }
  }

  if (assertions.card_values != null) {
    const expected = assertions.card_values
    if (typeof expected !== 'object' || expected == null) {
      throw new Error('assert_deck: card_values must be an object')
    }
    const actual = RANK_VALUES
    const expectedValues = expected as Record<string, unknown>
    for (const rank of Object.keys(RANK_VALUES)) {
      if (expectedValues[rank] !== actual[rank as Rank]) {
        throw new Error(`assert_deck: expected card_values[${rank}]=${expectedValues[rank]}, got ${actual[rank as Rank]}`)
      }
    }
  }

  if (assertions.match_end != null) {
    const expected = assertions.match_end
    if (typeof expected !== 'boolean') {
      throw new Error('assert_deck: match_end must be a boolean')
    }
    if ((state.match_complete ?? false) !== expected) {
      throw new Error(`assertions: expected match_end=${expected}, got ${String(state.match_complete ?? false)}`)
    }
  }

  if (assertions.round_end != null) {
    const expected = assertions.round_end
    if (typeof expected !== 'boolean') {
      throw new Error('assert_deck: round_end must be a boolean')
    }
    if ((state.round_complete ?? false) !== expected) {
      throw new Error(`assertions: expected round_end=${expected}, got ${String(state.round_complete ?? false)}`)
    }
  }

  if (assertions.round_points != null) {
    const expected = assertions.round_points
    if (!isNumberMap(expected)) {
      throw new Error('assertions: round_points must be a score map')
    }
    const belos = beloScores(state.scoring_suit, state.captured)
    const majorityCards = majorityCardWinner(state.captured)
    const majoritySevens = majoritySevensWinner(state.captured)
    const majoritySuitCards = majorityScoringSuitCardWinner(state.scoring_suit, state.captured)
    const actual: Score = (() => {
      if (assertions.category === 'belos') {
        return belos
      }
      if (assertions.category === 'majority_cards') {
        return {
          0: majorityCards.winner === 0 ? 1 : 0,
          1: majorityCards.winner === 1 ? 1 : 0,
        }
      }
      if (assertions.category === 'majority_sevens') {
        return {
          0: majoritySevens.winner === 0 ? 1 : 0,
          1: majoritySevens.winner === 1 ? 1 : 0,
        }
      }
      if (assertions.category === 'majority_scoring_suit') {
        return {
          0: majoritySuitCards.winner === 0 ? 1 : 0,
          1: majoritySuitCards.winner === 1 ? 1 : 0,
        }
      }
      return state.round_points ?? { 0: 0, 1: 0 }
    })()
    if (expected[0] !== actual[0]) {
      throw new Error(`assertions: expected round_points[0]=${expected[0]}, got ${actual[0]}`)
    }
    if (expected[1] !== actual[1]) {
      throw new Error(`assertions: expected round_points[1]=${expected[1]}, got ${actual[1]}`)
    }
  }

  if (assertions.category === 'belos') {
    const expected = assertions.belos
    if (!isScore(expected)) {
      throw new Error('assertions: belos must be a score map')
    }
    const belos = beloScores(state.scoring_suit, state.captured)
    if (expected[0] !== belos[0] || expected[1] !== belos[1]) {
      throw new Error(`assertions: expected belos=${JSON.stringify(expected)}, got ${JSON.stringify(belos)}`)
    }
  }

  if (assertions.category === 'majority_cards') {
    const expected = assertions.majority_cards
    if (typeof expected !== 'object' || expected == null) {
      throw new Error('assertions: majority_cards must be an object')
    }
    const expectedWinner = (expected as { winner: unknown }).winner
    const majorityCards = majorityCardWinner(state.captured)
    if (expectedWinner !== majorityCards.winner && !(expectedWinner == null && majorityCards.winner == null)) {
      throw new Error(`assertions: expected majority_cards.winner=${expectedWinner}, got ${majorityCards.winner}`)
    }

    const expectedCounts = (expected as { player_card_count: unknown }).player_card_count
    if (!isScore(expectedCounts)) {
      throw new Error('assertions: majority_cards.player_card_count must be a score map')
    }
    if (
      expectedCounts[0] !== majorityCards.counts[0]
      || expectedCounts[1] !== majorityCards.counts[1]
    ) {
      throw new Error(
        `assertions: expected majority_cards.player_card_count=${JSON.stringify(expectedCounts)}, got ${JSON.stringify(
          majorityCards.counts,
        )}`,
      )
    }
  }

  if (assertions.category === 'majority_sevens') {
    const expected = assertions.majority_sevens
    if (typeof expected !== 'object' || expected == null) {
      throw new Error('assertions: majority_sevens must be an object')
    }
    const expectedWinner = (expected as { winner: unknown }).winner
    const majoritySevens = majoritySevensWinner(state.captured)
    if (expectedWinner !== majoritySevens.winner && !(expectedWinner == null && majoritySevens.winner == null)) {
      throw new Error(`assertions: expected majority_sevens.winner=${expectedWinner}, got ${majoritySevens.winner}`)
    }
    const expectedCounts = (expected as { counts: unknown }).counts
    if (!isScore(expectedCounts)) {
      throw new Error('assertions: majority_sevens.counts must be a score map')
    }
    if (
      expectedCounts[0] !== majoritySevens.counts[0]
      || expectedCounts[1] !== majoritySevens.counts[1]
    ) {
      throw new Error(
        `assertions: expected majority_sevens.counts=${JSON.stringify(expectedCounts)}, got ${JSON.stringify(
          majoritySevens.counts,
        )}`,
      )
    }
  }

  if (assertions.category === 'tied') {
    const majorityCards = majorityCardWinner(state.captured)
    const majoritySevens = majoritySevensWinner(state.captured)
    if (typeof assertions.cards_tied !== 'boolean') {
      throw new Error('assertions: cards_tied must be a boolean')
    }
    if ((assertions.cards_tied as boolean) !== (majorityCards.winner == null)) {
      throw new Error(`assertions: expected cards_tied=${assertions.cards_tied}, got ${majorityCards.winner == null}`)
    }
    if (typeof assertions.sevens_tied !== 'boolean') {
      throw new Error('assertions: sevens_tied must be a boolean')
    }
    if ((assertions.sevens_tied as boolean) !== (majoritySevens.winner == null)) {
      throw new Error(`assertions: expected sevens_tied=${assertions.sevens_tied}, got ${majoritySevens.winner == null}`)
    }
  }

  if (assertions.category === 'majority_scoring_suit') {
    const expected = assertions.majority_scoring_suit
    if (typeof expected !== 'object' || expected == null) {
      throw new Error('assertions: majority_scoring_suit must be an object')
    }
    const expectedWinner = (expected as { winner: unknown }).winner
    const majorityScoringSuitCards = majorityScoringSuitCardWinner(state.scoring_suit, state.captured)
    if (
      expectedWinner !== majorityScoringSuitCards.winner
      && !(expectedWinner == null && majorityScoringSuitCards.winner == null)
    ) {
      throw new Error(
        `assertions: expected majority_scoring_suit.winner=${expectedWinner}, got ${majorityScoringSuitCards.winner}`,
      )
    }

    const expectedCounts = (expected as { player_suit_count: unknown }).player_suit_count
    if (!isScore(expectedCounts)) {
      throw new Error('assertions: majority_scoring_suit.player_suit_count must be a score map')
    }
    if (
      expectedCounts[0] !== majorityScoringSuitCards.counts[0]
      || expectedCounts[1] !== majorityScoringSuitCards.counts[1]
    ) {
      throw new Error(
        `assertions: expected majority_scoring_suit.player_suit_count=${JSON.stringify(expectedCounts)}, got ${JSON.stringify(
          majorityScoringSuitCards.counts,
        )}`,
      )
    }
  }

  if (assertions.majority_points != null) {
    const expected = assertions.majority_points
    if (typeof expected !== 'object' || expected == null) {
      throw new Error('assertions: majority_points must be an object')
    }
    const majorityCards = majorityCardWinner(state.captured)
    const majoritySevens = majoritySevensWinner(state.captured)
    const actual: Record<'cards' | 'sevens', number> = {
      cards:
        majorityCards.winner === 0 || majorityCards.winner === 1
          ? 1
          : 0,
      sevens:
        majoritySevens.winner === 0 || majoritySevens.winner === 1
          ? 1
          : 0,
    }
    if (
      !isFiniteNumber((expected as Record<'cards' | 'sevens', unknown>).cards)
      || !isFiniteNumber((expected as Record<'cards' | 'sevens', unknown>).sevens)
    ) {
      throw new Error('assertions: majority_points must have numeric cards and sevens')
    }

    const expectedMajority = expected as Record<'cards' | 'sevens', number>
    if (expectedMajority.cards !== actual.cards || expectedMajority.sevens !== actual.sevens) {
      throw new Error(
        `assertions: expected majority_points=${JSON.stringify(expectedMajority)}, got ${JSON.stringify(actual)}`,
      )
    }
  }

  if (assertions.winner != null) {
    const expected = assertions.winner
    if (expected !== null && expected !== 0 && expected !== 1) {
      throw new Error(`assertions: winner must be 0, 1, or null, got ${String(expected)}`)
    }
    const winner = resolveMatchWinner(state)
    if (winner !== expected) {
      throw new Error(`assertions: expected winner=${String(expected)}, got ${String(winner)}`)
    }
  }
}

function resolveMatchWinner(state: EscopaState): Player | null {
  if (state.match_complete !== true) {
    return null
  }
  if (state.score[0] > state.score[1]) {
    return 0
  }
  if (state.score[1] > state.score[0]) {
    return 1
  }
  return null
}

function assertExpectedSubset(actual: unknown, expected: unknown, path = ''): void {
  if (expected == null) {
    return
  }
  if (Array.isArray(expected)) {
    if (!Array.isArray(actual)) {
      throw new Error(`assert state mismatch at ${path}: expected array`)
    }
    if (actual.length !== expected.length) {
      throw new Error(`assert state mismatch at ${path}: expected length ${expected.length}, got ${actual.length}`)
    }
    for (const [index, item] of expected.entries()) {
      assertExpectedSubset(actual[index], item, `${path}[${index}]`)
    }
    return
  }
  if (typeof expected !== 'object') {
    if (actual !== expected) {
      throw new Error(`assert state mismatch at ${path}: expected ${String(expected)}, got ${String(actual)}`)
    }
    return
  }
  if (actual == null || typeof actual !== 'object') {
    throw new Error(`assert state mismatch at ${path}: expected object`)
  }

  for (const [key, value] of Object.entries(expected)) {
    if (key.startsWith('_')) {
      continue
    }
    assertExpectedSubset((actual as Record<string, unknown>)[key], value, `${path ? `${path}.` : ''}${key}`)
  }
}

function assertStringSetEquals(path: string, expected: string[], actual: readonly string[]): void {
  const expectedSorted = [...expected].sort()
  const actualSorted = [...actual].sort()
  if (expectedSorted.length !== actualSorted.length) {
    throw new Error(`assert ${path}: expected length ${expectedSorted.length}, got ${actualSorted.length}`)
  }
  for (let i = 0; i < expectedSorted.length; i++) {
    if (expectedSorted[i] !== actualSorted[i]) {
      throw new Error(`assert ${path}: expected ${expectedSorted[i]}, got ${actualSorted[i]} at index ${i}`)
    }
  }
}

function isScore(value: unknown): value is Score {
  return isNumberMap(value)
}

function isNumberMap(value: unknown): value is Score {
  if (value == null || typeof value !== 'object') {
    return false
  }
  const candidate = value as Record<string, unknown>
  return Number.isInteger(candidate[0]) && Number.isInteger(candidate[1])
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function cloneState(state: EscopaState): EscopaState {
  return {
    ...state,
    score: {
      0: state.score[0],
      1: state.score[1],
    },
    hands: {
      0: [...state.hands[0]],
      1: [...state.hands[1]],
    },
    captured: {
      0: [...state.captured[0]],
      1: [...state.captured[1]],
    },
    table: [...state.table],
    scopas: {
      0: state.scopas[0],
      1: state.scopas[1],
    },
  }
}

function createDeck(type: DeckType): Card[] {
  const suits = DECK[type]
  const deck: Card[] = []
  for (const suit of suits) {
    for (const rank of RANKS) {
      deck.push({ id: `${suit.toLowerCase()}-${rank}`, rank, suit })
    }
  }
  return deck
}

function sumByMask(table: Card[], mask: number): number {
  let total = 0
  for (let i = 0; i < table.length; i++) {
    if ((mask & (1 << i)) !== 0) {
      total += RANK_VALUES[table[i].rank]
    }
  }
  return total
}

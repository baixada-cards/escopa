import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  createEscopaDeck,
  createEscopaMatchController,
  resolveDeterministicEscopaAction,
  type EscopaMatchController,
} from './escopa-match-controller.ts'
import type { Card } from './escopa-engine.ts'

const SPANISH_RANKS: Card['rank'][] = ['A', '2', '3', '4', '5', '6', '7', 'Q', 'J', 'K']
const SPANISH_SUITS = ['OROS', 'COPAS', 'ESPADAS', 'BASTOS'] as const

function buildDeckWithOpeningScopa(): Card[] {
  const base = createEscopaDeck({ deck_type: 'spanish' })
  const ordered: Card[] = []

  const wanted: Array<{ id: string; rank: Card['rank']; suit: Card['suit'] }> = [
    { id: 'open-a', rank: 'A', suit: 'OROS' },
    { id: 'open-4', rank: '4', suit: 'COPAS' },
    { id: 'open-5', rank: '5', suit: 'ESPADAS' },
    { id: 'open-5b', rank: '5', suit: 'BASTOS' },
  ]

  for (const card of wanted) {
    const index = base.findIndex((entry) => entry.rank === card.rank && entry.suit === card.suit)
    const picked = base.splice(index, 1)[0]
    if (picked == null) {
      throw new Error(`Missing desired card ${card.rank} of ${card.suit}`)
    }
    ordered.push({ ...picked, id: card.id })
  }

  const handCards = base.splice(0, 6)
  return [...handCards, ...ordered, ...base]
}

function buildFlatDeck(): Card[] {
  const cards: Card[] = []
  let id = 0
  for (const suit of SPANISH_SUITS) {
    for (const rank of SPANISH_RANKS) {
      cards.push({ id: `flat-${id}`, rank, suit })
      id += 1
    }
  }
  return cards
}

function buildDeckWithControlledTop(topCards: Array<{ id: string; rank: Card['rank']; suit: Card['suit'] }>): Card[] {
  const remaining = buildFlatDeck()
  const ordered: Card[] = []

  for (const requested of topCards) {
    const index = remaining.findIndex(
      (card) => card.rank === requested.rank && card.suit === requested.suit,
    )
    if (index < 0) {
      throw new Error(`Missing requested card ${requested.rank} of ${requested.suit}`)
    }
    const picked = remaining.splice(index, 1)[0]
    if (picked == null) {
      throw new Error(`Could not pick requested card ${requested.id}`)
    }
    ordered.push({ ...picked, id: requested.id })
  }

  return [...ordered, ...remaining]
}

function playToRoundComplete(controller: EscopaMatchController): void {
  let safety = 0
  while (safety < 120) {
    safety += 1
    const snap = controller.snapshot()
    if (snap.next_player == null) {
      break
    }

    const choices = controller.resolveNextCaptureChoices(snap.next_player)
    const handEntry = Object.entries(choices.byCard).find(([, value]) => value.playable)
    assert.ok(handEntry != null)

    const [cardId, byCard] = handEntry
    const action: {
      player: 0 | 1
      card_id: string
      captured_card_ids?: string[]
    } = byCard.captureGroups.length > 0
      ? { player: snap.next_player, card_id: cardId, captured_card_ids: byCard.captureGroups[0]?.cardIds }
      : { player: snap.next_player, card_id: cardId }

    controller.play(action)

    const next = controller.snapshot()
    if (next.round_complete) {
      break
    }
  }

  assert.equal(controller.snapshot().round_complete, true)
}

test('controller resolves opening-table scopa on deal and awards captured table immediately', () => {
  const controller = createEscopaMatchController({
    deck_type: 'spanish',
    dealer: 0,
    shuffle: (cards: Card[]) => cards,
    deck: buildDeckWithOpeningScopa(),
  })

  const snapshot = controller.snapshot()
  assert.equal(snapshot.dealer, 0)
  assert.equal(snapshot.next_player, 1)
  assert.equal(snapshot.scopas[0], 1)
  assert.equal(snapshot.table.length, 0)
  assert.equal(snapshot.last_captor, 0)
  assert.equal(snapshot.captured[0].length, 4)
  assert.equal(snapshot.round_complete, false)
  assert.equal(snapshot.round_number, 1)
})

test('controller can complete a round and start a fresh hand with scores carried across', () => {
  const controller = createEscopaMatchController({
    deck_type: 'spanish',
    target_score: 100,
    shuffle: (cards: Card[]) => cards,
    deck: buildFlatDeck(),
  })

  playToRoundComplete(controller)
  const afterRound = controller.snapshot()

  assert.equal(afterRound.round_complete, true)
  assert.equal(afterRound.next_player, null)
  assert.equal(afterRound.table.length, 0)
  assert.equal(afterRound.match_complete, false)
  assert.equal(afterRound.stock_remaining, 0)

  const matchScore = afterRound.score
  const roundNumber = afterRound.round_number

  controller.start_next_hand()
  const afterHand = controller.snapshot()

  assert.equal(afterHand.round_complete, false)
  assert.equal(afterHand.round_number, roundNumber + 1)
  assert.equal(afterHand.next_player, 0)
  assert.equal(afterHand.dealer, 1)
  assert.equal(afterHand.hands[0].length, 3)
  assert.equal(afterHand.hands[1].length, 3)
  assert.equal(afterHand.table.length, 4)
  assert.deepEqual(afterHand.score, matchScore)
})

test('deterministic action prefers a capture when available for villain', () => {
  const controller = createEscopaMatchController({
    deck_type: 'spanish',
    dealer: 0,
    shuffle: (cards: Card[]) => cards,
    deck: buildDeckWithControlledTop([
      { id: 'hero-1', rank: 'A', suit: 'OROS' },
      { id: 'hero-2', rank: '2', suit: 'COPAS' },
      { id: 'hero-3', rank: '3', suit: 'ESPADAS' },
      { id: 'villain-10', rank: 'K', suit: 'BASTOS' },
      { id: 'villain-2', rank: '2', suit: 'OROS' },
      { id: 'villain-3', rank: '3', suit: 'COPAS' },
      { id: 'table-5', rank: '5', suit: 'ESPADAS' },
      { id: 'table-4', rank: '4', suit: 'BASTOS' },
      { id: 'table-6', rank: '6', suit: 'OROS' },
      { id: 'table-7', rank: '7', suit: 'COPAS' },
    ]),
  })

  const snapshot = controller.snapshot()
  assert.equal(snapshot.next_player, 1)

  const action = resolveDeterministicEscopaAction(snapshot, 1)
  const choices = controller.resolveNextCaptureChoices(snapshot.next_player)
  const expectedGroup = choices.byCard[action.card_id]?.captureGroups[0]?.id ?? null

  assert.equal(action.player, 1)
  assert.equal(action.card_id, 'villain-10')
  assert.equal(action.capture_group_id, expectedGroup)
  assert.ok(action.capture_group_id != null)
})

test('deterministic action chooses lowest-value discard when no captures exist', () => {
  const controller = createEscopaMatchController({
    deck_type: 'spanish',
    dealer: 0,
    shuffle: (cards: Card[]) => cards,
    deck: buildDeckWithControlledTop([
      { id: 'hero-1', rank: 'Q', suit: 'OROS' },
      { id: 'hero-2', rank: 'J', suit: 'COPAS' },
      { id: 'hero-3', rank: 'K', suit: 'ESPADAS' },
      { id: 'villain-10', rank: 'K', suit: 'OROS' },
      { id: 'villain-2', rank: '2', suit: 'COPAS' },
      { id: 'villain-3', rank: '3', suit: 'BASTOS' },
      { id: 'table-a', rank: 'A', suit: 'OROS' },
      { id: 'table-a2', rank: 'A', suit: 'COPAS' },
      { id: 'table-a3', rank: 'A', suit: 'ESPADAS' },
      { id: 'table-a4', rank: 'A', suit: 'BASTOS' },
    ]),
  })

  const snapshot = controller.snapshot()
  assert.equal(snapshot.next_player, 1)

  const action = resolveDeterministicEscopaAction(snapshot, 1)

  assert.equal(action.player, 1)
  assert.equal(action.card_id, 'villain-2')
  assert.equal(action.capture_group_id, null)
})

test('deterministic action helper can advance a full round from auto-play', () => {
  const controller = createEscopaMatchController({
    deck_type: 'spanish',
    shuffle: (cards: Card[]) => cards,
    deck: buildFlatDeck(),
  })

  let safety = 0
  while (safety < 120) {
    safety += 1
    const snapshot = controller.snapshot()
    if (snapshot.next_player == null) {
      break
    }

    const action = resolveDeterministicEscopaAction(snapshot, snapshot.next_player)
    controller.play(action)
  }

  const roundFinal = controller.snapshot()
  assert.equal(roundFinal.round_complete, true)
  assert.equal(roundFinal.next_player, null)
  assert.equal(roundFinal.table.length, 0)
  assert.equal(roundFinal.stock_remaining, 0)
})

test('controller resets on redeal and tracks redeal limit', () => {
  const withOneRedeal = createEscopaMatchController({
    deck_type: 'spanish',
    target_score: 100,
    redeals_remaining: 1,
    shuffle: (cards: Card[]) => cards,
    deck: buildFlatDeck(),
  })

  playToRoundComplete(withOneRedeal)
  const afterRound = withOneRedeal.snapshot()
  const previousRedeals = afterRound.redeals_remaining
  withOneRedeal.redeal_match()
  const afterRedeal = withOneRedeal.snapshot()

  assert.equal(afterRedeal.round_number, 1)
  assert.equal(afterRedeal.round_complete, false)
  assert.equal(afterRedeal.match_complete, false)
  assert.deepEqual(afterRedeal.score, { 0: 0, 1: 0 })
  assert.equal(afterRedeal.dealer, afterRound.dealer)
  assert.equal(afterRedeal.redeals_remaining, previousRedeals - 1)
  assert.equal(afterRedeal.hands[0].length, 3)
  assert.equal(afterRedeal.hands[1].length, 3)

  const activeRedealAttempt = runAndExpectError(() => {
    withOneRedeal.redeal_match()
  })
  assert.equal(activeRedealAttempt, 'action_not_allowed_in_round')

  const zeroRedeal = createEscopaMatchController({
    deck_type: 'spanish',
    target_score: 100,
    redeals_remaining: 0,
    shuffle: (cards: Card[]) => cards,
    deck: buildFlatDeck(),
  })

  playToRoundComplete(zeroRedeal)
  const zeroRedealError = runAndExpectError(() => {
    zeroRedeal.redeal_match()
  })
  assert.equal(zeroRedealError, 'match_redeals_exhausted')
})

test('controller rejects out-of-turn action', () => {
  const controller = createEscopaMatchController({
    deck_type: 'spanish',
    shuffle: (cards: Card[]) => cards,
    deck: buildFlatDeck(),
  })

  const snap = controller.snapshot()
  const expectedPlayer = snap.next_player === 0 ? 1 : 0
  const errorCode = runAndExpectError(() => {
    controller.play({
      player: expectedPlayer,
      card_id: snap.hands[expectedPlayer][0].id,
    })
  })

  assert.equal(errorCode, 'out_of_turn')
})

function runAndExpectError(action: () => void): string {
  try {
    action()
  } catch (error) {
    if (error instanceof Error && 'code' in error) {
      return String((error as { code: unknown }).code)
    }
    throw error
  }

  return 'unknown'
}

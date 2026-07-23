import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  deriveEscopaDeckDockState,
  computeCaptureGroups,
  deriveEscopaHandChoices,
  deriveEscopaHudCounters,
  deriveEscopaRoundOutcome,
  deriveEscopaScoreSlots,
  deriveEscopaTableStacks,
  type EscopaDeckDockVariant,
  type EscopaScoreSlots,
} from './escopa-ui-state.ts'
import type { Card, EscopaSuit, HandMap, Rank, Score } from './escopa-engine.ts'

function card(id: string, rank: Rank, suit: EscopaSuit): Card {
  return { id, rank, suit }
}

test('deriveEscopaTableStacks keeps repeated ranks grouped with scoring-suit cards on top', () => {
  const stacks = deriveEscopaTableStacks(
    [
      card('a', '5', 'DIAMONDS'),
      card('b', '5', 'HEARTS'),
      card('c', 'K', 'SPADES'),
      card('d', '5', 'CLUBS'),
      card('e', 'K', 'OROS'),
    ],
    'DIAMONDS',
  )

  assert.equal(stacks.length, 2)
  assert.equal(stacks[0]?.rank, '5')
  assert.deepEqual(stacks[0]?.cards.map((item) => item.id), ['a', 'b', 'd'])
  assert.equal(stacks[0]?.topCard.suit, 'DIAMONDS')
  assert.equal(stacks[0]?.isScoringSuitTop, true)
  assert.deepEqual(stacks[1]?.cards.map((item) => item.id), ['c', 'e'])
  assert.equal(stacks[1]?.isScoringSuitTop, false)
})

test('computeCaptureGroups sorts single-card and smaller groups before larger groups', () => {
  const table = [
    card('a', 'A', 'OROS'),
    card('b', 'A', 'DIAMONDS'),
    card('c', '2', 'OROS'),
    card('d', '5', 'HEARTS'),
    card('e', 'Q', 'COPAS'),
  ]

  assert.deepEqual(computeCaptureGroups(table, 7), [
    [4], // Q
    [0, 2, 3], // A+2+5
    [1, 2, 3], // A+2+5 (second ace)
  ])
})

test('capture group helpers support deterministic multi-choice cycling', () => {
  const table = [
    card('a', 'A', 'OROS'),
    card('b', 'A', 'DIAMONDS'),
    card('c', '2', 'OROS'),
    card('d', '5', 'HEARTS'),
    card('e', 'Q', 'COPAS'),
  ]
  const state = {
    hands: {
      0: [card('p', '7', 'OROS')],
      1: [],
    },
    table,
    next_player: 0 as const,
  }

  const derived = deriveEscopaHandChoices({
    state,
    player: 0,
    selectedCaptureChoiceIdByCardId: {
      p: 'capture:1-2-3',
    },
  }).byCard.p

  assert.equal(derived?.mustDiscard, false)
  assert.equal(derived?.playable, true)
  assert.equal(derived?.captureGroups.length, 3)
  assert.equal(derived?.captureGroups[0]?.id, 'capture:4')
  assert.equal(derived?.selectedCaptureGroupId, 'capture:1-2-3')
  assert.equal(derived?.selectedCaptureGroupIndex, 2)
  assert.equal(derived?.nextCaptureGroupId, 'capture:4')
  assert.equal(derived?.previousCaptureGroupId, 'capture:0-2-3')
})

test('capture groups collapse isomorphic same-rank choices when no scoring impact differs', () => {
  const table = [
    card('a', '6', 'COPAS'),
    card('b', '6', 'ESPADAS'),
  ]
  const state = {
    hands: {
      0: [card('p', 'J', 'OROS')],
      1: [],
    },
    table,
    next_player: 0 as const,
  }

  const derived = deriveEscopaHandChoices({
    state,
    player: 0,
    scoringSuit: 'OROS',
    selectedCaptureChoiceIdByCardId: {},
  }).byCard.p

  assert.equal(derived?.captureGroups.length, 1)
  assert.equal(derived?.captureGroups[0]?.id, 'capture:0')
  assert.equal(derived?.mustDiscard, false)
  assert.equal(derived?.playable, true)
})

test('capture groups remain separate when only one option includes scoring-suit card value', () => {
  const table = [
    card('a', '6', 'OROS'),
    card('b', '6', 'COPAS'),
  ]
  const state = {
    hands: {
      0: [card('p', 'J', 'DIAMONDS')],
      1: [],
    },
    table,
    next_player: 0 as const,
  }

  const derived = deriveEscopaHandChoices({
    state,
    player: 0,
    scoringSuit: 'OROS',
    selectedCaptureChoiceIdByCardId: {},
  }).byCard.p

  assert.equal(derived?.captureGroups.length, 2)
  assert.equal(derived?.captureGroups[0]?.id, 'capture:0')
  assert.equal(derived?.captureGroups[1]?.id, 'capture:1')
})

test('deriveEscopaScoreSlots includes ponto eligibility and captured counts', () => {
  const captured: HandMap = {
    0: [
      card('0a', 'A', 'DIAMONDS'),
      card('0b', '7', 'DIAMONDS'),
      card('0c', 'Q', 'DIAMONDS'),
      card('0d', 'K', 'OROS'),
      card('0e', '2', 'DIAMONDS'),
      card('0f', '2', 'DIAMONDS'),
      card('0g', '3', 'DIAMONDS'),
      card('0h', '4', 'DIAMONDS'),
      card('0i', '5', 'DIAMONDS'),
      card('0j', '6', 'DIAMONDS'),
      card('0k', '5', 'DIAMONDS'),
      card('0l', 'J', 'DIAMONDS'),
      ...Array.from({ length: 9 }, (_, index) => card(`0x${index}`, '2', 'DIAMONDS')),
    ],
    1: [card('1a', 'A', 'SPADES')],
  }
  const scopas: Score = { 0: 2, 1: 0 }

  const scoreSlots: EscopaScoreSlots = deriveEscopaScoreSlots(captured, scopas, 'DIAMONDS')

  assert.equal(scoreSlots[0].capturedStackCount, 21)
  assert.equal(scoreSlots[0].escopaCount, 2)
  assert.deepEqual(scoreSlots[0].belos, { count: 3, isSatisfied: true })
  assert.equal(scoreSlots[0].moreThan20Cards.isSatisfied, true)
  assert.equal(scoreSlots[0].moreThanFiveScoringSuitCards.isSatisfied, true)
  assert.equal(scoreSlots[1].capturedStackCount, 1)
})

test('deriveEscopaRoundOutcome distinguishes discard vs capture and scopa burst metadata', () => {
  const previous = {
    hands: {
      0: [card('p0', '7', 'OROS')],
      1: [card('p1', '4', 'DIAMONDS')],
    },
    captured: {
      0: [],
      1: [],
    },
    scopas: { 0: 1, 1: 0 },
    table: [card('t0', 'A', 'OROS'), card('t1', '2', 'OROS')],
  }

  const next = {
    hands: {
      0: [],
      1: [card('p1', '4', 'DIAMONDS')],
    },
    captured: {
      0: [card('p0', '7', 'OROS'), card('t0', 'A', 'OROS'), card('t1', '2', 'OROS')],
      1: [],
    },
    scopas: { 0: 2, 1: 0 },
    table: [],
  }

  const captureOutcome = deriveEscopaRoundOutcome({ previous, current: next }).byPlayer[0]

  assert.equal(captureOutcome.captureType, 'capture')
  assert.equal(captureOutcome.playedCardId, 'p0')
  assert.equal(captureOutcome.scopaBurst, 'double')
  assert.equal(captureOutcome.cardResultFlags[0], 'is-capture-success')

  const discardNext = {
    hands: {
      0: [card('p0x', 'A', 'OROS')],
      1: [card('p1', '4', 'DIAMONDS')],
    },
    captured: {
      0: [card('p0', '7', 'OROS')],
      1: [],
    },
    scopas: { 0: 0, 1: 0 },
    table: [card('t0', '2', 'DIAMONDS')],
  }

  const discardOutcome = deriveEscopaRoundOutcome({
    previous: {
      hands: {
        0: [card('p0x', 'A', 'OROS'), card('held', 'Q', 'OROS')],
        1: [card('p1', '4', 'DIAMONDS')],
      },
      captured: {
        0: [card('p0', '7', 'OROS')],
        1: [],
      },
      scopas: { 0: 0, 1: 0 },
      table: [],
    },
    current: discardNext,
  }).byPlayer[0]

  assert.equal(discardOutcome.captureType, 'discard')
  assert.equal(discardOutcome.playedCardId, 'held')
  assert.equal(discardOutcome.cardResultFlags.includes('is-capture-failed'), true)
  assert.equal(discardOutcome.scopaBurst, null)
})

test('deriveEscopaHudCounters and deriveEscopaDeckDockState capture stock/dock variants', () => {
  const counters = deriveEscopaHudCounters({
    stock_remaining: 4,
    table: [card('t0', 'A', 'OROS'), card('t1', 'K', 'DIAMONDS')],
    roundNumber: 3,
    redealsRemaining: 1,
    dealer: 1,
  })

  assert.equal(counters.stockRemaining, 4)
  assert.equal(counters.redealsRemaining, 1)
  assert.equal(counters.tableCardCount, 2)
  assert.equal(counters.tableTotal, 11)
  assert.equal(counters.roundNumber, 3)
  assert.equal(counters.dealer, 1)

  const fullDock = deriveEscopaDeckDockState({
    stockRemaining: 4,
    redealsRemaining: 1,
    compactMode: false,
  })
  assert.equal(fullDock.variant, 'full' as EscopaDeckDockVariant)

  const compactCountDock = deriveEscopaDeckDockState({
    stockRemaining: 4,
    redealsRemaining: 1,
    compactMode: true,
    viewportWidth: 500,
  })
  assert.equal(compactCountDock.variant, 'count-only' as EscopaDeckDockVariant)

  const compactIconDock = deriveEscopaDeckDockState({
    stockRemaining: 4,
    compactMode: true,
    viewportWidth: 350,
  })
  assert.equal(compactIconDock.variant, 'icon' as EscopaDeckDockVariant)

  const depletedDock = deriveEscopaDeckDockState({
    stockRemaining: 0,
    compactMode: false,
    viewportWidth: 1200,
  })
  assert.equal(depletedDock.variant, 'none' as EscopaDeckDockVariant)
})

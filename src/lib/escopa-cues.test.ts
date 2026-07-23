import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  deriveEscopaCueHooks,
  resolveEscopaCueLabel,
} from './escopa-cues.ts'
import type { Card, EscopaState, Score } from './escopa-engine.ts'

function card(id: string, rank: string, suit: string): Card {
  return { id, rank: rank as Card['rank'], suit: suit as Card['suit'] }
}

function baseState(): EscopaState {
  return {
    dealer: 0,
    next_player: 0,
    score: { 0: 0, 1: 0 } as Score,
    stock_remaining: 0,
    hands: {
      0: [],
      1: [],
    },
    captured: {
      0: [],
      1: [],
    },
    table: [],
    scopas: { 0: 0, 1: 0 },
    target_score: 15,
    scoring_suit: 'OROS',
  }
}

test('deriveEscopaCueHooks maps opening and double scopas plus score movement', () => {
  const previous = {
    ...baseState(),
    score: { 0: 2, 1: 0 },
    hands: {
      0: [card('h0', '5', 'COPAS')],
      1: [card('h1', 'Q', 'OROS')],
    },
    captured: {
      0: [],
      1: [card('c1', '7', 'OROS')],
    },
    scopas: { 0: 0, 1: 1 },
    table: [card('t0', 'A', 'OROS'), card('t1', '2', 'COPAS')],
  } as EscopaState

  const current = {
    ...baseState(),
    score: { 0: 5, 1: 2 },
    hands: {
      0: [],
      1: [],
    },
    captured: {
      0: [card('h0', '5', 'COPAS'), card('t0', 'A', 'OROS')],
      1: [card('c1', '7', 'OROS'), card('t1', '2', 'COPAS'), card('h1', 'Q', 'OROS')],
    },
    scopas: { 0: 1, 1: 2 },
    table: [],
  } as EscopaState

  const hooks = deriveEscopaCueHooks({ previous, current })

  assert.deepEqual(hooks, [
    { type: 'escopa_pontos_progress', player: 0, scoreDelta: 3 },
    { type: 'escopa_scopa_opening', player: 0, scoreDelta: 3 },
    { type: 'escopa_pontos_progress', player: 1, scoreDelta: 2 },
    { type: 'escopa_scopa_double_opening', player: 1, scoreDelta: 2 },
  ])
})

test('deriveEscopaCueHooks maps normal scopa bursts for non-opening sequences', () => {
  const previous = {
    ...baseState(),
    score: { 0: 1, 1: 1 },
    hands: {
      0: [card('h0', '7', 'COPAS')],
      1: [],
    },
    captured: {
      0: [],
      1: [],
    },
    scopas: { 0: 2, 1: 0 },
    table: [card('t0', '2', 'OROS')],
  } as EscopaState

  const current = {
    ...baseState(),
    score: { 0: 6, 1: 1 },
    hands: {
      0: [],
      1: [],
    },
    captured: {
      0: [card('h0', '7', 'COPAS'), card('t0', '2', 'OROS')],
      1: [],
    },
    scopas: { 0: 3, 1: 0 },
    table: [],
  } as EscopaState

  assert.deepEqual(
    deriveEscopaCueHooks({ previous, current }),
    [
      { type: 'escopa_pontos_progress', player: 0, scoreDelta: 5 },
      { type: 'escopa_scopa', player: 0, scoreDelta: 5 },
    ],
  )
})

test('deriveEscopaCueHooks omits cues when no hands change or no score delta', () => {
  const previous = {
    ...baseState(),
    hands: {
      0: [card('h0', '3', 'COPAS')],
      1: [card('h1', '4', 'OROS')],
    },
    scopas: { 0: 0, 1: 0 },
  } as EscopaState

  assert.equal(deriveEscopaCueHooks({ previous, current: previous }).length, 0)
})

test('resolveEscopaCueLabel exposes cue metadata', () => {
  assert.equal(
    resolveEscopaCueLabel('escopa_scopa_double_opening').motionClass,
    'is-escopa-cue-double-opening-scopa',
  )
  assert.equal(resolveEscopaCueLabel('escopa_scopa').label, 'regular scopa')
})

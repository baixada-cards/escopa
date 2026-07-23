import assert from 'node:assert/strict'
import { test } from 'node:test'

import { createEscopaSoundPlan } from './escopa-sound.ts'

test('card play uses a low tactile thump plus a short paper edge', () => {
  const plan = createEscopaSoundPlan('card_play')

  assert.equal(plan.length, 2)
  assert.equal(plan[0].type, 'triangle')
  assert.ok(plan[0].endFrequency < plan[0].frequency)
  assert.equal(plan[1].type, 'sine')
})

test('score strokes follow the point delta and stay bounded', () => {
  assert.equal(createEscopaSoundPlan('score', { scorePoints: 0 }).length, 1)
  assert.equal(createEscopaSoundPlan('score', { scorePoints: 3 }).length, 3)
  assert.equal(createEscopaSoundPlan('score', { scorePoints: 99 }).length, 5)
})

'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import {
  deriveEscopaDeckDockState,
  deriveEscopaHandChoices,
  deriveEscopaScoreSlots,
  deriveEscopaTableStacks,
} from '../../lib/escopa-ui-state'
import {
  createEscopaMatchController,
  resolveDeterministicEscopaAction,
  type EscopaMatchController,
} from '../../lib/escopa-match-controller'
import { deriveEscopaCueHooks, type EscopaCueHook } from '../../lib/escopa-cues'
import type { EscopaState } from '../../lib/escopa-engine'
import { useEscopaSoundFx } from '../../lib/escopa-sound'

import { EscopaCapturedPile } from './EscopaCapturedPile'
import { EscopaCaptureSweep } from './EscopaCaptureSweep'
import { collectSweepGhosts, type EscopaSweepGhost } from './escopa-sweep-ghosts'
import { EscopaCueOverlay } from './EscopaCueOverlay'
import { EscopaDeckDock } from './EscopaDeckDock'
import { EscopaHand } from './EscopaHand'
import { EscopaScorePad } from './EscopaScorePad'
import { EscopaTableRack } from './EscopaTableRack'

import './EscopaTableFoundation.css'

type EscopaChoiceSelection = Record<string, string | null>

type EscopaMatchSnapshot = EscopaState & {
  round_number: number
  redeals_remaining: number
}

const localPlayer: 0 | 1 = 0

export function EscopaTableFoundation() {
  const [matchController, setMatchController] = useState<EscopaMatchController | null>(null)
  const [snapshot, setSnapshot] = useState<EscopaMatchSnapshot | null>(null)
  const [selectionByCardId, setSelectionByCardId] = useState<EscopaChoiceSelection>({})
  const [hoveredCardId, setHoveredCardId] = useState<string | null>(null)
  const [viewportWidth, setViewportWidth] = useState<number>(1280)
  const [compactMode, setCompactMode] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [sweepGhosts, setSweepGhosts] = useState<EscopaSweepGhost[]>([])
  const [visibleEscopaCueHooks, setVisibleEscopaCueHooks] = useState<EscopaCueHook[]>([])
  const previousSnapshotRef = useRef<EscopaMatchSnapshot | null>(null)
  const cueExpireTimerRef = useRef<number | null>(null)
  const cueSoundTimerRef = useRef<number[]>([])
  const { playSound } = useEscopaSoundFx({ enabled: true, volume: 0.35 })

  const isInitialized = snapshot != null && matchController != null

  const refreshController = useCallback(() => {
    if (matchController == null) return
    setSnapshot(matchController.snapshot())
    setActionError(null)
  }, [matchController])

  const initializeController = useCallback(() => {
    const controller = createEscopaMatchController({ deck_type: 'spanish' })
    setMatchController(controller)
    setSnapshot(controller.snapshot())
    setActionError(null)
    setSelectionByCardId({})
    setHoveredCardId(null)
    previousSnapshotRef.current = null
    setVisibleEscopaCueHooks([])
  }, [])

  useEffect(() => {
    const onResize = () => {
      setViewportWidth(window.innerWidth)
      setCompactMode(window.innerWidth < 800)
    }
    onResize()
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
    }
  }, [])

  useEffect(() => {
    if (!isInitialized) {
      initializeController()
    }
  }, [initializeController, isInitialized])

  // Cue derivation: compare consecutive snapshots and surface scopa/pontos moments.
  useEffect(() => {
    if (!isInitialized) {
      previousSnapshotRef.current = null
      setVisibleEscopaCueHooks([])
      return
    }

    const previousSnapshot = previousSnapshotRef.current
    if (previousSnapshot == null) {
      previousSnapshotRef.current = snapshot
      return
    }

    const nextHooks = deriveEscopaCueHooks({
      previous: previousSnapshot,
      current: snapshot,
    })

    if (cueExpireTimerRef.current != null) {
      window.clearTimeout(cueExpireTimerRef.current)
      cueExpireTimerRef.current = null
    }

    for (const soundTimer of cueSoundTimerRef.current) {
      window.clearTimeout(soundTimer)
    }
    cueSoundTimerRef.current = []

    if (nextHooks.length === 0) {
      setVisibleEscopaCueHooks([])
      previousSnapshotRef.current = snapshot
      return
    }

    setVisibleEscopaCueHooks(nextHooks)
    for (const [index, hook] of nextHooks.entries()) {
      const timerId = window.setTimeout(() => {
        if (hook.type === 'escopa_pontos_progress') {
          playSound('score', { scorePoints: hook.scoreDelta })
        } else {
          playSound('card_play')
        }
      }, 90 * index)
      cueSoundTimerRef.current.push(timerId)
    }

    cueExpireTimerRef.current = window.setTimeout(() => {
      setVisibleEscopaCueHooks([])
      cueExpireTimerRef.current = null
    }, 1600)

    previousSnapshotRef.current = snapshot
  }, [isInitialized, playSound, snapshot])

  useEffect(() => {
    return () => {
      if (cueExpireTimerRef.current != null) {
        window.clearTimeout(cueExpireTimerRef.current)
      }

      for (const soundTimer of cueSoundTimerRef.current) {
        window.clearTimeout(soundTimer)
      }
      cueSoundTimerRef.current = []
    }
  }, [])

  useEffect(() => {
    setSelectionByCardId({})
    setHoveredCardId(null)
  }, [snapshot?.next_player, snapshot?.round_number])

  // Deterministic opponent: short beat, then play.
  useEffect(() => {
    if (!isInitialized || snapshot.next_player !== 1 || snapshot.round_complete || snapshot.match_complete) {
      return undefined
    }

    const timer = window.setTimeout(() => {
      try {
        if (matchController == null) return
        const action = resolveDeterministicEscopaAction(snapshot, 1, selectionByCardId)
        const playedCard = snapshot.hands[1].find((card) => card.id === action.card_id)
        if (playedCard != null && action.capture_group_id != null) {
          const villainChoices = deriveEscopaHandChoices({
            state: {
              hands: snapshot.hands,
              table: snapshot.table,
              next_player: snapshot.next_player,
            },
            player: 1,
            scoringSuit: snapshot.scoring_suit,
            selectedCaptureChoiceIdByCardId: selectionByCardId,
          })
          const group = villainChoices.byCard[action.card_id]?.captureGroups
            .find((candidate) => candidate.id === action.capture_group_id)
          if (group != null) {
            setSweepGhosts((previous) => [
              ...previous,
              ...collectSweepGhosts({ playedCard, capturedCards: group.cards, captor: 1 }),
            ])
          }
        }
        matchController.play(action)
        playSound('card_play')
        refreshController()
        setSelectionByCardId({})
      } catch (error) {
        setActionError(error instanceof Error ? error.message : 'Opponent move failed.')
      }
    }, 560)

    return () => {
      window.clearTimeout(timer)
    }
  }, [isInitialized, matchController, playSound, refreshController, selectionByCardId, snapshot])

  const heroChoices = useMemo(() => {
    if (snapshot == null) return null
    return deriveEscopaHandChoices({
      state: {
        hands: snapshot.hands,
        table: snapshot.table,
        next_player: snapshot.next_player,
      },
      player: localPlayer,
      scoringSuit: snapshot.scoring_suit,
      selectedCaptureChoiceIdByCardId: selectionByCardId,
    })
  }, [selectionByCardId, snapshot])

  const heroActive =
    isInitialized &&
    snapshot.next_player === localPlayer &&
    !snapshot.round_complete &&
    !snapshot.match_complete

  const highlightedCardIds = useMemo(() => {
    const ids = new Set<string>()
    if (!heroActive || heroChoices == null || hoveredCardId == null) return ids
    const choice = heroChoices.byCard[hoveredCardId]
    if (choice == null) return ids
    const selectedGroup =
      choice.captureGroups.find((group) => group.id === choice.selectedCaptureGroupId) ??
      choice.captureGroups[0]
    if (selectedGroup == null) return ids
    for (const cardId of selectedGroup.cardIds) {
      ids.add(cardId)
    }
    return ids
  }, [heroActive, heroChoices, hoveredCardId])

  const cycleChoice = useCallback((cardId: string, direction: 'previous' | 'next') => {
    if (heroChoices == null) return
    const choice = heroChoices.byCard[cardId]
    if (choice == null) return
    const nextId = direction === 'next' ? choice.nextCaptureGroupId : choice.previousCaptureGroupId
    if (nextId == null) return
    setSelectionByCardId((previous) => ({
      ...previous,
      [cardId]: nextId,
    }))
  }, [heroChoices])

  const playCard = useCallback((cardId: string) => {
    if (!isInitialized || snapshot.next_player !== localPlayer) return
    const choice = heroChoices?.byCard[cardId]
    if (choice == null || !choice.playable) return
    if (matchController == null) return

    try {
      const playedCard = snapshot.hands[localPlayer].find((card) => card.id === cardId)
      const selectedGroup = choice.captureGroups.find((group) => group.id === choice.selectedCaptureGroupId)
      if (playedCard != null && selectedGroup != null) {
        setSweepGhosts((previous) => [
          ...previous,
          ...collectSweepGhosts({ playedCard, capturedCards: selectedGroup.cards, captor: localPlayer }),
        ])
      }
      matchController.play({
        player: localPlayer,
        card_id: cardId,
        capture_group_id: choice.selectedCaptureGroupId,
      })
      playSound('card_play')
      refreshController()
      setSelectionByCardId({})
      setHoveredCardId(null)
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Unable to play that card.')
    }
  }, [heroChoices, isInitialized, matchController, playSound, refreshController, snapshot])

  const startNextHand = useCallback(() => {
    if (!isInitialized || !snapshot.round_complete || snapshot.match_complete) return
    if (matchController == null) return

    try {
      matchController.start_next_hand()
      refreshController()
      setSelectionByCardId({})
      previousSnapshotRef.current = null
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Unable to start next hand.')
    }
  }, [isInitialized, matchController, refreshController, snapshot])

  if (!isInitialized) {
    return (
      <main className="et-root et-root--loading" data-testid="escopa-root">
        <div className="et-loading-note">Pulling up a chair…</div>
      </main>
    )
  }

  const deckDock = deriveEscopaDeckDockState({
    stockRemaining: snapshot.stock_remaining,
    redealsRemaining: snapshot.redeals_remaining,
    compactMode,
    viewportWidth,
  })
  const scoreSlots = deriveEscopaScoreSlots(snapshot.captured, snapshot.scopas, snapshot.scoring_suit)
  const tableStacks = deriveEscopaTableStacks(snapshot.table, snapshot.scoring_suit)
  const matchLine = snapshot.score[0] > snapshot.score[1] ? 'The match is yours.' : 'The match goes to them.'

  return (
    <main className="et-root" data-testid="escopa-root">
      <div className="et-surface walnut" aria-hidden="true" />
      <div className="et-lamp" aria-hidden="true" />
      <div className="et-vignette" aria-hidden="true" />

      <div className="et-stage">
        <header className="et-band et-band-villain">
          <div className="et-band-slot et-band-slot-left" aria-hidden="true" />
          <EscopaHand
            cards={snapshot.hands[1]}
            choices={null}
            owner="villain"
            active={false}
          />
          <div className="et-band-slot et-band-slot-right">
            <EscopaCapturedPile
              owner="villain"
              capturedCount={snapshot.captured[1].length}
              scopaCount={snapshot.scopas[1]}
            />
          </div>
        </header>

        <section className="et-table" data-testid="escopa-table" aria-label="Escopa table">
          <div className="et-score-line">
            <span>You {snapshot.score[0]}</span>
            <span className="et-score-line-sep" aria-hidden="true">·</span>
            <span>Them {snapshot.score[1]}</span>
          </div>

          <EscopaTableRack stacks={tableStacks} highlightedCardIds={highlightedCardIds} />

          <div className="et-deck-slot">
            <EscopaDeckDock dock={deckDock} />
          </div>

          {snapshot.round_complete && !snapshot.match_complete && (
            <div className="et-rest">
              <div className="et-rest-line">Hand complete.</div>
              <button type="button" className="et-action" onClick={startNextHand}>
                Deal the next hand
              </button>
            </div>
          )}
          {snapshot.match_complete && (
            <div className="et-rest">
              <div className="et-rest-line">{matchLine}</div>
              <button type="button" className="et-action et-action-primary" onClick={initializeController}>
                New match
              </button>
            </div>
          )}

          <EscopaCueOverlay hooks={visibleEscopaCueHooks} />
        </section>

        <EscopaCaptureSweep
          ghosts={sweepGhosts}
          onGhostDone={(key) => {
            setSweepGhosts((previous) => previous.filter((ghost) => ghost.key !== key))
          }}
        />

        <footer className="et-band et-band-hero">
          <div className="et-band-slot et-band-slot-left">
            {actionError != null && <p className="et-error">{actionError}</p>}
          </div>
          <EscopaHand
            cards={snapshot.hands[0]}
            choices={heroChoices}
            owner="hero"
            active={heroActive}
            onPlay={playCard}
            onCycle={cycleChoice}
            onHoverChange={setHoveredCardId}
          />
          <div className="et-band-slot et-band-slot-right">
            <EscopaCapturedPile
              owner="you"
              capturedCount={snapshot.captured[0].length}
              scopaCount={snapshot.scopas[0]}
            />
          </div>
        </footer>
      </div>

      <EscopaScorePad
        scoreSlots={scoreSlots}
        score={snapshot.score}
        scoringSuit={snapshot.scoring_suit}
        roundNumber={snapshot.round_number}
        targetScore={snapshot.target_score}
      />
    </main>
  )
}

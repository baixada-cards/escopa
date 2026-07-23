import { deriveEscopaRoundOutcome } from './escopa-ui-state.ts'
import type { EscopaState } from './escopa-engine.ts'
import type { EscopaScopaBurst } from './escopa-ui-state.ts'

type EscopaPlayer = 0 | 1

export const ESCOPA_CUE_IDS = [
  'escopa_pontos_progress',
  'escopa_scopa',
  'escopa_scopa_opening',
  'escopa_scopa_double_opening',
] as const

export type EscopaCueType = (typeof ESCOPA_CUE_IDS)[number]

type EscopaCuePlanMeta = {
  label: string
  description: string
  motionClass: string
}

export const ESCOPA_CUE_PLAN: Record<EscopaCueType, EscopaCuePlanMeta> = {
  escopa_pontos_progress: {
    label: 'pontos do baralho progress',
    description: 'incremental card-value payout and score delta motion',
    motionClass: 'is-escopa-cue-pontos',
  },
  escopa_scopa: {
    label: 'regular scopa',
    description: 'clean capture-and-clear treatment for standard escopas',
    motionClass: 'is-escopa-cue-scopa',
  },
  escopa_scopa_opening: {
    label: 'opening scopa',
    description: 'special opening-scopa motion and sound hook',
    motionClass: 'is-escopa-cue-opening-scopa',
  },
  escopa_scopa_double_opening: {
    label: 'double opening scopa',
    description: 'special double-opening scopa treatment',
    motionClass: 'is-escopa-cue-double-opening-scopa',
  },
}

export type EscopaCueHook = {
  type: EscopaCueType
  player: EscopaPlayer
  scoreDelta: number
}

function normalizeScopaBurstCue(scopaBurst: EscopaScopaBurst | null): EscopaCueType | null {
  if (scopaBurst == null) {
    return null
  }

  if (scopaBurst === 'opening') {
    return 'escopa_scopa_opening'
  }

  if (scopaBurst === 'double') {
    return 'escopa_scopa_double_opening'
  }

  return 'escopa_scopa'
}

export function resolveEscopaCueLabel(type: EscopaCueType): EscopaCuePlanMeta {
  return ESCOPA_CUE_PLAN[type]
}

export function deriveEscopaCueHooks({
  previous,
  current,
}: {
  previous: EscopaState
  current: EscopaState
}): EscopaCueHook[] {
  const hooks: EscopaCueHook[] = []
  const outcome = deriveEscopaRoundOutcome({
    previous: {
      hands: previous.hands,
      captured: previous.captured,
      scopas: previous.scopas,
      table: previous.table,
    },
    current: {
      hands: current.hands,
      captured: current.captured,
      scopas: current.scopas,
      table: current.table,
    },
  })

  for (const player of [0, 1] as const) {
    const scoreDelta = current.score[player] - previous.score[player]
    if (scoreDelta > 0) {
      hooks.push({
        type: 'escopa_pontos_progress',
        player,
        scoreDelta,
      })
    }

    const playerOutcome = outcome.byPlayer[player]
    const scopaCue = normalizeScopaBurstCue(playerOutcome.scopaBurst)
    if (scopaCue == null) {
      continue
    }

    hooks.push({
      type: scopaCue,
      player,
      scoreDelta: Math.max(0, scoreDelta),
    })
  }

  return hooks
}

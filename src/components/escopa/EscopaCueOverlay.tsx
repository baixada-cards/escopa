'use client'

import { resolveEscopaCueLabel, type EscopaCueHook, type EscopaCueType } from '../../lib/escopa-cues'

const CUE_DISPLAY: Record<EscopaCueType, { title: (hook: EscopaCueHook) => string; burst: 0 | 1 | 2 }> = {
  escopa_pontos_progress: { title: (hook) => `+${hook.scoreDelta}`, burst: 0 },
  escopa_scopa: { title: () => 'Escopa', burst: 1 },
  escopa_scopa_opening: { title: () => 'Escopa de entrada', burst: 1 },
  escopa_scopa_double_opening: { title: () => 'Escopa dupla', burst: 2 },
}

export function EscopaCueOverlay({ hooks }: { hooks: EscopaCueHook[] }) {
  if (hooks.length === 0) return null

  return (
    <div className="et-cue-overlay" aria-live="polite">
      {hooks.map((hook, index) => {
        const meta = resolveEscopaCueLabel(hook.type)
        const display = CUE_DISPLAY[hook.type]
        const who = hook.player === 0 ? 'you' : 'them'
        const delta = hook.type !== 'escopa_pontos_progress' && hook.scoreDelta > 0
          ? ` · +${hook.scoreDelta}`
          : ''
        return (
          <div
            key={`${hook.type}-${hook.player}-${index}`}
            className={`et-cue ${meta.motionClass}`}
            style={{ animationDelay: `${index * 90}ms` }}
          >
            {display.burst >= 1 && <span className="et-cue-ring" aria-hidden="true" />}
            {display.burst >= 2 && <span className="et-cue-ring et-cue-ring-late" aria-hidden="true" />}
            <span className="et-cue-title">{display.title(hook)}</span>
            <span className="et-cue-sub">{who}{delta}</span>
          </div>
        )
      })}
    </div>
  )
}

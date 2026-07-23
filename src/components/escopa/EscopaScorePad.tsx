'use client'

import type { EscopaPlayerScoreSlots, EscopaScoreSlots } from '../../lib/escopa-ui-state'

function InkCheck() {
  return (
    <svg className="et-ink-check" viewBox="0 0 14 14" aria-hidden="true">
      <path
        d="M 2 7.5 C 4 9.5 5.5 11.5 6.5 11.5 C 7.5 11.5 10 5 13 2.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

type PadRow = {
  key: string
  label: string
  read: (slots: EscopaPlayerScoreSlots) => { value: string; satisfied: boolean }
}

const buildRows = (suitName: string): PadRow[] => [
  {
    key: 'belos',
    label: 'belos',
    read: (slots) => ({ value: `${slots.belos.count}`, satisfied: slots.belos.isSatisfied }),
  },
  {
    key: 'sevens',
    label: 'sevens',
    read: (slots) => ({ value: `${slots.sevens.count}`, satisfied: slots.sevens.isSatisfied }),
  },
  {
    key: 'suit',
    label: suitName,
    read: (slots) => ({
      value: `${slots.moreThanFiveScoringSuitCards.count}`,
      satisfied: slots.moreThanFiveScoringSuitCards.isSatisfied,
    }),
  },
  {
    key: 'cards',
    label: 'cards',
    read: (slots) => ({
      value: `${slots.moreThan20Cards.count}`,
      satisfied: slots.moreThan20Cards.isSatisfied,
    }),
  },
  {
    key: 'majority',
    label: 'majority',
    read: (slots) => ({ value: slots.majorityCards.isSatisfied ? '✓' : '–', satisfied: slots.majorityCards.isSatisfied }),
  },
  {
    key: 'escopas',
    label: 'escopas',
    read: (slots) => ({ value: `${slots.escopaCount}`, satisfied: slots.escopaCount > 0 }),
  },
]

export function EscopaScorePad({
  scoreSlots,
  score,
  scoringSuit,
  roundNumber,
  targetScore,
}: {
  scoreSlots: EscopaScoreSlots
  score: { 0: number; 1: number }
  scoringSuit: string
  roundNumber: number
  targetScore: number
}) {
  const suitName = scoringSuit.toLowerCase()
  const rows = buildRows(suitName)

  return (
    <aside className="et-scorepad paper" aria-label="Score pad">
      <div className="et-scorepad-names" aria-hidden="true">
        <span>you</span>
        <span>them</span>
      </div>
      <div className="et-scorepad-digits">
        <span className="et-scorepad-digit">{score[0]}</span>
        <span className="et-scorepad-rule" aria-hidden="true" />
        <span className="et-scorepad-digit">{score[1]}</span>
      </div>
      <ul className="et-scorepad-rows">
        {rows.map((row) => {
          const hero = row.read(scoreSlots[0])
          const villain = row.read(scoreSlots[1])
          return (
            <li key={row.key} className="et-scorepad-row">
              <span className={`et-scorepad-cell ${hero.satisfied ? 'is-satisfied' : ''}`}>
                {hero.satisfied && row.key !== 'majority' && <InkCheck />}
                {hero.value}
              </span>
              <span className="et-scorepad-cat">{row.label}</span>
              <span className={`et-scorepad-cell ${villain.satisfied ? 'is-satisfied' : ''}`}>
                {villain.satisfied && row.key !== 'majority' && <InkCheck />}
                {villain.value}
              </span>
            </li>
          )
        })}
      </ul>
      <div className="et-scorepad-foot">round {roundNumber} · game to {targetScore} · {suitName} score</div>
    </aside>
  )
}

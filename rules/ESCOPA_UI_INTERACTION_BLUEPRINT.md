# Escopa UI Interaction Blueprint (Farol family adaptation)

Scope: historical interaction blueprint plus implementation rationale.
Output target: this standalone Escopa application and its `rules/` contracts.

> Status: the first playable implementation now lives in this repository.
> File names below preserve the original planning record; consult `src/` for
> the implemented component and state boundaries.

## 1) Intent

Create a dedicated Escopa table experience that keeps the Farol visual language and layout system, but abandons Truco-specific stake/trunup mechanics in favor of Escopa state semantics:

- no stake ladder / raise actions
- no turn-up/vira emphasis in the dock
- no Truco-specific hand winner text chips
- explicit Escopa board telemetry (stock, redraws, captures, scopas, score categories)
- explicit capture-choices interaction for 15-card sums

## 2) Current work mapping

| Requirement | Concrete implementation target |
|---|---|
| Show remaining stock/redraw count instead of Truco turnup emphasis | New `EscopaTableHud` stock module derived from `escopaState.stockRemaining` and `escopaState.roundsPlayed`-style counter. Add a reusable `EscopaDeckDock` replacing turn-up card in compact/small layouts. |
| Allow compact variants to use a deck icon in the dock | `EscopaDeckDock` supports modes: `full` (card table), `icon` (deck glyph only), `none` and `count-only` for narrow breakpoints. |
| Group repeated table ranks into stacks with scoring suit on top | `EscopaTableCardStack` groups table cards by rank/value and renders suit-aware stack order; scoring-suit groups get top jewel accent for immediate recognition. |
| Show both players' captured card stacks and escopas | `EscopaCaptureColumn` panels for Hero and Villain with captured pile thumbnails + counters + scopa markers. |
| Show six pontos do baralho slots per player (belos, >20 cards, >5 suit cards) | `EscopaScoreCategoryPills` with six fixed slots per player for thresholds and indicators: belos, majority-cards, majority-sevens, majority-suit, scopas, total match score progress (or “pending round”). |
| Support capture-choice cycling for available 15 groupings | Introduce `useEscopaCaptureCycler()` and `EscopaCaptureCyclerStrip` for cycling through legal capture sets computed from table + hand card. Selection is done by cycling (`Tab`, swipe, click) and submit action includes choice ID. |
| Style hand cards to communicate discard vs capture outcome without explanatory text | Add visual state classes on `LiveCard` instances: `is-discard-candidate`, `is-capture-candidate`, `is-capture-selected`, `is-capture-failed` and `is-capture-success`, with non-text affordances via frame, gradient edge, badge, and motion. |
| Remove raising-stake affordances | Gate/replace `FarolActionRail` with `EscopaActionRail` and hide raise/call/fold sections in Escopa mode; only keep hand play controls and restart/next-round actions. |
| Define new coin/jewelry sound + motion direction with iconic escopa and special opening escopa/two-escopa treatment | New sound theme hooks in `table-sound-fx` + dedicated motion plan for captured sweep/stacking, scopa bell, and opening-scopa stinger in reveal/final table-clear events. |

## 3) Reuse vs new: component split

### Reuse directly

- `src/components/farol/FarolTable.tsx` → keep layout shell mechanics and animation infrastructure.
- `src/components/farol/DeckCard.tsx`, `DeckWithVira.tsx` → reuse for card rendering + card deck visuals.
- `src/components/live/LiveHand.tsx` and `src/components/live/LiveCard.tsx` → adapt with new affordance props/classes.
- `src/lib/live-game-state.ts`, `src/lib/escopa-engine.ts`, and `src/lib/use-live-engine-state.ts` event reducer patterns.
- `src/lib/table-sound-fx.ts` for audio dispatch plumbing.

### New/escopa-specific

- `src/components/escopa/EscopaTable.tsx`
- `src/components/escopa/EscopaTable.css`
- `src/components/escopa/EscopaActionRail.tsx`
- `src/components/escopa/EscopaDeckDock.tsx`
- `src/components/escopa/EscopaCaptureCycler.tsx`
- `src/components/escopa/EscopaStackCell.tsx`
- `src/components/escopa/EscopaCapturedColumns.tsx`
- `src/lib/escopa-ui-state.ts`
- `src/lib/escopa-visual-state.ts`
- `src/lib/escopa-sound-themes.ts`
- `app/page.tsx` on the standalone `escopa.baixada.cards` application.

## 4) State derivation helpers (expected implementation surface)

Create `src/lib/escopa-ui-state.ts`.

- `type EscopaCard = { id: string; rank: string; suit: string }`
- `type CapturedBucket = { rank: string; count: number; cards: EscopaCard[]; topSuit: string; isScoringSuit: boolean }`

- `deriveEscopaHandChoices(state: EscopaMatchState)`
  - Input: normalized Escopa hand + table.
  - Output: map per hand index => `playable`, `mustDiscard`, `captureChoices[]`.
  - Includes legal 15-set enumeration.

- `computeCaptureGroups(table: EscopaCard[], playedValue: number)`
  - Returns stable list of index sets where played card plus set totals 15.
  - Includes deterministic tie order: `single-card`, `smallest-card-count`, `left-to-right`.

- `normalizeCaptureGroupLabels(groups)`
  - Enriches group with `id`, `value`, `visualRank`, `cardIds`, `isPrimary`, `isScopaPotential`.

- `deriveEscopaTableStacks(table: EscopaCard[], scoringSuit: string)`
  - Groups same rank cards into render groups.
  - Marks top card style: scoring-suit gets gem badge + glow.

- `deriveEscopaScoreSlots(captured: EscopaCard[][], scopas: Score, targetScoringSuit: string)`
  - Produces fixed six-slot model per player:
    - `belo`
    - `moreThan20Cards`
    - `moreThanFiveSuit`
    - `scopas`
    - `sevens`
    - `majorityCards`

- `deriveEscopaRoundOutcome(prevHand, nextHand)`
  - Produces non-textual affordance payload:
    - `{ captureType: 'capture' | 'scopa' | 'discard' }`
    - `cardResultFlags` for hero/villain to drive card ring/edge states
    - `scopaBurst` metadata (`opening|normal|double`) for animation/sound.

- `deriveEscopaHudCounters(state)`
  - Outputs: `stockRemaining`, `remainingRedeals`, `roundNumber`, `tableTotal`, `dealerHand` style metadata.

- `deriveEscopaCompactDock(state)`
  - Outputs dock mode and iconography at width/compact thresholds.

## 5) Escopa interaction contract (client-facing)

- For card-play actions, include explicit capture choice index when multiple captures are legal.
- Session actions should not force plain “play this card” when multiple 15-combinations exist.

Suggested payload extension (schema in progress):

- `SessionAction` union addition: `play_card_with_capture` (or enrich `play_face_up` with `captureChoiceId?: string | null` in Escopa mode only)
- `legalActions` should include only capture-compatible actions for the selected active card in Escopa mode.
- `publicState` should include `capture_choices` and `stock_remaining` values so table can render deterministic cycles without extra server calls.

## 6) UI behavior slices

### Slice A — Foundation (read-only migration)
- Add an Escopa page/mode branch.
- Create `EscopaTable` shell and dock with neutral Farol spacing.
- Render static table, captured columns, stock counter, category slots.

### Slice B — State wiring
- Add `escopa-ui-state.ts` helpers and route them into `LiveGame` / dedicated Escopa container.
- Map `SessionPayload` to escopa-specific projection types.

### Slice C — Capture mechanics
- Implement capture enumerator + stable cycle controls.
- Add keyboard (`Tab`), swipe, and compact cycling UI.
- Submit selected choice in the action payload.

### Slice D — Outcome affordances
- Apply non-text hand card state classes and animations:
  - capture candidate glow ring
  - discard face-down “cold” dim + lowered elevation
  - capture selected pulse/arc path to target stack
  - scopa burst flash + coin chiming stack bounce.

### Slice E — Score and scopa panels
- Add hero/villain captured stacks with category slots.
- Show fixed six slots + unresolved slots in neutral state until category determined.
- Persist last known captured categories for round-end clarity.

### Slice F — Audio/motion polish
- Add escopa-specific theme identifiers (coin/jewelry aesthetic):
  - `escopa-card-play`, `escopa-capture`, `escopa-scopa`, `escopa-opening-escopa`, `escopa-double-opening-escopa`.
- Use directional motion from card stack center -> scopa marker -> score rail.
- Two-scopa opening gets double-chime + longer rise/fall timing.

## 7) Acceptance mapping checklist

- [ ] Documented every Elvis requirement and linked to component/helper names.
- [ ] Reusable Farol components called out and isolated; only Escopa-specific deltas moved to new folder.
- [ ] Capture cycling path describes all ambiguity-handling (no manual list picking).
- [ ] Non-text outcomes are expressed as visual affordance classes and motion states.
- [ ] Stock and redraw counters replace Truco turn-up visuals in non-compact and compact flows.
- [ ] Opening and double-opening escopa audio/animation plan is specified with concrete event names.

## 8) Out-of-scope for this task

- No gameplay API changes in this doc-only commit.
- No production UI behavior changes in this commit.
- No stake/raise logic refactors in runtime code for this blueprint-only step.
- No CSS/asset implementation; only implementation-ready architecture and naming.

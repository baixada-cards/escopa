# Escopa Fixture Contract

The Escopa fixture corpus is specification data for a future JavaScript engine
runner. Fixtures describe one small rule behavior at a time: the runner loads
`initial_state`, applies `action`, and compares the result with `expected`.

## Version

- `fixture_version` is `escopa-fixture/v1`.
- `ruleset` is `escopa-2p-v1`.
- The machine-checkable JSON Schema lives at `schemas/fixture.schema.json`.

## Decks

- Spanish fixtures use `deck_type: "spanish"`, `scoring_suit: "OROS"`, and
  only `OROS`, `COPAS`, `ESPADAS`, and `BASTOS`.
- French fixtures use `deck_type: "french"`, `scoring_suit: "DIAMONDS"`, and
  only `DIAMONDS`, `HEARTS`, `SPADES`, and `CLUBS`.
- Both decks use ranks `A`, `2`, `3`, `4`, `5`, `6`, `7`, `Q`, `J`, and `K`.
- Capture values are `A=1`, `2..7` at face value, `Q=8`, `J=9`, and `K=10`.

## State

`initial_state` and `expected.state` use the same shape:

- `dealer`, `next_player`, `score`, `stock_remaining`, `hands`, `captured`,
  `table`, `scopas`, `target_score`, and `scoring_suit` are required.
- `next_player` may be `null` only after a round or match has completed.
- `last_captor` is optional and may be `null`.
- `round_complete`, `match_complete`, and `round_points` are optional summary
  fields for end-of-round and end-of-match fixtures.

## Actions

- `play_card` requires `player` and `card_id`.
- `captured_card_ids` is present only when the played card captures table
  cards. The played hand card is captured implicitly and should not be listed.
- If a `play_card` action has no `captured_card_ids`, the played card is
  discarded to the table.
- `resolve_initial_table` handles the opening-table scopa rule before normal
  play begins.
- `assert_deck` is used for static deck, value, and scoring-category fixtures.

## Rejection expectations

- Add `expected.rejection` to represent invalid action/initial-state fixtures.
- `expected.rejection.category` must be a short snake_case identifier, e.g.
  `out_of_turn_play` or `captured_set_not_15`.
- `expected.rejection.message_contains` may optionally assert a key message
  fragment for stronger matching.
- Rejection fixtures belong under the `invalid/` directory.
- Valid fixtures belong under existing semantic folders (captures, decks, rounds,
  scopas, scoring, values).

## Expected Results

- For valid fixtures, `expected.state` should include the full relevant state
  after the action, and optionally `expected.assertions` for derived checks.
- For rejection fixtures, include `expected.rejection` and expect the engine to
  reject with a matching category and optional message fragment.
- Existing valid fixtures continue to pass with unchanged behavior.
- Fixtures should avoid broad scenario coverage when a smaller state can prove
  the rule.

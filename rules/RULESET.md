# Escopa

First-phase rules draft for fixture planning. This document is intentionally
correction-friendly: assumptions and open questions are called out instead of
being hidden in future fixtures.

## Objective

- Win the game by reaching 15 points before the other player.
- Points are scored at the end of each round from captured cards and scopas.
- During play, the immediate goal is to capture table cards by making a total
  value of 15 with one card from hand plus one or more cards on the table.

## Players

- This first phase targets 2 players.
- Players are identified as `0` and `1` for fixture and engine planning.
- Partnership, 3-player, and 4-player forms are out of scope for this draft.

## Deck

- The deck has 40 cards.
- The game supports both the Spanish 40-card deck and the French-style 40-card
  deck used by Truco.
- The Spanish suits are:
  - oros,
  - copas,
  - espadas,
  - bastos.
- The French suits are:
  - diamonds,
  - hearts,
  - spades,
  - clubs.
- The ranks are `A`, `2`, `3`, `4`, `5`, `6`, `7`, `Q`, `J`, and `K`.
- There are no `8`, `9`, or `10` cards.
- In Spanish-deck presentation, `Q`, `J`, and `K` may be rendered with the
  equivalent Spanish face-card artwork.
- There are no jokers.

## Card Values

- `A` is worth 1.
- Number cards `2` through `7` use their rank value.
- `Q` is worth 8.
- `J` is worth 9.
- `K` is worth 10.
- Suit does not affect capture value.
- There is no trick strength order during play; cards are compared only for
  scoring categories after the round.

## Setup

- Choose the first dealer by an external method.
- The dealer rotates after each completed round.
- The player who is not the dealer leads the first turn of the round.
- At the start of a round:
  - deal 3 cards face down to each player,
  - deal 4 cards face up to the table,
  - leave the remaining deck face down as the stock.
- Each player may see only their own hand.
- Table cards, captured-card counts, and marked scopas are public.

## Initial Table Capture

- If the 4 initial table cards total 15, the dealer captures those 4 cards
  before normal play begins and records 1 scopa.
- If the 4 initial table cards can be partitioned into two groups totaling 15,
  the dealer captures those 4 cards before normal play begins and records
  2 scopas.
- After an initial table capture, normal play begins with an empty table.

## Turn Flow

- Players alternate turns.
- On a turn, the acting player plays exactly one card from hand face up.
- If the played card plus one or more table cards totals 15, the played card
  and the selected table cards are captured.
- If no capture is made, the played card is discarded face up to the table.
- After both players have played all 3 cards in hand, deal 3 more cards to each
  player from the stock.
- Do not deal new table cards after the opening deal.
- Continue until the stock is exhausted and both players have played their last
  3 cards.

## Legal Moves

- On your turn, you may play any one card in your hand.
- If the played card can capture at least one legal set of table cards totaling
  15, the move must choose exactly one such set and capture it.
- If more than one capture set is available, the acting player may choose any
  one legal set.
- A played card may not capture table cards unless the total including the
  played card is exactly 15.
- A played card may not capture table cards without itself being included in the
  total.
- A player may not pass.
- A player may not play more than one card.
- A player may not take table cards that sum to 15 without playing a hand card.

## Capture Behavior

- Captured cards move to the acting player's captured pile.
- The played card is captured together with the selected table cards.
- Captured cards cannot be used again in the round.
- If a capture removes all cards from the table, it is a scopa.
- A scopa is marked immediately and scores 1 point at the end of the round.
- The final leftover-table collection at the end of the round is not a scopa.

## End Of Round

- When the last cards in hand have been played and the stock is empty, the round
  ends.
- Any cards still face up on the table are awarded to the last player who made a
  capture during that round.
- If no player captured any cards during the round, the leftover table cards are
  awarded to the dealer.
- Then score the round.

## Scoring

- Each scopa scores 1 point.
- Each belo scores 1 point for the player who captured it.
- The four belos are `A`, `7`, `Q`, and `K` of the scoring suit.
- The scoring suit is oros for the Spanish deck and diamonds for the French
  deck.
- The player with more captured cards in the scoring suit scores 1 point.
- The player with more captured `7`s scores 1 point.
- The player with more captured cards scores 1 point.
- If a category is tied, no point is awarded for that category.

## Game Flow

- Add round points to the game score after each round.
- If exactly one player has reached or passed the target score, that player wins
  the game.
- If both players reach or pass the target score after the same round, the
  higher score wins.
- If both players are tied at or above the target score, play another round.

## First-Phase Assumptions

- The product and rules name is `Escopa`.
- The first-phase game is 2-player only.
- The first-phase match target is 15 points.
- The first-phase decks are Spanish 40-card and French-style 40-card. The
  Italian deck is not in scope yet.
- The first-phase scoring categories are scopas, belos, most scoring-suit
  cards, most `7`s, and most cards.
- Tied scoring categories award 0 points to both players.
- Multiple capture choices are player-choice, not forced by smallest set,
  largest set, same-rank preference, or scoring optimization.
- If the initial 4 table cards total 15, the dealer receives 1 scopa. If they
  can be split into two separate groups totaling 15, the dealer receives 2
  scopas.
- If no player captured during the round, leftover table cards go to the dealer.
  This is a fallback assumption for an edge case.

## Variants Deferred

- 3-player and 4-player play.
- Partnership play.
- Italian-deck card labels.
- Prime or setenta scoring based on one card per suit.
- Bonus points for all scoring-suit cards.
- Bonus points for all `7`s.
- Awarding tied majority categories to both players.
- A table-only capture rule where a player may take table cards that sum to 15
  before playing from hand.
- A forced-capture rule that constrains which capture set must be chosen when
  several are available.
- A game target of 21 or 31 points.

## Open Questions

- Should tied majority categories score 0 points, or should both players receive
  the point?
- Should first-phase scoring include setenta or prime instead of the simpler
  "most sevens" category?
- Should capturing all scoring-suit cards or all `7`s add bonus points?
- If several capture sets are available, may the player choose freely, or should
  a deterministic rule choose the capture?
- Should a player be allowed to deliberately discard a card even when that card
  could capture?
- Should the initial table capture handle only total 15 and total 30, or all
  possible partitions into 15-point groups?
- If no capture happens in a round, who receives the leftover table cards?
- Should the engine expose captured piles exactly, summary counts only, or both?

## Source Notes

- Public Escoba/Scopa de 15 rules agree that captures are made by combining one
  hand card with table cards to total 15, using a 40-card deck where face cards
  count as 8, 9, and 10.
- Elvis's Escopa rules set the match target at 15 and score four belos:
  `A`, `7`, `Q`, and `K` of oros or diamonds.
- Public rules differ on scoring variants, tie handling, and table-only capture
  of missed 15s. Those differences are intentionally captured as assumptions or
  open questions above instead of being treated as settled.

# Scopa Fixtures

This directory contains JSON fixtures for the Escopa/Scopa phase.

## Layout

- `CONTRACT.md` documents the fixture contract for engine authors.
- `schemas/` contains the machine-checkable fixture contract.
- `invalid/` contains fixtures that assert expected rejections for invalid states or actions.
- `decks/` contains deck-compatibility fixtures (Spanish vs French).
- `values/` contains card-value semantics fixtures.
- `captures/` contains turn-level capture behavior fixtures.
- `scopas/` contains scopa-related fixtures (normal and initial-table).
- `rounds/` contains round-flow fixtures (e.g., end-of-round leftovers).
- `scoring/` contains round-scoring behavior fixtures.

## Current contract

- `CONTRACT.md`
- `schemas/fixture.schema.json`
- `fixture_version`: `escopa-fixture/v1`
- `ruleset`: `escopa-2p-v1`

## Adding new fixtures

Each fixture follows this contract:

1. Fill `initial_state`, describing current round state before the step.
2. Set one `action` (currently `play_card`, `assert_deck`, or `resolve_initial_table`).
3. Describe `expected` state assertions after applying the action.
4. Keep card IDs scoped to the fixture and unique within that fixture.
5. Keep deck suits consistent with `deck_type`: Spanish fixtures use `OROS`,
   `COPAS`, `ESPADAS`, and `BASTOS`; French fixtures use `DIAMONDS`, `HEARTS`,
   `SPADES`, and `CLUBS`.
6. Keep fixtures focused to one behavior per file.

## Organization rules

- Group fixtures by behavior area under a semantic folder.
- Name files with stable slugs that indicate intent.
- Use card `id` values unique within each fixture.

## Validation

Validate all fixture JSON with:

```bash
python -m json.tool <file>
```

or by iterating all fixture files.

## Scope note

These fixtures describe specification-only test data. They intentionally do
not include engine, backend, UI, package, or app changes.

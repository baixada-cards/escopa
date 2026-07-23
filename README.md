# Escopa · Baixada

A tactile, local two-player Escopa table from
[Baixada](https://baixada.cards). It includes the game rules, executable
fixtures, deterministic opponent, complete browser application, and responsive
interaction tests in one purposeful repository.

Escopa is independent from Truco. It shares Baixada's walnut, paper, Spanish
card, and brass visual language through an exact signed
[`design-system`](https://github.com/baixada-cards/design-system) revision,
but owns its rules and product behavior here.

## What works

- Spanish and French 40-card deck semantics;
- mandatory captures summing to 15, including multiple capture choices;
- initial-table, scopa, last-captor, redeal, round, category, and match scoring;
- 33 executable fixtures covering valid, invalid, deck-parity, and scoring
  behavior;
- a deterministic local opponent with no account, server, or provider key;
- desktop and touch-sized table layouts with playable-card and capture-choice
  controls;
- procedural card/score cues with no media files or licensing dependency.

The current UI is deliberately a small playable product, not a solver or
online service.

## Develop

Requirements: Node 24.12 and pnpm 10.26.

```sh
sfw pnpm install --frozen-lockfile
make check
pnpm test:e2e
```

The app runs on the usual Next.js development port when started by a person:

```sh
pnpm dev
```

Agents reserve port 3000 for the user's own session; Playwright starts the
production build on port 3002.

## Repository map

- `rules/RULESET.md` — canonical two-player rules.
- `rules/fixtures/` — the `escopa-fixture/v1` executable corpus and schema.
- `src/lib/escopa-engine.ts` — fixture-facing rules implementation.
- `src/lib/escopa-match-controller.ts` — deck, redeal, round, and match flow.
- `src/components/escopa/` — the table and interaction components.
- `app/` — the standalone Next.js entrypoint and Escopa icon.
- `tests/e2e/` — desktop/mobile playability and layout checks.

## Dependency policy

`dependencies.lock.json` and `package.json` pin the same full
`baixada-cards/design-system` commit. The package's Git `prepare` hook builds
its JavaScript/declaration surface; Escopa imports the explicit canonical CSS
export. Moving branches and sibling paths are rejected by `make check`.

The package is private from npm during migration. The repository itself is
public and MIT-licensed.

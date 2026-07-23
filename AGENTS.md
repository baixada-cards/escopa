# Agent Instructions

## Repository purpose

This repository owns Baixada Escopa end to end: the two-player rules engine,
executable fixture contract, deterministic local opponent, interaction state,
table UI, procedural cues, and browser tests.

## Boundaries

- Escopa rules and fixtures live under `rules/`; keep implementation and
  fixture semantics aligned.
- Baixada brand governance, shared tokens, marks, and icon-family rules belong
  to `baixada-cards/design-system`.
- Truco rules, bots, server sessions, solver code, study UI, private policies,
  licensed media, credentials, and deployment inventory do not belong here.
- Do not import source from a sibling checkout or reintroduce Truco's audio
  theme. Cross-repository dependencies use exact immutable commits.

## Workflow

- Use `sfw` for public-registry dependency fetches.
- Preserve the seven-day pnpm release-age gate and frozen lockfile installs.
- Run `make check` before wrapping up a change.
- Run Playwright and inspect desktop/mobile screenshots for visible changes.
- Never start an agent-owned server on port 3000. Browser tests own 3002.
- Shut down any server process you start.
- Sign commits.

## Security and publishing

- Never commit credentials, `.env` files, private cloud identifiers,
  commercial media, live inventories, or generated operational state.
- The npm package is intentionally private during migration.
- Preserve full-SHA Action references, read-only workflow tokens, the exact
  design-system dependency lock, and the public fixture corpus.

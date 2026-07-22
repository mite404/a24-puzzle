# Ralph's Operational Notes

Durable learnings only: measured numbers, non-obvious constraints, corrected
assumptions. Not a diary. Each iteration starts with fresh context, so anything not
written here is lost.

**This file is Ralph's. `AGENTS.md` is the user's — never edit that one.**

## Environment

- Runs in Docker as user `ralph`. Repo is mounted at `/workspace`.
- **bun only.** Never npm or pnpm.
- `node_modules` may be absent on a fresh container — run `bun install` first.
- `pdftotext` (poppler) is installed, for `docs/film-scripts/*.pdf`.
- **No git remote, by design.** Never add one. Never push.
- `.env.local` holds only `OPENROUTER_API_KEY`. The ElevenLabs, Valence, and Mapbox
  keys were deliberately withheld so an unattended loop cannot spend on those APIs.

## Validation baseline (measured at setup, before any Ralph work)

| Command | Result |
|---|---|
| `bun test` | 22 pass, 0 fail, 4 files |
| `bunx tsc --noEmit` | clean |
| `bun run lint` | **12 errors, 4 warnings** — Phase 0 task 1 clears these |

## Measured numbers

Fill these in as they are measured. Later phases depend on them.

- **Placement rate (14-entry bank):** not yet measured — Phase 2.
- **Placement rate (expanded bank):** not yet measured — Phase 3.
- **Ids to request for >= 8 placed words:** not yet derived — Phase 5.

## Known constraints

- `buildCrosswordLayout` (`src/lib/game.ts:44`) silently drops any word the generator
  cannot interlock. This is the central thing the tests exist to pin down.
- `resolveCrosswordEntries` only tops up the entry list when fewer than **4** ids
  resolve. Five valid ids therefore yields a five-word puzzle.
- `validateExperienceProfile` checks that ids *exist*. It does not check how many there
  are, nor reject duplicates.
- The `finalizeExperience` tool description asks for 6-10 ids; the layout is what
  decides how many actually reach the grid. These are different numbers.
- Four films have no bank entries and two of them (`ex-machina`,
  `everything-everywhere`) are excluded from expansion by user decision.

## Corrected assumptions

Record any case where a measurement contradicted something written in the plan or the
specs. The measurement wins; note what changed and why.

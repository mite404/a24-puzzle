# Spec: Split the puzzle builder out of the oracle

## Concern

The oracle currently decides *both* what the user's taste is **and** which crossword
entries express it. It is good at the first job and measurably bad at the second.

This spec moves word selection out of the model and into a pure function.

## Evidence this is the right seam

From the baseline sweep (33 runs) and the re-judge (`evals/REJUDGE-RESULTS.md`):

| What the oracle does | Score |
|---|---|
| Coherent read of the user (c1) | 12/17 pass |
| Clue solvability (c2), difficulty mix (c3) | 33/33 — CEILING |
| Constraint satisfaction over the 68-entry catalog (c7) | **1/17 pass** |

16 of 17 puzzles included films with **no supporting moment anywhere** in the
conversation. 6 included films the user explicitly refused.
This is not a prompting failure; it is a job mismatch. Selection is a constraint problem,
and constraint problems belong in code.

There was always enough material: 3 selected films yield 21-26 bank entries, and a puzzle
needs 8-13. **The padding was never necessary.**

## The contract change

`finalizeExperience` stops emitting words and emits taste:

```ts
{
  selectedFilmIds: string[],   // films they engaged with
  rejectedFilmIds: string[],   // offered and declined — INCLUDING polite declines
  exclusive: boolean,          // "only these" — see below
  moods: string[],
  locationIds: string[],
}
```

`crosswordWordIds` is **removed** from the tool schema.

### rejectedFilmIds

A film belongs here when the oracle offered it (by palette or by name) and the user
declined. Real examples from the sweep transcripts:

- *"I can appreciate the heat of that palette... but it does not scratch the same itch."*
- *"That darkness is a closed fist, not a racing pulse."*
- *"my pulse does not quite spike the same way"*

All three are **polite** rejections: appreciation, then no. The oracle must read
"that's lovely, but no" as a no. Do not attempt to infer this downstream with sentiment
analysis — those phrasings read as positive. The oracle observed it; the oracle records it.

### exclusive

True when the user declares a closed world *without naming what is outside it*:

- *"The Witch is the only world I walk through."*
- *"I don't want other directors or other actors — I only want to think about Howard today."*

This cannot be expressed as a rejection list, because the user never named the eight films
they excluded. `single-film-the-witch run3` failed exactly here: Hereditary was
palette-shown, so it looked justified, but the user had already closed the world.

### Session scope — do not persist

`rejectedFilmIds` and `exclusive` describe a **mood**, not a person. 17 of 33 transcripts
scope taste explicitly to the moment (*"only thinking about this one today"*, *"right now"*).
Persisting them would permanently narrow a user who was having a quiet evening.
They are inputs to one puzzle and are discarded with the conversation.

(What *is* worth persisting later is **seen word ids**, for replay freshness. That is a
fact about history, not taste. Out of scope here.)

## The builder

A pure function. No model, no network, no API route.

```ts
buildPuzzleEntries(taste, bank, opts: { seed, excludeWordIds? }): {
  entries: CrosswordEntry[],
  shortfall: number,       // how many below target, 0 when satisfied
  reachedRung: 1 | 2 | 3,  // how far down the ladder it had to go
}
```

### The ladder

Walk outward only as far as needed. At every rung, `rejectedFilmIds` and
`excludeWordIds` are hard filters.

1. Entries from `selectedFilmIds`.
2. Films sharing a **director** with a selected film.
3. Films sharing a **cast member** (`Film.cast`, added in Phase 3).
4. **Stop.** Return fewer entries rather than unmotivated ones.

**When `exclusive` is true, the ladder stops at rung 1.** No adjacency, ever.

Rung 4 is the whole point. A 9-word puzzle that is entirely *this user's* beats a 13-word
puzzle with four words from nowhere. Never top up from bank order — that is the current
bug, and it is what `resolveCrosswordEntries` and `pickAlternateCrosswordIds` do today.

### Selection within a rung

Ordered by these preferences, deterministic given `seed`:

- Spread across the available films rather than exhausting one.
- Include at least 2 distinct `difficulty` values.
- Prefer longer, vowel-rich answers — they interlock better and raise placement rate.
- Never repeat an answer string, even across different ids.
- Do not place **both halves of a role/actor pair** (e.g. `HARRY` and `PASCAL`), which
  produces mirrored clues. This was the one c4 failure in the sweep.

### Sizing

Measured placement rate on the 68-entry bank: **request ≈ target + 1**, roughly one word
always fails to interlock.

| target placed | request |
|---|---|
| 7 (floor) | 8 |
| 12 (ceiling) | 13 |

- Target range: **7-12 placed words**. This is a ~3-10 minute mini-game, not a broadsheet.
- The oracle never sees these numbers. The builder owns sizing entirely.
- If rung 4 is reached with fewer than 7, return what there is and set `shortfall`.
  A short puzzle is a legitimate outcome for a narrow-taste user; it must be visible,
  never papered over.

### Prerequisite: bank depth

Six of nine films have exactly 7 entries. An `exclusive` single-film user on one of those
requests 7 and places ~6.7 — under the floor.
**Mine every approved film to >= 10 entries** before this ships. That makes any single
film alone support a ~9-word puzzle.

## What this deletes

- `src/app/api/crossword/regenerate/route.ts` — its only job was having an LLM re-pick
  ids. The builder does that instantly, offline, free. This also removes one of the six
  unauthenticated paid endpoints in `IMPROVE.md` SEC-01.
- The `CROSSWORD WORDS` section of `buildCatalog()` in `oracle-prompt.ts` — roughly 500
  tokens off the system prompt of **every** chat turn, and one less thing for the model to
  fixate on while it should be reading the person.
- The top-up branches in `resolveCrosswordEntries` and `pickAlternateCrosswordIds`.

## Replay freshness

`pickAlternateCrosswordIds` becomes a thin call into the builder with the previous puzzle's
ids in `excludeWordIds` and a new `seed`. Deterministic, instant, no network. This is the
original "don't hand me a stale puzzle on replay" requirement, no longer dependent on a
model's goodwill.

## Success criteria

- `bun test` proves, on the real bank: no entry ever comes from a `rejectedFilmId`; with
  `exclusive: true` no entry ever comes from outside `selectedFilmIds`; the same seed
  gives the same puzzle; different seeds give different puzzles; `excludeWordIds` is
  always respected.
- Fuzz: across many seeds and taste shapes, placed words land in 7-12, or `shortfall` is
  set with `reachedRung === 4`.
- Eval: **c7 (justified surprise) becomes 100% by construction.** After this lands it is a
  regression test, not a quality metric — if it ever fails again, the builder has a bug.
- `c6` remains a real judge check: it now measures whether the *oracle* correctly detected
  rejection and exclusivity, which is the job it kept.

## Blast radius

```
schema      types.ts · oracle-tools.ts · validate-experience.ts
selection   game.ts (the builder lives here)
prompt      oracle-prompt.ts · oracle-personas.ts
consumers   experience.tsx · debug-experience.ts
deleted     app/api/crossword/regenerate/route.ts
tests       game.test.ts · validate-experience.test.ts · crossword-fuzz.test.ts
evals       run.ts · run.test.ts · blind.test.ts
```

## Order of work

1. Mine every approved film to >= 10 bank entries (prerequisite).
2. Add `buildPuzzleEntries` with tests, alongside the existing path. Nothing wired yet.
3. Switch `buildGamePayload` to the builder; update `game.test.ts`.
4. Change the tool schema; update prompt, validation, and debug fixtures.
5. Delete the regenerate route and the catalog's crossword section.
6. Update `evals/run.ts` for the new profile shape; re-run the sweep.

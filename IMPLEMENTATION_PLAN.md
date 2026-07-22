# Implementation Plan — Crossword Eval

Seeded from a plan reviewed and approved by the user. The order is deliberate:
backpressure must go green before any real work, tests must land before fixes, and the
measured placement rate gates the final task.

One task per iteration. Top-down.

---

## Phase 0 — Make backpressure green

Nothing below can be validated until `bun run lint` passes, because `PROMPT_build.md`
forbids committing with failing validation.

- [x] Fix the 12 pre-existing lint errors so `bun run lint` exits 0
      (unused vars in `valence.ts`, `tv-screen-map.ts`, `tv-dial-states.ts`,
      `use-oracle-chat.ts`, and two test files; one `import type` violation).
      Delete genuinely dead code rather than prefixing with `_`. Verify the 4 warnings
      that remain are acceptable, and record that decision in `RALPH_NOTES.md`.
      NOTE: the enumerated list above only covered 9 of the 12; the other 3 were
      two `react-hooks/set-state-in-effect` errors (`experience.tsx`,
      `use-debug-voice.ts`) and one unused `PaletteCard` in `palette-card.tsx`.
      All 12 now cleared. See `RALPH_NOTES.md` for how each was fixed.

- [x] Pin `crossword-layout-generator` and `valenceai` to exact versions in
      `package.json` (drop the `^`), then run `bun install` to update the lockfile.
      Pinned to the already-installed versions `0.1.1` and `1.0.6`; `bun install`
      reported "no changes" (resolved graph identical), only the manifest specifiers
      lost their `^`. All four validation commands still pass.

## Phase 1 — Characterization tests, no fixes yet

Write tests that document what the code does **today**. If behaviour looks wrong, still
assert the current behaviour, and add a task to Phase 2 describing the bug. Do not fix
anything in this phase.

- [x] Create `src/lib/game.test.ts` covering `buildGamePayload`: it returns a profile,
      locations, a crossword layout, and `crosswordWords`.
      Four characterization tests: profile returned by identity (`toBe`), each location
      question has 4 options incl. the correct film id, crossword has numeric rows/cols +
      words array, and `crosswordWords` are the resolved bank entries for the requested
      ids. Used a 5-valid-id / 3-valid-location profile so neither top-up path fires.

- [x] Add tests for `resolveCrosswordEntries` behaviour via `buildGamePayload`:
      zero ids, 5 valid ids, unknown ids, duplicate ids. Note the top-up threshold is
      `< 4`, so 5 valid ids yields a 5-word puzzle.
      Five tests in `game.test.ts`: zero ids and all-unknown ids both top up to the
      first 8 bank entries in bank order (`crosswordBank.slice(0, 8)`); 5 valid ids
      return exactly those 5; below-threshold valid+unknown keeps the valid ids, drops
      the unknown, and pads to 8 with no duplicate re-adds; duplicate ids are preserved
      (no dedup) when there are already >= 4 entries. Confirmed: resolve does not
      validate ids and does not dedupe — matches the RALPH_NOTES constraints.

- [x] Add grid integrity tests: every placed word is in bounds (R4), crossing letters
      agree (R5), no duplicate ids (R3), every placed word carries its bank id (R2).
      Four tests in `game.test.ts` over the full 14-entry bank (dense enough to force
      crossings). Generator confirmed deterministic (no `Math.random` in its source), so
      no flakiness. Coord system from the generator README: `startx`=col, `starty`=row,
      both 1-indexed; across increments x, down increments y. R5 also asserts
      `crossings > 0` so the invariant is not vacuously true. R1/R6 are Phase 2, not here.

- [x] Add tests for `pickAlternateCrosswordIds`: respects `excludeIds`, prefers entries
      from `selectedFilmIds`, degrades sanely when the bank is nearly exhausted.
      Six tests in `game.test.ts`. Only randomness is `shuffle`, so assertions hold for
      every shuffle: excluded ids stay out while >= 4 remain; result has no duplicate ids;
      with `count`=5 the whole slice is the 5 uncut-gems (preferred) entries; default
      `count`=8 always contains all 5 preferred; excluding all-but-2 still returns 8 and
      the top-up **reuses excluded ids** (exclude is best-effort, not honoured once < 4
      remain); excluding the entire bank still returns 8 valid ids. See RALPH_NOTES.md.

- [x] Add tests for `rebuildCrosswordPayload`: preserves `locations`, replaces the
      crossword, returns the payload unchanged when `profile` is null.
      Four tests in `game.test.ts`. Null profile short-circuits and returns the *same*
      payload reference (`toBe`), no rebuild attempted. `locations` is carried through by
      reference (spread of `...payload`), never rebuilt. `crossword`/`crosswordWords` are
      replaced with the layout for the new ids (used a 5-valid non-uncut-gems id set so
      the result is clearly distinct and no top-up fires). Profile is a fresh object with
      `crosswordWordIds` overridden and the other three fields preserved; the original
      profile object is not mutated. Phase 1 characterization complete.

## Phase 2 — Measure, then fix

- [x] Add a fuzz test that draws many random id sets from the bank and reports the
      observed **placement rate**. Write the measured number into `RALPH_NOTES.md`.
      This number gates Phase 5.
      `src/lib/crossword-fuzz.test.ts`: a *seeded* (LCG) fuzz — the generator is already
      deterministic, so seeding the id-set draw makes the reported number reproducible and
      the test non-flaky. Draws sets of size 4–14 (>= 4 so no top-up pollutes "requested"),
      64 trials/size. **Overall placement rate 96.4%.** The gating finding for Phase 5 is
      P(>=8 placed): 0% at 8 requested is wrong — it's 64% at 8, 95% at 9, 100% at >= 10.
      So the oracle must request **>= 10 ids** to reliably satisfy spec R1. Full per-size
      table recorded in `RALPH_NOTES.md`. Only invariants (placed <= requested, rate in
      (0,1]) are asserted; R1 is deliberately NOT asserted — measuring its failure is the
      point of this phase.

- [x] Make dropped words observable (spec `crossword-layout.md` R6) — the caller must be
      able to tell that requested words did not make it onto the grid. Failing test first.
      Added `droppedIds: string[]` to `CrosswordLayout` (`types.ts`), populated in
      `buildCrosswordLayout` from the same `layout.result`: placed vs dropped split on one
      `isPlaced` predicate so they stay exhaustive. `droppedIds` holds the bank ids the
      generator returned with `orientation: "none"`; the count is `droppedIds.length`.
      Three tests in `game.test.ts`: (1) `words.length + droppedIds.length ===
      crosswordWords.length` for the full bank (nothing vanishes unaccounted); (2) the
      first 8 bank ids deterministically drop `cw-liminal` (7 placed, 1 dropped); (3) the
      full 14-entry bank drops nothing, so `droppedIds` is `[]`. Failing test committed
      first (field absent → undefined), then the fix.

- [x] Fix any other defect Phase 1 documented. One defect per iteration, each with its
      failing test committed first.
      **Defect fixed: duplicate `crosswordWordIds` violated R3.** Phase 1's
      characterization test (`game.test.ts`, "duplicate ids are preserved, not deduped")
      documented that `resolveCrosswordEntries` kept duplicate ids. Measured consequence:
      a profile requesting the same id twice placed it twice, so two grid words shared one
      id — a direct spec `crossword-layout.md` R3 violation (verified by probe: `has dup
      placed: true`). Nothing validates against duplicates (`validateExperienceProfile`
      only checks existence), so the oracle can trigger this. Fix: `resolveCrosswordEntries`
      now dedupes by id as it resolves, with a single `have` set shared by the top-up loop,
      so neither `crosswordWords` nor the placed layout can carry a duplicate id. Failing
      R3 test (2 assertions) committed first; then the fix + updated the now-stale Phase 1
      characterization test to assert dedup (5 ids w/ one repeat → 4 uniques, no top-up).
      Fuzz placement numbers unchanged (draws are already duplicate-free). All four pass.

## Phase 3 — Expand the bank

See `specs/crossword-bank.md` for the approved film list, the mining method, and the
accuracy rule. `pdftotext` is installed.

- [ ] Add `cast?: string[]` to the `Film` interface in `src/lib/types.ts` and populate it
      for the approved films, omitting `the-backrooms`.

- [ ] Add a bank integrity test: single alphabetic token, length > 1, uppercase, no
      duplicate answers, no duplicate ids, every `filmId` exists in `films.ts`.

- [ ] Mine `moonlight`, `hereditary`, `midsommar` to at least 6 entries each.

- [ ] Mine `lady-bird`, `materialists`, `the-witch` to at least 6 entries each.

- [ ] Bring `good-time`, `uncut-gems`, `the-backrooms` to at least 6 entries each,
      leaving out anything you are not confident is accurate.

- [ ] Re-run the Phase 2 fuzz test against the expanded bank and update the recorded
      placement rate. A larger, longer-word bank should raise it.

## Phase 4 — Eval harness

See `specs/eval-harness.md`. Build the pipeline before spending any API budget.

- [ ] Write `evals/RUBRIC.md` with the five judge checks, before any run exists.

- [ ] Write at least 10 persona sheets in `evals/personas/` covering the required axes.

- [ ] Write `evals/run.ts`: scripted conversation against the real prompt and tools,
      resumable, one JSON per run in `evals/runs/`.

- [ ] Add the deterministic gates from the spec to `run.ts` and record pass/fail per run.
      These need no judge and no extra API spend.

- [ ] Write `evals/blind.ts` — salted hash, `key.json`, judge never sees identity.

- [ ] Write `evals/judge.ts` — scores one blinded puzzle at a time via `claude -p`,
      resumable, absolute scoring only.

- [ ] Write `evals/score.ts` — unblind, aggregate, per-block reporting, with an explicit
      CEILING warning when a block saturates.

- [ ] Do a single smoke sweep: 2 personas x 1 run, to prove the pipeline end to end
      before any full sweep.

## Phase 5 — Close the loop

- [ ] Using the placement rate measured in Phase 2 and re-measured in Phase 3, set the
      number of ids the oracle should request so that >= 8 words reliably land on the
      grid. Update the `crosswordWordIds` description in `src/lib/oracle-tools.ts` and
      the count validation in `src/lib/validate-experience.ts`. State the arithmetic in
      `RALPH_NOTES.md`.

- [ ] Run a full sweep (10 personas x 3 runs), report per-block results, and write the
      findings to `evals/RESULTS.md`.

- [ ] Update `docs/FOR_ETHAN.md` per `AGENTS.md`: the story of this work, the bugs found
      with their root causes, and what the eval numbers actually mean.

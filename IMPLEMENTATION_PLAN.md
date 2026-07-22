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

- [ ] Create `src/lib/game.test.ts` covering `buildGamePayload`: it returns a profile,
      locations, a crossword layout, and `crosswordWords`.

- [ ] Add tests for `resolveCrosswordEntries` behaviour via `buildGamePayload`:
      zero ids, 5 valid ids, unknown ids, duplicate ids. Note the top-up threshold is
      `< 4`, so 5 valid ids yields a 5-word puzzle.

- [ ] Add grid integrity tests: every placed word is in bounds (R4), crossing letters
      agree (R5), no duplicate ids (R3), every placed word carries its bank id (R2).

- [ ] Add tests for `pickAlternateCrosswordIds`: respects `excludeIds`, prefers entries
      from `selectedFilmIds`, degrades sanely when the bank is nearly exhausted.

- [ ] Add tests for `rebuildCrosswordPayload`: preserves `locations`, replaces the
      crossword, returns the payload unchanged when `profile` is null.

## Phase 2 — Measure, then fix

- [ ] Add a fuzz test that draws many random id sets from the bank and reports the
      observed **placement rate**. Write the measured number into `RALPH_NOTES.md`.
      This number gates Phase 5.

- [ ] Make dropped words observable (spec `crossword-layout.md` R6) — the caller must be
      able to tell that requested words did not make it onto the grid. Failing test first.

- [ ] Fix any other defect Phase 1 documented. One defect per iteration, each with its
      failing test committed first.

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

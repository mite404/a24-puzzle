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

- [x] Add `cast?: string[]` to the `Film` interface in `src/lib/types.ts` and populate it
      for the approved films, omitting `the-backrooms`.
      Added the optional field (documented against R8) and populated principal cast for
      all 8 approved films: uncut-gems (6), good-time (6), moonlight (8), hereditary (5),
      midsommar (5), the-witch (4), lady-bird (6), materialists (3). `the-backrooms` left
      with no `cast` (no named ensemble, per spec). `ex-machina` / `everything-everywhere`
      are not approved films, so they keep no cast. Only well-established leads/principals
      included per the accuracy rule; walk-ons left out. All four validations pass.

- [x] Add a bank integrity test: single alphabetic token, length > 1, uppercase, no
      duplicate answers, no duplicate ids, every `filmId` exists in `films.ts`.
      New file `src/data/crosswordBank.test.ts`, 4 tests: R3 (`/^[A-Z]+$/` + length > 1),
      R4 no dup answers, R4 no dup ids, and every `filmId` in the `films.ts` id set. All
      pass on the current 14-entry bank. R1 (~70 entries) and R2 (>= 6 per approved film)
      are deliberately NOT asserted yet — the bank is still being mined; those land after
      the mining tasks below. These integrity checks must hold on every entry ever added.

- [x] Mine `moonlight`, `hereditary`, `midsommar` to at least 6 entries each.
      Each now has 7 (the seed entry + 6 new): moonlight (JUAN/KEVIN/PAULA/TERESA/BLACK/
      LITTLE), hereditary (ANNIE/PETER/CHARLIE/STEVE/JOAN/MINIATURES), midsommar (DANI/
      CHRISTIAN/PELLE/SWEDEN/HARGA/SOLSTICE). Character names/prominence confirmed against
      the shooting-script frequency counts (mining method in the spec); actors/setting from
      general knowledge, only facts I'm confident of. Difficulty per R7: leads easy, deep
      cuts hard. Collateral fix: the Phase 2 fuzz test swept sizes 4..bank-length, which
      timed out once the bank passed 30 entries — capped the sweep at 16 (the Phase-5
      region, where P(>=8) already saturates). See RALPH_NOTES. Bank integrity test
      (crosswordBank.test.ts) validates the new entries; all four validations pass.

- [x] Mine `lady-bird`, `materialists`, `the-witch` to at least 6 entries each.
      lady-bird +7 (SACRAMENTO/MARION/CHRISTINE/JULIE/KYLE/DANNY/RONAN), materialists +7
      (LUCY/MATCHMAKER/HARRY/JOHN/PASCAL/JOHNSON/SONG), the-witch +7 (THOMASIN/WILLIAM/
      KATHERINE/CALEB/PHILLIP/MERCY/JONAS) on top of the existing EGGERS = 8. Character
      names/prominence taken from the shooting-script ALL-CAPS frequency counts (mining
      method in the spec); actors/roles only where I'm confident (Materialists role→actor
      mapping: Johnson=Lucy, Pascal=Harry, Evans=John). Bank now 53 entries. Collateral:
      the full-bank-natural-order "droppedIds is empty" test went red — the 53-entry bank
      drops cw-matchmaker (MATCHMAKER, 10 letters) in natural order. Repointed that test at
      crosswordBank.slice(0,14) (measured to place fully), per the RALPH_NOTES guidance not
      to weaken it. All four validations pass.

- [x] Bring `good-time`, `uncut-gems`, `the-backrooms` to at least 6 entries each,
      leaving out anything you are not confident is accurate.
      uncut-gems 5 -> 10 (+JULIA/ARNO/DEMANY/DINAH/CELTICS), good-time 2 -> 8
      (+NICK/PATTINSON/COREY/CRYSTAL/RAY/NIKAS), the-backrooms 3 -> 7 motifs only
      (+FLUORESCENT/YELLOW/FOOTAGE/ENTITY, no cast per spec). Bank now **68 entries**.
      Cast names cross-checked against `films.ts` `cast`; only confident facts included
      (e.g. the-backrooms has no named ensemble, so all four new entries are motifs from
      the canonical 4chan description + Kane Parsons series lore). Collateral: the
      `pickAlternateCrosswordIds` "preferred entries land first" test hard-coded "5
      uncut-gems entries"; with 10 preferred vs default count 8 they no longer all fit.
      Rewrote it to derive from `uncutGemsIds.length` (preferred >= count => every slot
      preferred), preserving intent without weakening. See RALPH_NOTES.md.

- [x] Re-run the Phase 2 fuzz test against the expanded bank and update the recorded
      placement rate. A larger, longer-word bank should raise it.
      Ran `crossword-fuzz.test.ts` against the final **68-entry** bank (seed 0x51ac, 64
      trials/size, sizes 4–16). **Overall placement rate 97.4%** (8100/8320) — up from the
      original 14-entry bank's 96.4%, as predicted. P(>=8 placed): 70% at 8, 92% at 9,
      **100% at >= 10**. The Phase-5 conclusion is unchanged: request **>= 10 ids** for a
      reliable >= 8 placed. Full per-size table and the size-progression note (14 → 53 → 68)
      are in `RALPH_NOTES.md`. Note the expansion raised the *headline* rate but did not
      lift P(>=8) at borderline sizes 8–9 — that metric is noisier than the mean rate.

## Phase 4 — Eval harness

See `specs/eval-harness.md`. Build the pipeline before spending any API budget.

- [x] Write `evals/RUBRIC.md` with the five judge checks, before any run exists.
      Authored `evals/RUBRIC.md` from the spec's judge checklist: c1 on-topic, c2 solvable,
      c3 mixed difficulty, c4 no near-duplicates, c5 factually-correct (flagged NEVER DROP).
      Each check is binary (pass/false + one-line rationale), scored absolute/one-puzzle-at-a-
      time. Documented what the judge sees (transcript, words, clues, ASCII grid) vs never sees
      (persona, arm, run index), the JSON output shape judge.ts emits, and the per-block +
      CEILING reporting rule that score.ts must honour. No code touched; all four validations
      still pass (55 tests).

- [x] Write at least 10 persona sheets in `evals/personas/` covering the required axes.
      **11 sheets** written, all 8 required axes covered (some axis has two readings so the
      sweep is not a single sample of it): single-film (`single-film-uncut-gems`,
      `single-film-the-witch`), director (`director-ari-aster` = Hereditary+Midsommar,
      `director-safdie` = Uncut Gems+Good Time), actor (`actor-pattinson`, `actor-collette`),
      mood-led (`mood-led-no-film`), undecided (`undecided-contradicts`), adversarial
      (`adversarial-off-topic`), terse (`terse-one-word`), effusive (`effusive-overlong`).
      Each is Markdown + YAML frontmatter (`id`, `axis`, `anchor_films`, `offcatalog_mentions`,
      `style`, `turn_cap`, `expects_finalize`) — the frontmatter is the structured contract
      `run.ts` will parse, the body is the scripted-user system prompt. `evals/personas/README.md`
      documents the format and the axis→sheet coverage matrix. Constraint discovered and
      recorded in RALPH_NOTES: **no actor is in two catalog films' `cast`**, so the "multi-film,
      one actor" axis is realised as one-actor / one-catalog-film with off-catalog films as
      explicit c5 traps. All film facts in the sheets are well-established (no invented details,
      per the honesty rule — an inaccurate persona would poison the c5 judge). No source code
      touched; all four validations still pass (55 tests, tsc clean, 0 lint errors).

- [x] Write `evals/run.ts`: scripted conversation against the real prompt and tools,
      resumable, one JSON per run in `evals/runs/`.
      `run.ts` drives an ORACLE (real `buildSystemPrompt()` + real `oracleTools`,
      `stopWhen: stepCountIs(1)` — the same one-step-per-turn cadence as `/api/chat`)
      against a scripted USER model that role-plays a persona sheet. The persona's
      `## Opening message` is user turn 1 verbatim; the loop alternates until the oracle
      calls `finalizeExperience` or `turn_cap` trips (a failure). On finalize it builds the
      grid via `buildGamePayload` and records `crossword` + `crosswordWords` for the
      downstream gates/judge. One JSON per cell in `evals/runs/`, named
      `<persona>__<arm>__run<n>.json`; resumable via `cellIsDone` (skip any parseable
      existing file). Model wiring lives behind `makeOracleStep`/`makeUserStep`; the pure
      persona parser + conversation state machine are unit-tested in `evals/run.test.ts`
      (15 tests, **no API spend** — CLI runs only under `import.meta.main`). All four
      validations pass (70 tests). No sweep was run — that needs OpenRouter budget and is a
      later task.

- [x] Add the deterministic gates from the spec to `run.ts` and record pass/fail per run.
      These need no judge and no extra API spend.
      Pure `evaluateGates(GateInput) -> GateReport` in `run.ts`, one `GateOutcome`
      ({pass, detail}) per spec gate: finalize-called, all returned ids in bank, >= 8 words
      placed, 0 duplicate placed ids, >= 60% of placed words from `selectedFilmIds`, >= 2
      distinct difficulty levels. Grid fill density (distinct occupied cells / rows*cols) is
      *recorded only* — no threshold, per the spec. `report.passed` is the AND of the six
      gated checks; density never affects it. Wired into `RunRecord.gates` (both success and
      error paths, so a crashed cell still carries a fully-failing report) and surfaced in the
      sweep console via `describeGateFailures`. Failure shapes handled without throwing: null
      profile / null crossword fail the affected gates and leave density null. 9 new tests in
      `run.test.ts` (24 total in file, 79 total): happy path passes all six, plus one
      targeted failure per gate (synthetic inputs from real uncut-gems bank entries) and one
      integration check against a real `buildGamePayload` grid. No API spend — all pure.

- [x] Write `evals/blind.ts` — salted hash, `key.json`, judge never sees identity.
      Stage 2: `runs/*.json` -> `blind/<blindId>.json` + `blind/key.json`. `blindId` is a
      salted SHA-256 of the run's identity (its filename), first 12 hex chars — deterministic
      given the salt (so re-blinding is idempotent/resumable) but non-reversible without it.
      The salt is minted once and persisted in `key.json`; `loadOrCreateSalt` reuses it on
      re-run so ids stay stable. The blinded record carries ONLY what RUBRIC.md lets the judge
      see: transcript, the placed word set, numbered clues, ASCII grid. It deliberately drops
      persona/axis/arm/runIndex AND each word's `filmId`+`difficulty` (that would hand over the
      c1/c3/c5 ground truth). Blinded files are named by hash, so even the directory listing
      order leaks no identity. `key.json` holds the real mapping and is never opened by the
      judge. Pure helpers (`computeBlindId`, `renderAsciiGrid`, `blindClues`, `buildBlindRecord`,
      `planBlinding`) are exported and tested; FS/CLI run only under `import.meta.main` (no
      spend). 19 tests in `blind.test.ts` incl. a serialised-record leak scan and a collision
      guard. All four validations pass (98 tests).

- [x] Write `evals/judge.ts` — scores one blinded puzzle at a time via `claude -p`,
      resumable, absolute scoring only.
      Stage 3: `blind/<id>.json` -> `scores/<id>.json`. Pure core: `buildJudgePrompt`
      inlines RUBRIC.md verbatim + the four judge-visible fields (transcript, placed words,
      numbered clues, ASCII grid) and pins the output to one JSON object; `extractJson`
      recovers the object from a ```json fence or surrounding prose (throws if none, so a
      garbled reply fails loudly not silently-all-false); `parseJudgeResponse` validates the
      five checks (c1..c5), requires a real boolean `pass` per check, defaults a missing
      `why`, and — critically — takes `blindId` from the caller, never the model's echo, so
      a stray echo can't mislabel a score. Judge backend (`JudgeFn`) is injected so tests
      feed canned JSON; the real `claude -p` call (prompt on stdin to dodge argv limits,
      non-zero exit -> throw so the cell stays unscored + retriable) and all FS/CLI run only
      under `import.meta.main`. `loadBlindRecords` skips `key.json` explicitly (never opened);
      `scoreIsDone` gives resumability. 19 tests in `judge.test.ts`, no CLI spend. All four
      validations pass (117 tests, tsc clean, 0 lint errors).

- [x] Write `evals/score.ts` — unblind, aggregate, per-block reporting, with an explicit
      CEILING warning when a block saturates.
      Stage 4: `scores/*.json` + `blind/key.json` -> printed report. This is the one stage
      allowed to read `key.json` (the unblinding step). Pure core: `joinScores` restores
      identity by matching each verdict's `blindId` to its key entry — a score with no key
      entry lands in `unmatchedScores` and a key entry with no score in `unjudged`, so
      coverage is stated honestly, never silently dropped. `aggregateChecks` emits one
      `CheckReport` per rubric check (the "block"), each with a per-ARM pass rate — never a
      single combined headline, per RUBRIC's reporting rule. `ceiling` is set when every arm
      with runs passed the check on every run (saturated => non-discriminating), and
      `formatReport` prints the mandated `CEILING` line for it. c5 (never-drop) additionally
      gets an unblinded audit list of every failure for human spot-checking. FS/CLI run only
      under `import.meta.main` (no spend). 18 tests in `score.test.ts` (135 total). All four
      validations pass.

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

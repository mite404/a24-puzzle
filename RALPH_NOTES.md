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
| `bun run lint` | ~~12 errors, 4 warnings~~ → **0 errors, 4 warnings** after Phase 0 task 1 |

## Measured numbers

Fill these in as they are measured. Later phases depend on them.

- **Placement rate (14-entry bank):** **96.4%** overall (placed/requested), measured by
  `src/lib/crossword-fuzz.test.ts` (seeded fuzz, 64 trials/size, sizes 4–14). Per-size
  breakdown below. The key gate for Phase 5 is not the headline rate but **P(>=8 placed)**:

  | ids requested | mean placed | rate | P(>=8 placed) |
  |---|---|---|---|
  | 4 | 3.70 | 92.6% | 0% |
  | 5 | 4.72 | 94.4% | 0% |
  | 6 | 5.69 | 94.8% | 0% |
  | 7 | 6.63 | 94.6% | 0% |
  | 8 | 7.55 | 94.3% | **64%** |
  | 9 | 8.52 | 94.6% | **95%** |
  | 10 | 9.72 | 97.2% | **100%** |
  | 11 | 10.70 | 97.3% | 100% |
  | 12 | 11.77 | 98.0% | 100% |
  | 13 | 12.69 | 97.6% | 100% |
  | 14 | 13.75 | 98.2% | 100% |

  Reading for Phase 5: to reliably land **>= 8** words (spec R1), the oracle must request
  **>= 10 ids** — at 8 requested only 64% of grids reach 8 placed, at 9 it is 95%, at 10
  it is 100% across this seed. At 14 (whole bank) ~13.75 of 14 place, so ~1 word still
  drops even at max. This is the number Phase 5's `crosswordWordIds` count is derived from.
  NOTE: this is the *current 14-entry* bank; Phase 3 expands the bank and Phase 2 task says
  to re-measure — a larger/longer-word bank should raise the rate and lower the id count.
- **Placement rate (expanded bank, FINAL — 68 entries):** Phase 3 mining complete, bank
  is **68 entries**. Fuzz (seed 0x51ac, 64 trials/size, sizes 4–16) reports **97.4%
  overall** (8100/8320). Per-size P(>=8 placed): **70% at size 8, 92% at 9, 100% at >= 10**.

  | ids requested | mean placed | rate | P(>=8 placed) |
  |---|---|---|---|
  | 4 | 3.78 | 94.5% | 0% |
  | 5 | 4.69 | 93.8% | 0% |
  | 6 | 5.72 | 95.3% | 0% |
  | 7 | 6.70 | 95.8% | 0% |
  | 8 | 7.61 | 95.1% | **70%** |
  | 9 | 8.55 | 95.0% | **92%** |
  | 10 | 9.78 | 97.8% | **100%** |
  | 11 | 10.81 | 98.3% | 100% |
  | 12 | 11.77 | 98.0% | 100% |
  | 13 | 12.75 | 98.1% | 100% |
  | 14 | 13.78 | 98.4% | 100% |
  | 15 | 14.78 | 98.5% | 100% |
  | 16 | 15.84 | 99.0% | 100% |

  **Progression across bank sizes** (headline overall rate / P(>=8) at size 8):
  14-entry → 96.4% / 64%; 53-entry (partial) → 97.7% / 88%; **68-entry (final) → 97.4% /
  70%**. The overall rate did rise vs the original 14-entry bank (96.4% → 97.4%) as
  predicted, but note the expansion did **not** raise P(>=8 placed) at the borderline
  sizes 8–9 — it is noisier than the headline rate (70%/92% here vs 88%/88% at 53). The
  robust conclusion is unchanged and is the number Phase 5 uses: **request >= 10 ids** to
  reliably (100% across this seed) land >= 8 words. At 9 ids it is 92%, at 8 only 70% —
  neither reliable. This supersedes the 14-entry and 53-entry readings above.
- **Fuzz sweep is now capped at maxSize 16**, not the whole bank. The generator cost grows
  superlinearly with word count; sweeping all 32 entries took ~110s and timed out the 20s
  bound (and would only get worse toward ~70). Sizes 4–16 cover the entire Phase-5 decision
  region (P(>=8) saturates to 100% by size 10), so nothing the gate needs was lost. Only
  invariants are asserted, so the cap does not weaken any assertion. The headline-rate
  re-measure against the final bank is the dedicated last Phase 3 task.
- **Ids to request for >= 8 placed words:** not yet derived (formalised in Phase 5). The
  final 68-entry re-measure confirms **>= 10** for a reliable (100% at this seed) >= 8
  placed; 9 → 92%, 8 → 70%.

## Known constraints

- `game.test.ts` "droppedIds is empty when every requested word is placed" used to assert
  the **full bank in natural (array) order places every entry** (held at 14 and 32). At
  **53 entries the full bank in natural order drops one word: `cw-matchmaker` (MATCHMAKER,
  10 letters) — 52 placed, 1 dropped.** As foreseen, this turned the test red. Not weakened:
  the test was repointed at `crosswordBank.slice(0, 14)` (the original 14 entries, measured
  to still place all 14, `droppedIds: []`), preserving the "empty when all placed" intent.
  The separate R6 "every requested word accounted for" test still uses the full bank and
  passes (52 + 1 === 53). If the first 14 ever stop placing fully, repoint again to another
  measured-full set and record it here.

- **Bank is now 68 entries** (Phase 3 mining complete): good-time 8, uncut-gems 10,
  the-backrooms 7 (motifs only — spec forbids cast for it), on top of the six scripted
  films at 6-8 each. R2 (>= 6 per approved film) is now satisfied for all 8 approved films.
- **`pickAlternateCrosswordIds` preference test is coupled to `selectedFilmIds` entry
  count.** `baseProfile.selectedFilmIds` is `["uncut-gems"]`. The "preferred entries land
  first" test used to assume 5 uncut-gems entries all fit in the default count of 8. After
  mining, uncut-gems has 10 entries — more than the count — so not all can appear. The test
  now branches on `uncutGemsIds.length` vs `DEFAULT_COUNT` (8): when preferred >= count,
  assert *every picked slot is preferred*; else assert every preferred id appears. If a
  future change makes uncut-gems the requested film with < 8 entries again, the else-branch
  covers it. Not a code bug — the code prioritises preferred correctly; the test's constant
  went stale with the data.

- `buildCrosswordLayout` (`src/lib/game.ts`) used to silently drop any word the generator
  could not interlock. **Fixed (Phase 2, R6):** `CrosswordLayout` now carries
  `droppedIds: string[]` — the bank ids the generator returned with `orientation: "none"`.
  Placed vs dropped are split on one `isPlaced` predicate over `layout.result`, so they
  are exhaustive (`words.length + droppedIds.length === entries.length` for that call).
  Number of dropped words = `droppedIds.length`.
- Placement is **input-order dependent**, not just count dependent: the full 14-entry bank
  places all 14, but `crosswordBank.slice(0, 8)` deterministically drops `cw-liminal`
  (LIMINAL) — 7 placed. So a smaller set can drop while the whole bank does not. This is
  why the fuzz per-size mean placed (e.g. 7.55 at 8) is below the count.
- `resolveCrosswordEntries` only tops up the entry list when fewer than **4** ids
  resolve. Five valid ids therefore yields a five-word puzzle.
- `resolveCrosswordEntries` **dedupes by id** (Phase 2 R3 fix). It used to preserve
  duplicate ids, which placed the same word twice → two grid words sharing one id, a spec
  R3 violation. Dedup is counted *before* the top-up threshold: e.g. 5 ids with one repeat
  = 4 uniques (no top-up); 4 ids with one repeat = 3 uniques (**top-up fires**, pads to 8).
  The `have` set is shared with the top-up loop so it can't re-introduce a duplicate.
- `validateExperienceProfile` checks that ids *exist*. It does not check how many there
  are, nor reject duplicates — so duplicate-id input can reach `buildGamePayload`. That is
  why the dedup lives in `resolveCrosswordEntries` (defence at the layout boundary), not in
  validation.
- The `finalizeExperience` tool description asks for 6-10 ids; the layout is what
  decides how many actually reach the grid. These are different numbers.
- Four films have no bank entries and two of them (`ex-machina`,
  `everything-everywhere`) are excluded from expansion by user decision.
- `crossword-layout-generator` is **deterministic** — no `Math.random` in its source, so
  the same id set always yields the same grid. Grid-integrity/fuzz tests need no seeding
  and are not flaky. The only randomness in `game.ts` is `shuffle`, used for location
  distractors, never for the crossword.
- `pickAlternateCrosswordIds` (`game.ts:120`) honours `excludeIds` only while at least
  **4** non-excluded entries survive. Below that, the top-up loop refills to `count` from
  the *whole* bank and does **not** re-check `excludeIds`, so excluded ids can reappear.
  Exclusion is best-effort, not a guarantee. Preferred entries (filmId in
  `selectedFilmIds`) sort ahead of the rest, so they always occupy the first `count`
  slots. Result is always de-duplicated by the top-up's `!picked.includes` check.
- Placed-word coords (from the generator README): `startx` = column, `starty` = row, both
  **1-indexed**. `orientation: "across"` increments the column per letter; `"down"`
  increments the row. Letter *k* of a word sits at `(x = startx + (across?k:0), y = starty
  + (down?k:0))`. Used by the R4/R5 grid tests and needed again for the Phase 2 fuzz test.

## Phase 0 task 1 — the 12 lint errors (done)

The plan's prose enumerated only 9 of the 12 errors. `bun run lint` is authoritative;
there were exactly 12. How each was fixed (all by deleting dead code except the two
`set-state-in-effect` cases, which needed real refactors):

- `valence.ts` — deleted unused `VALENCE_DEFAULT_EMOTIONS` / `VALENCE_EXTENDED_EMOTIONS`
  (the API is called with the `"4emotions"` model string, not these arrays).
- `tv-screen-map.ts` — deleted unused `const TV_SCREEN_MAP` alias.
- `tv-dial-states.ts` — deleted unused `import type { TvDialState }`. The type itself
  is still exported and used by `tv-volume-dial`, `oracle-tv-scene`, `oracle-personas`.
- `use-oracle-chat.ts` — deleted unused `ORACLE_OPENING_LINE`; the live value is the
  per-persona `openingLine` computed at the bottom of the hook.
- `crossword-oracle-quip-fetch.test.ts` — `URL` is used only as a type → `import type`;
  deleted unused `import { error } from "node:console"`.
- `crossword-oracle-quips.test.ts` — the "random 0.9 → C" test was an empty stub with
  two unused vars. Completed it: `pickQuip` takes an injectable `random`, so
  `floor(0.9 * 3) = 2` → `"C"`. Better than deleting a test that documents real behaviour.
- `palette-card.tsx` — deleted unused `PaletteCard` (default variant). Only
  `CrtPaletteCard` is imported anywhere. NOTE: the `variant === "default"` branch in
  `PaletteCardBase` is now unreachable dead code; left in place to keep this task minimal,
  a candidate for later cleanup.
- `use-debug-voice.ts` — **refactor.** The voice-off flag is a localStorage value that
  changes via a window event → an external store. Replaced the `useState` +
  `setState`-in-effect with `useSyncExternalStore(subscribe, getSnapshot, () => false)`.
  `writeDebugVoiceOff` already dispatches `DEBUG_VOICE_CHANGE_EVENT`, so toggling just
  writes and the subscription re-renders. SSR-safe via the server snapshot.
- `experience.tsx` — the debug-URL jump reads `window.location.search` once on mount
  (an external, client-only source) and seeds mutable state. It *must* run post-hydration,
  so a lazy `useState` initializer is not an option (would crash on the server / mismatch
  on hydrate). Kept the effect but deferred the jump with `queueMicrotask(...)` so the
  `setState` is no longer synchronous inside the effect body — which is what
  `react-hooks/set-state-in-effect` flags. Behaviour is unchanged (jump applies right
  after the initial commit).

### The 4 remaining warnings are acceptable

All four are `react-hooks/exhaustive-deps` in `oracle-tv-scene.tsx` (lines 50, 58, 71, 84).
Each memoized callback / effect deliberately depends on specific hook *methods*
(`chat.submit`, `chat.handleSubmit`, `voice.cancelSpeech`, `voice.consumePendingReplies`)
rather than the whole `chat` / `voice` object, whose identity changes every render.
They are warnings, not errors, so `bun run lint` still exits 0 — the backpressure gate is
green. Left unchanged: fixing them risks altering the intake voice/chat flow, which I
cannot fully E2E here because the ElevenLabs/Valence keys are withheld. (Aside: some of
those methods — e.g. `chat.submit` — are plain functions in `use-oracle-chat`, not
memoized, so the memoization they feed is weaker than it looks. Potential future cleanup,
out of scope for Phase 0.)

## Phase 4 — eval persona sheets (done)

- **No actor appears in two catalog films' `cast`.** Verified against `src/data/films.ts`
  (uncut-gems, good-time, moonlight, hereditary, midsommar, the-witch, lady-bird,
  materialists — the eight with cast). Every cast list is disjoint. So the spec's
  "multi-film, one actor" axis **cannot** be a single actor spanning two catalog films.
  Realised instead as: one actor → their one catalog film, with the actor's *other* films
  listed in `offcatalog_mentions` as explicit c5 traps (the oracle must not fabricate the
  actor into another catalog film). `actor-pattinson` (Good Time) and `actor-collette`
  (Hereditary) both do this. If films.ts ever gains a cross-film actor, a genuinely
  multi-film actor sheet becomes possible.
- **Persona sheet contract** (defined here, consumed by the not-yet-written `run.ts`):
  Markdown + YAML frontmatter. Frontmatter fields = `id`, `axis`, `anchor_films` (catalog
  ids the persona genuinely engages — ground truth for c1 and the selectedFilmIds gate),
  `offcatalog_mentions` (c5 traps), `style`, `turn_cap` (over it = run failure),
  `expects_finalize` (true for all 11, adversarial included). Body = the scripted-user
  system prompt, six fixed headings. `evals/personas/README.md` holds the schema + axis
  coverage matrix. `run.ts` should parse frontmatter and pass the body verbatim to the
  scripted-user model.
- `anchor_films` is empty **on purpose** for `mood-led-no-film`: that persona names no film,
  so c1's ground truth is whichever palette the oracle shows that the user warms to —
  determined at run time, not fixed in the sheet.

## Phase 4 — eval `run.ts` (done)

- **`run.ts` is split pure-vs-impure so it is testable with zero API spend.** The persona
  parser (`parsePersonaSheet`, `extractSection`) and the conversation state machine
  (`driveConversation`, injectable `oracleStep`/`userStep`) are pure and exported;
  `evals/run.test.ts` (15 tests) drives them with fakes. The real model wiring
  (`makeOracleStep`/`makeUserStep` via `@ai-sdk/openai` → OpenRouter) and the sweep loop
  run **only under `import.meta.main`**, so importing the module in a test never calls the
  API. Do not move logic that needs testing into the model-backed factories.
- **Oracle cadence mirrors `/api/chat`:** `generateText({ tools: oracleTools, stopWhen:
  stepCountIs(1) })` — one step per turn. Read tool calls off `result.toolCalls`;
  `call.input` is `unknown` under the `TypedToolCall` union once you compare `toolName` to
  a literal (the `DynamicToolCall` member keeps `toolName: string`), so cast via
  `as unknown as <Input>`. `finalizeExperience` input's `selectedFilmIds` is `string[]` and
  must be cast to `FilmId[]` for `ExperienceProfile`.
- **The persona `## Opening message` is user turn 1, verbatim** — it is NOT produced by the
  user model. The scripted user only generates turns 2..N. `makeUserStep` seeds the user
  model's history with the opening message as an `assistant` message so it has continuity.
  From the user model's side the roles are swapped: oracle turns are `user`, the persona's
  own turns are `assistant`.
- **Resumability contract:** one file per cell, `<persona>__<arm>__run<n>.json` in
  `evals/runs/`. `cellIsDone` skips any file that exists and JSON-parses. `arm` defaults to
  `"baseline"` (the spec's blind stage distinguishes arms; only one arm exists so far).
  CLI flags: `--runs=N` (default 3), `--arm=NAME`, `--only=id1,id2`.
- **`run.ts` records `crossword` + `crosswordWords` from `buildGamePayload(profile)`**, not
  just the finalize input — the deterministic gates (next task) need the *placed* grid, and
  `buildGamePayload` is where top-up/resolve/layout actually happen. Note `buildGamePayload`
  uses `Math.random` for **location** distractors only; the crossword layout is
  deterministic (see the generator note above), so re-running a cell reproduces the grid.
- The run record does **not** yet compute gate pass/fail or a judge score — that is the
  next two tasks. `run.ts` is deliberately just the generator stage.

## Phase 4 — deterministic gates in `run.ts` (done)

- **Which data each spec gate reads matters.** The "all returned ids exist in the bank"
  gate checks `profile.crosswordWordIds` — the ids the *oracle returned* in finalize — not
  the placed words (placed words always carry real bank ids, so checking them is vacuous;
  the point is to catch the oracle hallucinating a bank id). The other four content gates
  (>= 8 placed, 0 duplicate ids, >= 60% from `selectedFilmIds`, >= 2 difficulty levels) read
  the **placed grid words** (`crossword.words`), because a word only counts once it actually
  interlocks. filmId/difficulty per placed id come from the run's `crosswordWords` (the
  resolved entries), mapped by id.
- **Grid fill density is recorded, not gated** (spec says "no gate yet"). Computed as
  distinct occupied cells / (rows*cols); crossings counted once via a `${x},${y}` Set.
  `report.passed` is the AND of the *six* gated checks only — density is excluded so it can
  never flip a pass/fail. Null crossword => density null.
- `evaluateGates` is **pure and total** — no throw on the failure shapes. Null profile / no
  finalize / null crossword each just fail the affected gates. So the error path in `runCell`
  can call it with all-null and get a coherent fully-failing report; every `RunRecord` carries
  a `gates` field, even a crashed cell.
- **Lint bans non-null assertions (`!`)** (`@typescript-eslint/no-non-null-assertion` is an
  *error*, not a warning). In tests, narrow with a `must(v)` helper or cast `as number` after
  a `typeof` check — never `value!`. Caught 6 lint errors on first pass; baseline is 0 errors.

## Phase 4 — eval `blind.ts` (done)

- **Blinding is by run *filename*, not a content hash.** `computeBlindId(salt, identity)`
  hashes `runFileName(persona, arm, runIndex)` (the cell's unique identity) with a salt,
  SHA-256, first 12 hex chars. Deterministic given the salt → re-running `blind.ts` is
  idempotent and resumable; the blinded file is skipped if it already exists but `key.json`
  is always rebuilt from the current `runs/` set.
- **The salt is persisted in `key.json` and reused** (`loadOrCreateSalt`). If it were
  re-minted each run, every blindId would churn and the judge's `scores/*` (keyed by blindId)
  would stop matching. Mint once, reuse forever. `randomBytes(16)` → 32-hex-char salt.
- **What the blinded record excludes is the whole point.** It carries transcript + placed
  words + numbered clues + ASCII grid, and NOTHING else. Dropped on purpose: persona/axis/
  arm/runIndex (identity) AND per-word `filmId` + `difficulty`. filmId/difficulty are the
  c1/c3/c5 ground truth — handing them to the judge would let it pass those checks without
  actually reading the clues. `blind.test.ts` scans the serialised record to prove none of
  those strings leak.
- **Blinded files are named `<blindId>.json`**, so `readdirSync` order is hash order, not
  identity order — the directory listing itself can't leak which persona came first. Verified
  in a round-trip test.
- **`planBlinding` throws on a blindId collision** (defensive: distinct filenames should never
  collide, but a silent collision would drop a cell from the report). Grid render uses the
  generator coord convention (startx=col, starty=row, 1-indexed); crossing cells overwrite
  deterministically to the same letter in a valid puzzle.

## Phase 4 — eval `judge.ts` (done)

- **The judge's `blindId` is the caller's, never the model's echo.** `parseJudgeResponse`
  sets `blindId` from the argument we pass (the id of the puzzle we handed the judge) and
  ignores the `blindId` the model writes into its JSON. The judge only ever knows one
  puzzle's id, so trusting our own value means a hallucinated/copy-pasted echo can't attach
  a verdict to the wrong puzzle when `score.ts` unblinds.
- **A garbled judge reply throws; it is NOT scored all-false.** `extractJson` recovers the
  object from a ```json fence or from surrounding prose, but throws if there is no `{...}`
  at all, and `parseJudgeResponse` throws if any of c1..c5 is missing or `pass` isn't a
  boolean. The CLI catches per-cell and leaves that `scores/<id>.json` unwritten, so a
  failed judging is retriable on the next run — never silently recorded as five fails. This
  matters because "all false" and "couldn't parse" are different states and conflating them
  would poison the c5 rate (the never-drop check).
- **`why` is soft, `pass` is hard.** A missing rationale defaults to `(no rationale given)`
  rather than throwing — the machine-readable verdict is what `score.ts` aggregates; the
  rationale is only for human audit, so a judge that omits it still yields a usable score.
- **`claude -p` gets the prompt on stdin, not argv.** RUBRIC.md + a full transcript easily
  exceeds a safe argv length, so `claudeJudge` pipes the prompt via `Bun.spawn` stdin. A
  non-zero exit is surfaced as a throw (with stderr) rather than returning partial stdout.
  NOTE: like run.ts's OpenRouter wiring, the real `claude -p` call is unrun so far — the CLI
  path only fires under `import.meta.main`; the 19 tests exercise the pure core with an
  injected `JudgeFn` and spend nothing. First real invocation lands with the smoke sweep.
- **`loadBlindRecords` skips `key.json` by name.** The unblinding key sits in the same
  `blind/` dir as the records; filtering `f !== "key.json"` keeps the judge from ever
  reading identity, enforced by a test that plants a key.json and asserts it's excluded.

## Phase 4 — eval `score.ts` (done)

- **A "block" is one rubric check (c1..c5), not a persona group.** The reporting rule in
  RUBRIC.md ("per-block pass rates for each check") and `specs/eval-harness.md` both use
  block = check. `score.ts` reports, for each check, a pass rate PER ARM — never a single
  combined headline number. That is the whole point of the reporting discipline.
- **CEILING = every arm with runs passed the check on every run.** A saturated block no
  longer discriminates between arms, so it is uninformative, not a win — `formatReport`
  prints an explicit `CEILING` line for it (mirrors adhd-eval's score.py). This holds for a
  single arm too: one arm at 100% still means the check isn't discriminating, so it earns the
  warning. `ceiling` is false when there are zero cells (nothing to saturate). The spec text
  says "if both arms max out"; the general condition (all arms with runs at 100%) covers the
  one-arm case honestly and was chosen deliberately.
- **`score.ts` is the ONE stage allowed to read `blind/key.json`.** blind.ts writes it,
  judge.ts explicitly skips it, score.ts reads it to unblind. `joinScores` is pure (no FS);
  the key read + CLI live under `import.meta.main`, so no spend on import.
- **Coverage is reported honestly, never silently dropped.** A score whose blindId has no
  key entry -> `unmatchedScores` (a WARNING line); a key entry with no score -> `unjudged`
  (a count line). This makes an interrupted/partial judging pass visible in the report rather
  than looking complete.
- **c5 gets an unblinded audit list.** Because c5 (factually correct) is the never-drop
  check, `formatReport` lists every c5 failure with its restored identity (persona/axis/arm/
  run + rationale) so a human can spot-check the most consequential verdicts by hand.
- The `must(v)` helper (throws on undefined) is used in `score.test.ts` in place of
  `find(...)!` — lint bans non-null assertions as an error (see the gates note above).

## Phase 4 — smoke sweep (done)

- **`claude -p` is NOT logged in in this container.** No `ANTHROPIC_API_KEY` in env; the
  CLI prints `Not logged in · Please run /login` to **stdout** and exits 1. So `judge.ts`'s
  real transport cannot run here. The full Phase-5 sweep needs a logged-in `claude -p` (or an
  `ANTHROPIC_API_KEY`) for a trustworthy c5. The pure judge core (`parseJudgeResponse`,
  `scoreBlindRecord`, injected `JudgeFn`) works regardless — only the CLI backend is blocked.
- **Bug fixed (test-first): `claudeJudge` dropped stdout on failure.** It reported
  `err.trim() || "(no stderr)"`, but the CLI's real error was on **stdout**, so the failure
  was undiagnosable. Extracted pure `describeClaudeFailure(code, stdout, stderr)` (stderr →
  stdout → `(no output)`), exported + 3 tests (judge.test.ts, now 22). Failing test committed
  first. Lesson for any spawned CLI: on non-zero exit, surface stdout too — not every tool
  writes errors to stderr.
- **OpenRouter latency ≈ 12s/call for `moonshotai/kimi-k2.6`.** A `turn_cap: 12` cell is up
  to ~24 model calls ≈ 5–8 min; two cells exceed a 550s foreground timeout. **Run sweeps
  detached** (`nohup … &` / run_in_background) and watch `evals/runs/` fill — `run.ts` writes
  one file per cell on completion and is resumable, so a killed foreground wrapper never
  loses finished cells. Do NOT pipe the sweep through `tail` while waiting: `tail` buffers
  until EOF, so a killed run shows an empty log even though cells completed.
- **Both smoke cells finalized in 5 turns; all six gates PASS.** director-ari-aster requested
  9 ids, placed 9 (density 0.318); single-film-uncut-gems similar. Note the oracle requested
  **9** ids here (below the Phase-5 target of >= 10) yet all placed — luck, not reliability;
  Phase 5 still raises the requested count.
- **Observed drift the eval is meant to catch:** the uncut-gems oracle put `CONNIE` (Good
  Time) into a puzzle whose user *explicitly rejected* Good Time; the ari-aster oracle put
  `the-witch` into `selectedFilmIds` but requested no Witch words. Both are exactly the c1
  "centre of gravity" drift RUBRIC.md warns about — one word each, so c1 still passes, but
  worth watching once the full sweep runs with a real judge.
- **Eval artifacts (`runs/ blind/ scores/`, `*.log`) are gitignored** — reproducible sweep
  outputs, not source. The evidence lives in the plan + these notes, not committed JSON.
- **Smoke judge caveat:** because `claude -p` was blocked, the two blinded puzzles were
  judged by the Claude *agent* from the blinded content only (transcript/words/clues/grid),
  fed through the real `scoreBlindRecord` path so the score files match the CLI schema
  byte-for-byte. This proves the pipeline mechanically (run→blind→judge→score, CEILING fires
  on 2/2 saturation). It is NOT a blind judgment (the agent had seen the run identities),
  so the 100%/CEILING numbers are a plumbing check, not an eval result. Phase 5 must use the
  real logged-in `claude -p`.

## Corrected assumptions

Record any case where a measurement contradicted something written in the plan or the
specs. The measurement wins; note what changed and why.

- Plan (Phase 0 task 1) enumerated 9 lint errors but said "12". `bun run lint` measured
  12. The extra 3 (`experience.tsx` + `use-debug-voice.ts` set-state-in-effect, unused
  `PaletteCard`) were not in the prose list. Measurement won; all 12 fixed.

## Phase 3 — `cast?` field (done)

`Film.cast?: string[]` added and populated for the 8 approved films only. Per the
accuracy rule, cast lists are **principals only**, not full credits — deliberately
conservative where I was not 100% sure of a name:
- `the-witch` has only 4 (Taylor-Joy, Ineson, Dickie, Scrimshaw); the twins Mercy/Jonas
  (Ellie Grainger / Lucas Dawson) were left out — plausible but not confirmed here.
- `the-backrooms` has **no** `cast` by spec (no named ensemble).
- `ex-machina` / `everything-everywhere` are excluded from expansion, so no cast added.
These are intentional gaps, not oversights; a future iteration confident in more names
can extend the lists. `cast` is optional, so absence never breaks a build.

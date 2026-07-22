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
- **Placement rate (expanded bank):** partial — bank is now **53 entries** (moonlight/
  hereditary/midsommar at 7 each; lady-bird 7, materialists 7, the-witch 8). Fuzz (seed
  0x51ac, 64 trials/size, sizes 4–16) reports **97.7% overall** (8127/8320), with
  P(>=8 placed): 88% at size 8, 88% at 9, **100% at >= 10**. Still not the final number —
  Phase 3's last task re-measures against the full ~70-entry bank once good-time/uncut-gems/
  the-backrooms are brought to >= 6 each. Reading holds: request **>= 10 ids** for a
  reliable >= 8 placed.
- **Fuzz sweep is now capped at maxSize 16**, not the whole bank. The generator cost grows
  superlinearly with word count; sweeping all 32 entries took ~110s and timed out the 20s
  bound (and would only get worse toward ~70). Sizes 4–16 cover the entire Phase-5 decision
  region (P(>=8) saturates to 100% by size 10), so nothing the gate needs was lost. Only
  invariants are asserted, so the cap does not weaken any assertion. The headline-rate
  re-measure against the final bank is the dedicated last Phase 3 task.
- **Ids to request for >= 8 placed words:** not yet derived — Phase 5. Current (32-entry)
  reading still points to **>= 10** for a reliable >= 8 placed.

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

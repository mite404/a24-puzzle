# Spec: Crossword layout must produce a playable grid

## Concern

`buildGamePayload` turns a list of crossword entry ids into a placed grid via
`crossword-layout-generator`. The grid the user actually plays must be dense enough
to be worth playing.

## Background

`src/lib/game.ts:44` filters out any word the generator could not interlock
(`orientation === "none"`). This happens **silently**. Ten ids can become six placed
words with no error, no warning, and no record anywhere.

This is the single most important untested behaviour in the repo.

## Requirements

- R1. At least **8 words** must be placed on the grid for any normal profile.
- R2. Every placed word must carry the `id` of the bank entry it came from.
- R3. No duplicate ids may appear in a single layout.
- R4. Every placed word must fit inside the reported `rows` x `cols` bounds.
- R5. Where two words cross, both must agree on the shared letter.
- R6. The number of dropped words must be observable by the caller, not silently swallowed.

## Success criteria

- `bun test` covers each requirement above with a named test.
- A fuzz test draws many random id sets from the bank and reports the observed
  **placement rate** (placed words / requested words).
- The measured placement rate is recorded below, because the number of ids to request is
  derived from it.

## Explicitly out of scope

- Changing the layout generator itself.
- Grid aesthetics or symmetry. This is not a NYT-style crossword.

---

# Measured behaviour

Everything below is measured by `src/lib/crossword-fuzz.test.ts`, not assumed. Re-run it
after any change to the bank or the resolver, and update these numbers.

## Placement rate — 68-entry bank

Seed `0x51ac`, 64 trials per size. Overall **97.3%** (8021/8243).

| ids requested | mean placed | rate | P(>=8 placed) |
|---|---|---|---|
| 4 | 3.78 | 94.5% | 0% |
| 5 | 4.69 | 94.0% | 0% |
| 6 | 5.72 | 95.3% | 0% |
| 7 | 6.61 | 95.7% | 0% |
| 8 | 7.50 | 94.5% | **64%** |
| 9 | 8.53 | 95.3% | **92%** |
| 10 | 9.69 | 97.6% | **100%** |
| 11 | 10.70 | 98.1% | 100% |
| 12 | 11.69 | 98.2% | 100% |
| 13 | 12.53 | 97.9% | 100% |
| 14 | 13.66 | 98.5% | 100% |
| 15 | 14.58 | 98.4% | 100% |
| 16 | 15.66 | 99.0% | 100% |

**Rule of thumb: request ≈ target + 1.** Roughly one word always fails to interlock.

**Bank growth did not help at the margin.** Across bank sizes the headline rate rose
(14 entries → 96.4%, 68 → 97.3%) but `P(>=8)` at the borderline sizes 8–9 did **not**
improve monotonically (64%/92% at 68 entries vs 88%/88% measured at 53). The headline rate
is the stable number; `P(>=8)` at small sizes is noisy. Do not read a bank expansion as
licence to request fewer ids.

The sweep is capped at size 16 deliberately — generator cost grows superlinearly, and
`P(>=8)` saturates at 100% by size 10, so nothing the sizing decision needs lies above 16.

## Four non-obvious properties of the generator

1. **Placement is input-*order* dependent, not merely count dependent.** The full 14-entry
   bank places all 14, but `crosswordBank.slice(0, 8)` deterministically drops `LIMINAL` —
   7 placed. A *smaller* set can drop words while the whole bank does not. This is why the
   per-size mean placed sits below the requested count.

2. **`crossword-layout-generator` is deterministic** — no `Math.random` in its source, so a
   given id set always yields the same grid. Grid-integrity and fuzz tests therefore need no
   seeding and cannot be flaky. The only randomness in `game.ts` is `shuffle`, used for
   location-quiz distractors, never for the crossword.

3. **Coordinates are 1-indexed, `startx` = column and `starty` = row.** `orientation:
   "across"` increments the column per letter; `"down"` increments the row. Letter *k* sits
   at `(x = startx + (across ? k : 0), y = starty + (down ? k : 0))`. The R4/R5 grid tests
   depend on this.

4. **Dropped words are now observable** (R6). `CrosswordLayout.droppedIds` carries the bank
   ids the generator returned with `orientation: "none"`. Placed and dropped are split on one
   predicate, so they are exhaustive: `words.length + droppedIds.length === entries.length`.

## Test couplings to preserve

Two tests are deliberately pinned to measured data. If they go red after a bank change,
**re-point them at a freshly measured set — do not weaken the assertion.**

- `game.test.ts` "droppedIds is empty when every requested word is placed" is pinned to
  `crosswordBank.slice(0, 14)`, a set measured to place all 14. It originally used the whole
  bank; at 53 entries the full bank in natural order began dropping `MATCHMAKER`.
- The `pickAlternateCrosswordIds` preference test branches on whether the selected film has
  more entries than the default count (8). `uncut-gems` now has 10, so not all can appear —
  the test asserts *every picked slot is preferred* in that case, and *every preferred id
  appears* otherwise.

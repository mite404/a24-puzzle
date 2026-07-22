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
- The measured placement rate is written into `RALPH_NOTES.md`, because the number of
  ids the oracle should request is derived from it.

## Explicitly out of scope

- Changing the layout generator itself.
- Grid aesthetics or symmetry. This is not a NYT-style crossword.

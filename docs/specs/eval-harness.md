# Spec: Blind eval harness for conversation-driven crossword generation

## Concern

Deterministic tests prove the grid is *structurally* sound. They cannot tell us whether
the puzzle is *about the right things* for the conversation that produced it. That needs
an eval harness with an LLM judge.

## Reference implementation

`/Users/ea/Programming/adhd-eval` is the model to follow. It is not mounted in this
container, so the design is restated here in full.

Four stages, each a separate resumable script:

1. **run** — generate outputs into `runs/`. Skips any cell that already has a non-empty
   output file, so an interrupted sweep resumes cheaply.
2. **blind** — copy `runs/*` to `blind/` under a salted hash, writing the real identity
   to `blind/key.json`. The judge never reads `key.json`.
3. **judge** — score each blinded output independently against a fixed checklist.
   Absolute scoring, one output at a time, **never pairwise**. Resumable.
4. **score** — unblind, aggregate, report.

## Layout

```
evals/
  personas/     synthetic user profiles that drive the conversation
  RUBRIC.md     the judge checklists, written BEFORE any run
  run.ts        conversation -> profile -> game payload -> runs/*.json
  blind.ts      runs/ -> blind/ + key.json
  judge.ts      blind/ -> scores/*.json   (via `claude -p`)
  score.ts      scores/ -> aggregate report
```

## System under test

`run.ts` must exercise the **real** prompt and the **real** tool schema:
`buildSystemPrompt()` from `src/lib/oracle-prompt.ts` and `oracleTools` from
`src/lib/oracle-tools.ts`, against the model in `OPENROUTER_MODEL`
(default `moonshotai/kimi-k2.6`). Call the model directly — do not stand up the Next.js
server or go through `POST /api/chat`.

A scripted-user driver answers the oracle from a persona sheet for N turns. The run ends
when `finalizeExperience` fires, or when a turn cap trips (which is itself a failure).

## Personas

At least 10, covering these axes:

- single-film obsessive
- multi-film, one **director** (e.g. Ari Aster: hereditary + midsommar)
- multi-film, one **actor** (requires `Film.cast` from `crossword-bank.md`)
- mood-led, names no film at all
- undecided, contradicts themselves
- adversarial: off-topic, or names films not in the catalog
- terse, one-word answers
- effusive, over-long answers

## Deterministic gates

Computed in code, no judge, no API cost. A run **fails** if any gate fails:

| Gate | Threshold |
|---|---|
| `finalizeExperience` was called | 100% of runs |
| all returned ids exist in the bank | 100% |
| words **placed on the grid** | **>= 8** |
| duplicate ids | 0 |
| words drawn from `selectedFilmIds` | >= 60% |
| distinct difficulty levels present | >= 2 |
| grid fill density | recorded, no gate yet |

## Judge checklist

Binary per check, scored blind, one puzzle at a time. Judge sees the transcript, the
words, the clues, and an ASCII rendering of the grid. Judge does **not** see the persona
name, the arm, or the run index.

- c1. The word set is recognisably about the films this user engaged with.
- c2. Clues are solvable by a fan of those films without external lookup.
- c3. Difficulty is mixed, not uniformly trivial or uniformly obscure.
- c4. No duplicated or near-duplicated words or clues.
- c5. **Every clue is factually correct** about its film.

c5 is the one that must never be dropped. It is the check that would catch a
hallucinated character or a misattributed actor.

## Reporting rule

Report per-block numbers, never a single headline score. If both arms max out a block,
say so explicitly — a saturated block is uninformative, not a win. `adhd-eval/score.py`
prints a `CEILING` warning for exactly this and this harness must too.

## Cost discipline

- The judge runs through the `claude` CLI, which is covered by the user's subscription.
- The system under test runs through OpenRouter and costs real money. Keep sweeps small
  (10 personas x 3 runs) and make `run.ts` resumable so nothing is ever paid for twice.
- Never run a sweep to "see what happens". Change one thing, then measure.

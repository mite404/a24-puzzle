# Re-judge — does c1's 48% measure curation, or stenography?

Phases C and D of the curation-eval redesign, run against the **stored artifacts** from
the baseline sweep. No new OpenRouter spend; the 33 runs were never regenerated.

## The question

The baseline sweep reported `c1 — on topic` at 16/33 (48%). The critique was that this
measures *"did the user literally name every film"* — punishing the oracle for the very
curation behaviour the product is designed around (show palettes, expand taste, surprise).

## Method

1. **Phase C (free, deterministic).** For each run, compute whether every film
   contributing a *placed* word was either named by the user or shown to them as a
   palette. No model in the loop.
2. **Phase D (blind re-judge).** Rewrite the rubric to be curation-aware, splitting the
   old single check into three, then re-judge the **17 runs the old c1 failed** — the only
   verdicts that could flip. Blind ids only; judges were instructed to read nothing else.

New checks:

- **c1 — thematic coherence.** Does the puzzle read as one person's sensibility, even
  including films they never named?
- **c7 — justified surprise.** Does every unnamed film have a defensible moment in the
  conversation (palette shown and engaged with, or mood clearly pointing to it)?
- **c6 — respects explicit rejections.** Does the puzzle avoid films the user refused?

## Results — of the 17 runs old-c1 failed

| Check | Pass | Reading |
|---|---|---|
| **c1 — coherence** | **12/17** | The critique was right. Most "failures" are coherent puzzles. |
| **c7 — justified surprise** | **1/17** | The defect is real, and this is its true name. |
| **c6 — respects rejections** | **11/17** | 6 runs put words from films the user explicitly refused. |
| gate C (free proxy) | 2/17 | Near-identical to c7. |

## What this changes

**1. The old c1 was conflating two things.** 12 of 17 puzzles hang together perfectly
well as one person's taste. Scoring them as failures overstated the problem and hid its
actual shape. The critique was correct on this point.

**2. The defect survives the fairer rubric — sharper, not smaller.** 16 of 17 fail
justified surprise. These puzzles include films with *no supporting moment anywhere* in
the conversation: not named by the user, not even offered by the oracle as a palette.
That is `resolveCrosswordEntries` top-up padding reaching the grid, not curation.

**3. Six runs cross a hard boundary.** The user said "I only want Uncut Gems today" or
refused a palette outright, and words from those films appeared anyway. This is the most
serious category and the old rubric had no name for it.

**4. The free gate is a near-perfect proxy for c7 — but useless for c6.**
Gate C and c7 agree on 16 of 17. Detecting *absence* of justification is pure computation.
Detecting *rejection* requires reading prose, and only the judge can do it.

### The cost consequence

Run gate C on every cell for free, and spend judge budget only on **c6 and c1** — the two
checks that genuinely need a reader. This makes the expensive half of the harness roughly
a third cheaper per sweep with no loss of signal.

## Caveats

- N = 17, and only runs the old rubric already failed. The 16 runs old-c1 *passed* were
  not re-judged; some may fail c7 too, so 1/17 is not a whole-sweep rate.
- The judges are blind subagents, the same substitution documented in `RESULTS.md`, not
  `claude -p`.
- c7 and gate C agreeing 16/17 is partly by construction — both look for the same absence.
  The agreement shows the judge adds little *here*, not that judges are redundant generally.

## Recommended next actions

- [ ] Replace the single `c1` in `RUBRIC.md` with `c1` / `c7` / `c6` as scored here.
- [ ] Promote gate C into `run.ts`'s deterministic gates, ahead of any judge spend.
- [ ] Fix the root cause: stop `resolveCrosswordEntries` / `pickAlternateCrosswordIds`
      top-up from injecting bank entries the conversation never motivated.
- [ ] Re-judge the 16 old-c1 *passes* under the new rubric for a true whole-sweep rate.

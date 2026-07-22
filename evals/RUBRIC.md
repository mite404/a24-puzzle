# RUBRIC — the judge's checklist

Written **before** any run exists, so the bar cannot be quietly lowered to match
whatever the model happened to produce.
This is the fixed target; the runs are measured against it, never the reverse.

The judge (`judge.ts`, via `claude -p`) reads this file and scores **one blinded
puzzle at a time**.
See `specs/eval-harness.md` for why the harness is built this way.

---

## What the judge sees

For each puzzle, exactly this, and nothing else:

- The **transcript** of the scripted conversation that produced the puzzle.
- The **word set** that was placed on the grid.
- The **clues** for those words.
- An **ASCII rendering** of the grid, showing how the words interlock.

## What the judge must never see

- The **persona name** (single-film obsessive, adversarial, terse, …).
- The **arm** (which prompt or config variant produced this run).
- The **run index** (run 1 vs run 3 of the same cell).

Identity is stripped by `blind.ts` behind a salted hash, and the real mapping lives in
`blind/key.json`, which the judge never opens.
This keeps scoring **absolute**: each puzzle stands on its own, never compared against a
sibling. No pairwise ranking, ever.

---

## Scoring model

Every check is **binary**: `true` (pass) or `false` (fail).
There are no partial credits and no 1–5 scales.
A binary bar is harder to game and easier to audit than a numeric one.

A puzzle's judge result is the five booleans plus a one-line rationale per check.
The rationale exists so a human can later spot-check the judge itself — especially any
`c5: false`, which is the most consequential verdict this harness can return.

When a check genuinely cannot be evaluated (e.g. the transcript is empty because the run
failed a deterministic gate upstream), the judge marks it `false` and says so in the
rationale.
Absence of evidence is not a pass.

---

## The five checks

### c1 — On topic

**The word set is recognisably about the films this user engaged with.**

Pass when a fan reading the transcript would agree the words belong to the films the user
actually talked about.
Fail when the puzzle is padded with words from films the user never raised — the top-up
paths in `resolveCrosswordEntries` and `pickAlternateCrosswordIds` can inject bank
entries the conversation never motivated, and this check is what catches that drift.

A single off-topic word does not fail c1 on its own; a puzzle whose *centre of gravity*
has slid away from the conversation does.

### c2 — Solvable

**Clues are solvable by a fan of those films without external lookup.**

Judge from the standpoint of someone who has seen the films in the transcript, not a
general trivia solver.
Pass when each clue points clearly enough at its answer for such a fan.
Fail when a clue is so oblique, or leans on a detail so deep, that even a fan would have
to search for it.

This is about *fairness of the clue*, not correctness — correctness is c5.

### c3 — Mixed difficulty

**Difficulty is mixed, not uniformly trivial or uniformly obscure.**

Pass when the set spans a range: some gimme leads, some deeper cuts.
Fail when every clue is a lead character (all trivial) or every clue is a deep-cut
prop/walk-on (all obscure).

The bank tags each entry `easy` / `medium` / `hard` per `crossword-bank.md` R7, but the
judge does **not** get those tags — it judges the felt difficulty of the clues as
written, which is the thing a solver actually experiences.

### c4 — No duplicates

**No duplicated or near-duplicated words or clues.**

Pass when every answer is distinct and no two clues are restatements of each other.
Fail on a repeated answer, or on two clues that point at the same fact from barely
different angles (e.g. two clues both amounting to "the film's director").

Exact duplicate *ids* are already blocked by a deterministic gate and by the
`resolveCrosswordEntries` dedup fix, so c4 exists to catch the softer case those miss:
two *different* entries that are effectively the same clue.

### c5 — Factually correct — NEVER DROP THIS ONE

**Every clue is factually correct about its film.**

Pass only when every clue checks out: right character, right actor, right plot detail,
right film.
Fail on a **single** wrong fact — a hallucinated character, a misattributed actor, a
detail from the wrong movie.

c5 is the reason this harness exists.
The deterministic gates prove the grid is *structurally* sound; they cannot tell a true
clue from a confident lie.
Only c5 can, and it is the check that must never be dropped, relaxed, or averaged away.

If the judge is unsure whether a fact is correct, it fails c5 and names the doubtful clue
in the rationale.
A puzzle aimed at superfans is worse for one wrong clue than for being a little smaller —
so the burden of proof sits on the clue, not on the judge.

---

## Judge output format

For each blinded puzzle, `judge.ts` emits one JSON object:

```json
{
  "blindId": "<salted hash — the only id the judge knows>",
  "c1": { "pass": true,  "why": "words are all Ari Aster films the user discussed" },
  "c2": { "pass": true,  "why": "each clue is fair to someone who saw the films" },
  "c3": { "pass": true,  "why": "spans DANI (lead) to SOLSTICE (motif)" },
  "c4": { "pass": true,  "why": "no repeated answers or restated clues" },
  "c5": { "pass": false, "why": "PELLE clue calls him Dani's brother; he is Christian's friend" }
}
```

`pass` is the machine-readable verdict; `why` is one line for human audit.
`score.ts` unblinds these and aggregates per block — never into a single headline number.

---

## Reporting rule (carried into `score.ts`)

Report **per-block** pass rates for each check, never one combined score.
If two arms both pass a check on **every** run, that block is **saturated**: say so with an
explicit `CEILING` warning.
A maxed-out block is uninformative, not a win — it means the check no longer discriminates
between the arms, and the harness must not let a ceiling masquerade as a result.

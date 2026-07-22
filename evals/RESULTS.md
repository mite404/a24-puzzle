# Crossword Eval — Full Sweep Results

Full sweep of the crossword oracle: **11 personas × 3 runs = 33 cells**, arm `baseline`.
Oracle and scripted user both `moonshotai/kimi-k2.6` (OpenRouter).
Pipeline: `run.ts` → `blind.ts` → judge → `score.ts`.

The plan called for "10 personas × 3 runs".
We have 11 persona sheets, so all 11 were swept (33 cells) rather than dropping one.

## How to reproduce

```bash
bash evals/parallel-sweep.sh        # 11 workers, one per persona, each --runs=3
bun evals/blind.ts                  # salted-hash blind + key.json
bun evals/judge-subagent.ts --dump  # one blind prompt per puzzle
#   (judge each evals/judge-prompts/*.txt → evals/judge-replies/<blindId>.txt)
bun evals/judge-subagent.ts --ingest
bun evals/score.ts
```

Artifacts (`runs/ blind/ scores/ judge-*`) are gitignored — they are reproducible,
not source. The findings below are the record.

## Judge substitution (must read)

`claude -p` is **not logged in** in this container (no `ANTHROPIC_API_KEY`), so
`judge.ts`'s real transport cannot run here.
As documented in `RALPH_NOTES.md`, judging was done through the blind-subagent bridge.

Each puzzle's `buildJudgePrompt` output was handed to a separate Claude subagent.
That prompt is fully blind — RUBRIC + transcript + placed words + clues + ASCII grid,
and **nothing else** (no persona, arm, run index, filmId, or difficulty).
Each subagent's JSON verdict was run back through the real `parseJudgeResponse`, so the
`scores/*.json` are byte-identical to the CLI schema.

This is a genuine blind judgment — stronger than the Phase 4 smoke sweep's self-judging.
It is still a substitution for `claude -p`.
A future run with a logged-in CLI can re-judge the same blinded artifacts for zero extra
OpenRouter spend.

---

## Part 1 — Deterministic gates (no judge, no CEILING concept)

These six gates are computed in `run.ts` with no model in the loop.
`report.passed` is the AND of all six.

| Gate | Pass rate |
|---|---|
| finalize called | 33/33 (100%) |
| all returned ids in bank | 33/33 (100%) |
| ≥ 8 words placed (spec R1) | 33/33 (100%) |
| 0 duplicate placed ids (R3) | 33/33 (100%) |
| ≥ 60% placed from selected films | 33/33 (100%) |
| ≥ 2 distinct difficulty levels | 33/33 (100%) |
| **all six (report.passed)** | **33/33 (100%)** |

Supporting measurements across the 33 cells:

- **ids requested:** min 12, max 14, mean **13.24**.
- **words placed:** min 11, max 14, mean **13.09** — every cell ≥ 8.
- **grid fill density:** min 0.168, max 0.413, mean 0.290 (recorded, never gated).

**The Phase 5 fix is validated by data.**
The oracle now requests 12–14 ids on every cell (the "10–14" instruction landed), and
the ≥ 8-placed gate is met on all 33 — the exact reliability the Phase 2/3 fuzz predicted
for requests ≥ 10.
No cell dropped below 8 placed words.

---

## Part 2 — Judge blocks (per-check, per-arm, absolute scoring)

Reported per block (one block = one rubric check), never a single headline number.
Only one arm exists (`baseline`), so per-arm and overall coincide here.

| Check | baseline | CEILING? |
|---|---|---|
| c1 — on-topic | **16/33 (48%)** | no |
| c2 — solvable | 33/33 (100%) | **CEILING** |
| c3 — mixed difficulty | 33/33 (100%) | **CEILING** |
| c4 — no near-duplicates | 32/33 (97%) | no |
| c5 — factually correct (NEVER DROP) | 32/33 (97%) | no |

CEILING means the block saturated — every arm passed every run, so it no longer
discriminates between arms.
c2 and c3 are saturated here.
That is not a "win"; it means these checks cannot yet tell a good arm from a bad one, so
they need harder personas or a second arm before they inform anything.

### The headline finding: c1 on-topic drift (48%)

The single discriminating result of this sweep.
The oracle reliably builds a *valid, solvable* puzzle (Part 1 + c2/c3), but **its centre
of gravity slides off the films the user actually engaged** in roughly half of runs.

Per-persona c1 pass rate:

| Persona | Axis | c1 |
|---|---|---|
| effusive-overlong | effusive, over-long answers | 3/3 |
| undecided-contradicts | undecided, contradicts self | 3/3 |
| actor-pattinson | multi-film, one actor | 2/3 |
| director-ari-aster | multi-film, one director | 2/3 |
| single-film-uncut-gems | single-film obsessive | 2/3 |
| adversarial-off-topic | adversarial: off-topic | 1/3 |
| director-safdie | multi-film, one director | 1/3 |
| mood-led-no-film | mood-led, names no film | 1/3 |
| single-film-the-witch | single-film obsessive | 1/3 |
| actor-collette | multi-film, one actor | 0/3 |
| terse-one-word | terse, one-word answers | 0/3 |

The failure mode is consistent across personas: the oracle fills spare grid slots with
words from films the user never raised — and sometimes from films the user **explicitly
rejected**.
Representative blind rationales (judge never saw identity):

- **single-film-the-witch run1** — "user engaged ONLY with The Witch and expressly
  refused Hereditary/Backrooms, yet 6 of 14 words are from those films."
- **adversarial-off-topic run2** — "user demanded Moonlight only, yet 6 of 13 words are
  Hereditary (ANNIE/CHARLIE/PAIMON/MINIATURES…)."
- **director-ari-aster run3** — "5 of 14 words (EGGERS, THOMASIN, WILLIAM, KATHERINE,
  CALEB) are from The Witch, a Robert Eggers film — not Ari Aster."
- **mood-led-no-film run1** — "6 of 14 words are Backrooms lore, a film the user's mood
  cues never pointed to."

This is precisely the drift RUBRIC.md's c1 was written to catch, and the Phase 4 smoke
sweep foreshadowed it (`CONNIE` from Good Time in an uncut-gems puzzle).
It is now measured across a full sweep: **the ≥ 60% selected-film *gate* passes 33/33,
but the judged on-topic *bar* passes only 48%.**
The gate's 60%-of-placed threshold is far more forgiving than a human reading "did this
puzzle stay about what I asked for" — so a puzzle can clear the deterministic gate and
still fail c1.
The two are not redundant; c1 is the stricter, human-aligned check, and it is where the
model has real headroom to improve.

### c4 — one near-duplicate

- **terse-one-word run2** — "clues 8 and 9 restate the same fact from mirror angles:
  HARRY 'played by Pedro Pascal' and PASCAL 'Pedro who plays Harry'."

A role↔actor pair placed as two answers yields two clues that are each other's mirror.
Worth a note for a future oracle-prompt tweak (avoid placing both halves of a
role/actor pair in the same grid).

### c5 — one factual-correctness failure (NEVER DROP)

Full unblinded audit of every c5 failure, per RUBRIC.md's never-drop rule:

- **effusive-overlong run3** (blindId 622eca42d627) — "MATCHMAKER clue 'Lucy's Manhattan
  profession' maps to no film in the transcript and cannot be verified as factually
  correct; unverifiable per burden-of-proof, so c5 fails."

This is a burden-of-proof failure, not a proven falsehood: the clue references a
Materialists detail the blind judge could not confirm from the transcript alone.
It is the strict reading RUBRIC.md asks for (absence of evidence is not a pass).
1 failure in 33 is a low c5 miss rate, but c5 is the check we never let slide, so it is
flagged here for human spot-check rather than averaged away.

---

## What the numbers mean

1. **The generator/placement half of the system is solid.**
   All six deterministic gates pass on every cell, and ≥ 8 words place every time.
   The Phase 2/3 fuzz work and the Phase 5 "request 10–14 ids" fix did their job.

2. **The oracle's *topic discipline* is the weak point, not its grid-building.**
   c1 at 48% is the real signal.
   The model builds a fine puzzle about *some* A24 films, but not reliably about the
   films *this user* chose — even ignoring explicit rejections.

3. **c2/c3 are saturated (CEILING) and currently uninformative.**
   Every puzzle was solvable and difficulty-mixed.
   To make these discriminate, a later iteration needs harder personas or a second
   (ablated) arm.

4. **Deterministic gate ≠ judge bar.**
   The ≥ 60%-selected gate passing 33/33 while c1 passes 16/33 is the clearest evidence
   that the cheap gate and the human-aligned judge measure different things.
   Keep both.

### Caveats

- One arm only (`baseline`). No A/B comparison yet; CEILING warnings exist to stop us
  reading a saturated single-arm block as success.
- Judge is the blind-subagent substitution, not `claude -p` (see above).
- Both oracle and user are the same model (`kimi-k2.6`); a stronger user model might
  press the oracle harder on topic drift and lower c1 further.
- 33 cells per block is a small N; treat c4/c5's single failures as flags to inspect,
  not as calibrated rates.

# Handoff — crossword test coverage & eval work

Written 2026-07-22 at the end of the session that produced the `crossword-eval` branch.
For whoever (human or agent) picks this up next.

## Where things stand

**Merged.** PR #14 squash-landed on `main` as `47c83b5`. The branch was 42 commits, 41 of
them from an autonomous overnight loop, the rest interactive. Validation was green at merge:
**146 tests pass, tsc clean, lint 0 errors** (4 deliberate warnings, see below).

Read `evals/RESULTS.md` and `evals/REJUDGE-RESULTS.md` before forming opinions about the
oracle's quality. The numbers there are measured, not asserted.

## The one big open thread

**`specs/puzzle-builder.md` is approved by the user but not implemented.**

The finding that motivates it: the oracle's off-topic drift is **structurally mandated by
its own instructions**, not model misbehaviour. It is told to finalize on >= 3 films and
request 10-14 crossword ids, while every film except `uncut-gems` has only 7-8 bank
entries. A single-film user therefore *cannot* receive an on-topic puzzle.

The fix is to move word selection out of the model into a pure function, and change
`finalizeExperience` to emit *taste* (`selectedFilmIds`, `rejectedFilmIds`, `exclusive`)
rather than word ids. The spec has the full contract, the ladder, the sizing math, and the
blast radius (15 files). Order of work is at the bottom of that file.

Decisions the user already made — do not relitigate:

- Puzzle size target **7-12 placed words** (request target+1). Not 8+; smaller is fine.
- The builder is a **pure function, not a second agent**. Selection is constraint
  satisfaction; that is what the model is bad at.
- When material runs out, **return a shorter puzzle** and report `shortfall`. Never pad.
- `rejectedFilmIds` and `exclusive` are **session-scoped, never persisted** — they describe
  a mood, not a person. 17 of 33 transcripts scope taste to "today"/"right now".
- What *is* worth persisting later is **seen word ids**, for replay freshness.
- Bank must reach **>= 10 entries per film** before this ships (currently 7-10).

## Other open items

- **lightningcss render bug — unreproduced.** The user reported the site not rendering; a
  previous agent diagnosed a Turbopack/native-binary issue and added
  `"lightningcss": "^1.33.0"` to `package.json`. That was **reverted**: the lockfile
  originally had exactly one lightningcss (1.32.0, via `@tailwindcss/node`), and adding a
  root dep is what *created* the two-version split it then diagnosed. The main checkout
  resolves both `require()`s fine and the bug could not be reproduced. **Reproduce before
  attempting any fix.** `serverExternalPackages` was considered and is probably wrong — it
  targets server-component bundling, not the PostCSS toolchain.
- **Backlog from the loop** (was in `IMPLEMENTATION_PLAN.md`, now deleted): relax the
  3-film minimum, mine each film to >= 10 entries, add an ablated second arm to the sweep,
  re-judge the 16 old-c1 *passes* under the new rubric. Per `AGENTS.md` these belong as
  GitHub issues on `mite404/a24-puzzle`.
- **`docs/FOR_ETHAN.md` has not been updated** for this work. `AGENTS.md` mandates it after
  every major feature or refactor.

## Things you would otherwise waste time re-deriving

- **All measured numbers live in `specs/crossword-layout.md`**, section "Measured
  behaviour" — placement rates, the four non-obvious generator properties, and the two test
  couplings. Re-run `bun test src/lib/crossword-fuzz.test.ts` to regenerate.
- **Placement is input-*order* dependent**, not just count dependent. The full 14-entry bank
  places all 14; `slice(0,8)` drops one.
- **The layout generator is deterministic** — no `Math.random`. Grid tests need no seeding
  and are not flaky.
- **`pickAlternateCrosswordIds` abandons `excludeIds`** once fewer than 4 non-excluded
  entries survive. Exclusion is best-effort today. The builder must not inherit this.
- **The 4 remaining lint warnings are deliberate** — documented in a comment at the top of
  the relevant block in `src/components/intake/oracle-tv-scene.tsx`. Do not "fix" them by
  widening dependency arrays.
- **Eval artifacts (`evals/runs|blind|scores|judge-*`) are gitignored** but were left on
  disk. They are reproducible; the findings docs are the record.
- **The sweep's judge was a blind-subagent bridge, not `claude -p`** (not authenticated in
  the run container). The stored blind artifacts can be re-judged for zero API cost.

## Directory topology

| Path | What |
|---|---|
| `~/Programming/web/fractal/a24-puzzle` | main checkout, on `main` |
| `~/Programming/web/fractal/worktrees/a24-puzzle/verde-fig/a24-puzzle` | worktree, `crossword-eval` |
| `~/Programming/web/fractal/ralph-a24` | sealed agent clone — **redundant, safe to delete** |

Worktrees share one `.git`; a commit in either is instantly visible from the other, and
`git push` works from either. The ralph clone is a *separate repository* with no remote —
that is why it needed `git fetch <path> <branch>` to hand work back.

## If you are setting up another autonomous run

Use the `create-container` skill (`~/.claude/skills/create-container/`). It carries the
hardened scripts and a lessons file covering the things that actually went wrong here —
most importantly that `if docker run ... | tee log; then` tests **tee's** exit status, so
every failure reads as success. That bug spun the loop 4,141 times in this project. It is
still present upstream in `taches-cc-resources`.

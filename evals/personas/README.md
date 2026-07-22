# Persona sheets

Synthetic user profiles that drive the scripted conversation in `run.ts`.
Each sheet is the **system prompt for the scripted user** — the LLM that plays the human
answering the oracle, one persona per run.

The oracle under test is the real `buildSystemPrompt()` + `oracleTools`.
These sheets are the *other* side of that conversation.
The point is coverage: every required axis from `specs/eval-harness.md` is exercised by at
least one sheet, so a sweep probes the oracle across the whole space of real users, not
just the easy ones.

## Format

Each sheet is Markdown with a YAML frontmatter block.
`run.ts` parses the frontmatter for structured fields and feeds the Markdown body to the
scripted-user model verbatim.

| Field | Meaning |
|---|---|
| `id` | Kebab-case, equals the filename stem. Stable id used in `runs/*.json`. |
| `axis` | Which required axis this sheet covers (from the list below). |
| `anchor_films` | Catalog film ids the persona genuinely engages with. Ground truth for the c1 "on topic" check and the `selectedFilmIds` gate. May be empty for a mood-led or fully-adversarial sheet. |
| `offcatalog_mentions` | Titles the persona may name that are **not** in the catalog. The oracle must never map these onto a catalog id. A c5 trap. |
| `style` | Free tag describing the register (`terse`, `effusive`, `intense`, …). |
| `turn_cap` | Max user turns before the run is scored a **failure** (oracle never converged). |
| `expects_finalize` | Whether a well-behaved oracle *should* reach `finalizeExperience`. `true` for every sheet here — even the adversarial one, where recovering to a finalize despite the noise is the win. |

## Body sections

Every sheet uses the same five headings so the driver reads them the same way each run:

1. **Axis** — one line restating the axis and why this persona covers it.
2. **Who they are** — the backstory the driver plays.
3. **How they talk** — register and length rules for every reply.
4. **Opening message** — the verbatim first user turn.
5. **Playing this persona** — beat-by-beat guidance: which films to reveal and when, how to
   react to palettes, and the traps to hold (a terse user never elaborates; an adversarial
   user keeps drifting off-topic).
6. **Signals the oracle should pick up** — the films and moods a correct oracle converges
   on. This is the ground truth a human uses to audit the c1 verdict later.

Sheets state only film facts that are well established (characters, setting, director).
Per `AGENTS.md` and the honesty rules, no sheet invents a film detail — an inaccurate
persona would poison the c5 judge it is meant to stress.

## Required axes and coverage

From `specs/eval-harness.md`, at least 10 sheets across these axes:

| Axis | Sheet(s) |
|---|---|
| single-film obsessive | `single-film-uncut-gems`, `single-film-the-witch` |
| multi-film, one **director** | `director-ari-aster`, `director-safdie` |
| multi-film, one **actor** (uses `Film.cast`) | `actor-pattinson`, `actor-collette` |
| mood-led, names no film | `mood-led-no-film` |
| undecided, contradicts themselves | `undecided-contradicts` |
| adversarial: off-topic / non-catalog films | `adversarial-off-topic` |
| terse, one-word answers | `terse-one-word` |
| effusive, over-long answers | `effusive-overlong` |

Eleven sheets, every axis covered at least once.

### A note on the actor axis

No single actor appears in the `cast` of two different catalog films (verified against
`src/data/films.ts`).
So the "multi-film, one actor" axis is realised as: the user is devoted to one actor and
brings up several of *that actor's* films, only one of which is in the catalog.
The test is then whether the oracle uses `Film.cast` to map the actor onto the right single
catalog film **and refuses to fabricate that actor into other catalog films** — which is
exactly the c5 failure mode this axis exists to expose.
Each actor sheet names the off-catalog films in `offcatalog_mentions` so the trap is explicit.

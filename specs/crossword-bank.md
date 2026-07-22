# Spec: The crossword bank must be large enough to make selection meaningful

## Concern

The oracle does not invent crossword words. It selects entry ids from
`src/data/crosswordBank.ts`. The quality of a "personalised" puzzle is therefore
capped by the size and coverage of that bank.

## Background

The bank ships with 14 entries. A puzzle requests 8-10 of them. That is 57-71% of the
entire bank on every single run, regardless of what the user said in conversation, so
two different users get near-identical puzzles.

Four films in `src/data/films.ts` have **zero** bank entries, so a conversation that
lands on those films cannot produce a relevant puzzle at all.

## Requirements

- R1. The bank holds roughly **70 entries**.
- R2. Every film in the approved list below has at least 6 entries.
- R3. Every answer is a single alphabetic token, length > 1, uppercase.
- R4. No duplicate answers, and no duplicate ids.
- R5. Each entry keeps the existing shape: `id`, `filmId`, `word`, `clue`, `difficulty`.
- R6. Clues match the voice of the existing 14 entries: short, factual, spoiler-light.
- R7. `difficulty` is assigned honestly. Lead characters are `easy`; deep-cut props and
  minor characters are `hard`.
- R8. `Film` gains an optional `cast?: string[]` field so puzzles can be built around a
  shared actor, not only a shared film.

## Approved films

Mine only these. Six have shooting scripts in `docs/film-scripts/`:

| filmId | Source |
|---|---|
| moonlight | script |
| hereditary | script |
| midsommar | script |
| lady-bird | script |
| materialists | script |
| the-witch | script |
| good-time | existing entries + general knowledge |
| uncut-gems | existing entries + general knowledge |
| the-backrooms | motifs only — **no cast**, this property has no named ensemble |

**Excluded by explicit decision:** `ex-machina`, `everything-everywhere` (no source
material available), `the-green-knight` (has a script but is not in `films.ts`).

## Mining method

`pdftotext` is installed in the container. Screenplay dialogue cues are ALL-CAPS, so
character names and their prominence fall out of a frequency count:

```bash
pdftotext docs/film-scripts/MOONLIGHT-shooting-script.pdf - \
  | grep -oE '^ *[A-Z][A-Z]{2,11} *$' | tr -d ' ' | sort | uniq -c | sort -rn
```

Frequency doubles as a difficulty signal: a name with 300 cues is a lead (`easy`), one
with 12 is a walk-on (`hard`). Do not stop at character names — objects, places, and
motifs make better clues and interlock better.

## Success criteria

- `bun test` asserts R1 through R5 mechanically.
- Longer, vowel-rich answers are preferred where there is a choice, because they
  interlock better and directly raise the placement rate from `crossword-layout.md`.

## Accuracy rule

Never invent a fact to fill a slot. If you are not confident a name, actor, or plot
detail is correct, leave it out and note the gap in a code comment beside the entry. A wrong clue in a
puzzle aimed at superfans is worse than a smaller bank.

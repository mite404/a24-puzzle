import { describe, expect, test } from "bun:test";
import { crosswordBank } from "@/data/crosswordBank";
import { films } from "@/data/films";

/**
 * Bank integrity — mechanical assertions of spec `crossword-bank.md`:
 *   R3 (every answer is a single alphabetic token, length > 1, uppercase),
 *   R4 (no duplicate answers, no duplicate ids),
 *   and referential integrity (every `filmId` exists in `films.ts`).
 *
 * R2 (>= 10 entries per APPROVED film, issue #15) IS now asserted: the builder split
 * (#16) relies on any single approved film supporting a ~9-word puzzle. The approved set
 * is derived from films.ts MINUS the two films crossword-bank.md excludes for lack of
 * source material — so a genuinely-approved film left at zero entries FAILS, which a
 * bank-only count would silently pass.
 */

const filmIds = new Set(films.map((f) => f.id));

// crossword-bank.md "Approved films": every film in films.ts EXCEPT the two excluded
// by explicit decision for lack of source material. Derived from films.ts (not the
// bank) on purpose, so the R2 floor test catches an approved film left at zero entries.
const EXCLUDED_FROM_MINING = new Set(["ex-machina", "everything-everywhere"]);
const approvedFilmIds = films
  .map((f) => f.id)
  .filter((id) => !EXCLUDED_FROM_MINING.has(id));

describe("crosswordBank integrity", () => {
  test("R3: every answer is a single uppercase alphabetic token, length > 1", () => {
    for (const entry of crosswordBank) {
      // Single token: A–Z only, no spaces, digits, hyphens, or punctuation.
      expect(entry.word).toMatch(/^[A-Z]+$/);
      expect(entry.word.length).toBeGreaterThan(1);
    }
  });

  test("R4: no duplicate answers", () => {
    const words = crosswordBank.map((e) => e.word);
    expect(new Set(words).size).toBe(words.length);
  });

  test("R4: no duplicate ids", () => {
    const ids = crosswordBank.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("every filmId exists in films.ts", () => {
    for (const entry of crosswordBank) {
      expect(filmIds.has(entry.filmId)).toBe(true);
    }
  });

  test("R2 (#15): every approved film has >= 10 entries", () => {
    const perFilm = new Map<string, number>();
    for (const entry of crosswordBank) {
      perFilm.set(entry.filmId, (perFilm.get(entry.filmId) ?? 0) + 1);
    }
    // Iterate the APPROVED set, not just banked films: an approved film with zero
    // entries (get() -> undefined -> 0) must fail. Names offenders on failure.
    const belowFloor = approvedFilmIds.filter((id) => (perFilm.get(id) ?? 0) < 10);
    expect(belowFloor).toEqual([]);
  });
});

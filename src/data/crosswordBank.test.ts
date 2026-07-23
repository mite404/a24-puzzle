import { describe, expect, test } from "bun:test";
import { crosswordBank } from "@/data/crosswordBank";
import { films } from "@/data/films";

/**
 * Bank integrity — mechanical assertions of spec `crossword-bank.md`:
 *   R3 (every answer is a single alphabetic token, length > 1, uppercase),
 *   R4 (no duplicate answers, no duplicate ids),
 *   and referential integrity (every `filmId` exists in `films.ts`).
 *
 * R2 (>= 10 entries per mined film, issue #15) IS now asserted: the builder split
 * (#16) relies on any single film supporting a ~9-word puzzle. This covers every film
 * the bank actually mines — films left unbanked on purpose (ex-machina, EEAAO) are
 * exempt, but once a film has any entry it must reach the floor.
 */

const filmIds = new Set(films.map((f) => f.id));

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

  test("R2 (#15): every mined film has >= 10 entries", () => {
    const perFilm = new Map<string, number>();
    for (const entry of crosswordBank) {
      perFilm.set(entry.filmId, (perFilm.get(entry.filmId) ?? 0) + 1);
    }
    // Name the offenders on failure instead of an opaque number mismatch.
    const belowFloor = [...perFilm.entries()].filter(([, count]) => count < 10);
    expect(belowFloor).toEqual([]);
  });
});

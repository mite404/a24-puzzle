import { describe, expect, test } from "bun:test";
import { crosswordBank } from "@/data/crosswordBank";
import { films } from "@/data/films";

/**
 * Bank integrity — mechanical assertions of spec `crossword-bank.md`:
 *   R3 (every answer is a single alphabetic token, length > 1, uppercase),
 *   R4 (no duplicate answers, no duplicate ids),
 *   and referential integrity (every `filmId` exists in `films.ts`).
 *
 * R1 (~70 entries) and R2 (>= 6 per approved film) are NOT asserted here: the bank
 * is still being mined (IMPLEMENTATION_PLAN.md Phase 3), so those come later. These
 * checks must hold on every entry the bank ever carries, current or added.
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
});

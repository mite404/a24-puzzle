import { describe, expect, test } from "bun:test";
import { crosswordBank } from "@/data/crosswordBank";
import type { ExperienceProfile } from "@/lib/types";
import { buildGamePayload } from "@/lib/game";

/**
 * Characterization tests: these document what `buildGamePayload` does *today*.
 * They assert current behaviour, not desired behaviour. See IMPLEMENTATION_PLAN.md
 * Phase 1 — no fixes here.
 */

/** A profile with five valid crossword ids and three valid location ids, so that
 * neither the crossword (< 4) nor the location (< 3) top-up path is triggered. */
function baseProfile(overrides: Partial<ExperienceProfile> = {}): ExperienceProfile {
  return {
    selectedFilmIds: ["uncut-gems"],
    moods: ["anxious"],
    crosswordWordIds: ["cw-sandler", "cw-opal", "cw-howard", "cw-garnett", "cw-safdie"],
    locationIds: ["ug-diamond-district", "ug-midtown", "ug-les"],
    ...overrides,
  };
}

describe("buildGamePayload", () => {
  test("returns the profile it was given, unchanged", () => {
    const profile = baseProfile();
    const payload = buildGamePayload(profile);
    expect(payload.profile).toBe(profile);
  });

  test("returns a non-empty list of location questions, each with 4 options", () => {
    const payload = buildGamePayload(baseProfile());
    expect(Array.isArray(payload.locations)).toBe(true);
    expect(payload.locations.length).toBeGreaterThan(0);
    for (const q of payload.locations) {
      expect(q.location).toBeDefined();
      // one correct film id plus three distractors
      expect(q.options).toHaveLength(4);
      expect(q.options).toContain(q.location.filmId);
    }
  });

  test("returns a crossword layout with rows, cols, and a words array", () => {
    const payload = buildGamePayload(baseProfile());
    const crossword = payload.crossword;
    expect(crossword).not.toBeNull();
    if (!crossword) throw new Error("crossword layout was null");
    expect(typeof crossword.rows).toBe("number");
    expect(typeof crossword.cols).toBe("number");
    expect(Array.isArray(crossword.words)).toBe(true);
  });

  test("returns crosswordWords: the resolved bank entries for the requested ids", () => {
    const payload = buildGamePayload(baseProfile());
    const ids = payload.crosswordWords.map((e) => e.id);
    expect(ids).toEqual(["cw-sandler", "cw-opal", "cw-howard", "cw-garnett", "cw-safdie"]);
    // every returned entry is a real bank entry
    for (const entry of payload.crosswordWords) {
      expect(crosswordBank).toContainEqual(entry);
    }
  });
});

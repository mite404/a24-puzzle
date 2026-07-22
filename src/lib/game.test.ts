import { describe, expect, test } from "bun:test";
import { crosswordBank, getCrosswordEntry } from "@/data/crosswordBank";
import type { ExperienceProfile, PlacedWord } from "@/lib/types";
import { buildGamePayload, pickAlternateCrosswordIds } from "@/lib/game";

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

/**
 * `resolveCrosswordEntries` is not exported; `buildGamePayload` surfaces its result
 * as `payload.crosswordWords`. These characterization tests pin down the resolve +
 * top-up behaviour recorded in RALPH_NOTES.md: it tops up only when fewer than 4 ids
 * resolve, walking the bank in order up to 8 entries, and it neither validates ids
 * (unknown ones are silently dropped) nor removes duplicates.
 */
describe("buildGamePayload — resolveCrosswordEntries via crosswordWords", () => {
  test("zero ids tops up to the first 8 bank entries, in bank order", () => {
    const payload = buildGamePayload(baseProfile({ crosswordWordIds: [] }));
    expect(payload.crosswordWords).toEqual(crosswordBank.slice(0, 8));
  });

  test("five valid ids resolve to exactly those five, with no top-up", () => {
    const ids = ["cw-sandler", "cw-opal", "cw-howard", "cw-garnett", "cw-safdie"];
    const payload = buildGamePayload(baseProfile({ crosswordWordIds: ids }));
    expect(payload.crosswordWords.map((e) => e.id)).toEqual(ids);
  });

  test("unknown ids are dropped, then the empty set tops up to 8 bank entries", () => {
    const payload = buildGamePayload(
      baseProfile({ crosswordWordIds: ["nope", "still-not-real", "ghost"] }),
    );
    expect(payload.crosswordWords).toEqual(crosswordBank.slice(0, 8));
  });

  test("valid ids below the top-up threshold are kept, then padded to 8", () => {
    const payload = buildGamePayload(
      baseProfile({ crosswordWordIds: ["cw-eggers", "made-up-id", "cw-paimon"] }),
    );
    const ids = payload.crosswordWords.map((e) => e.id);
    // the two resolvable ids survive; the unknown one is gone
    expect(ids).toContain("cw-eggers");
    expect(ids).toContain("cw-paimon");
    expect(ids).not.toContain("made-up-id");
    // fewer than 4 resolved, so top-up fills to 8
    expect(payload.crosswordWords).toHaveLength(8);
    // top-up never re-adds an id already present
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("duplicate ids are preserved, not deduped (>= 4 entries, so no top-up)", () => {
    const ids = ["cw-sandler", "cw-sandler", "cw-opal", "cw-howard"];
    const payload = buildGamePayload(baseProfile({ crosswordWordIds: ids }));
    expect(payload.crosswordWords.map((e) => e.id)).toEqual(ids);
  });
});

/**
 * Grid integrity: for whatever grid the (deterministic) generator produces, the placed
 * words must be internally consistent. These pin spec `crossword-layout.md`:
 *   R2 — every placed word carries the id of the bank entry it came from.
 *   R3 — no duplicate ids in a single layout.
 *   R4 — every placed word fits inside the reported rows x cols bounds.
 *   R5 — where two words cross, both agree on the shared letter.
 * (R1 "at least 8 placed" and R6 "dropped words observable" are Phase 2, not here.)
 */

/** The 1-indexed (col, row) cell each letter of a placed word occupies. */
function cellsOf(word: PlacedWord): Array<{ x: number; y: number; letter: string }> {
  return [...word.answer].map((letter, k) => ({
    x: word.orientation === "across" ? word.startx + k : word.startx,
    y: word.orientation === "down" ? word.starty + k : word.starty,
    letter,
  }));
}

/** A grid dense enough to force crossings: the whole 14-entry bank. */
function fullBankPayload() {
  return buildGamePayload(baseProfile({ crosswordWordIds: crosswordBank.map((e) => e.id) }));
}

describe("buildGamePayload — grid integrity (crossword-layout.md R2–R5)", () => {
  test("R2: every placed word carries the id of a real bank entry with a matching answer", () => {
    const payload = fullBankPayload();
    const words = payload.crossword?.words ?? [];
    expect(words.length).toBeGreaterThan(0);
    for (const w of words) {
      // the id must belong to an entry that was actually resolved into this puzzle...
      const entry = payload.crosswordWords.find((e) => e.id === w.id);
      expect(entry).toBeDefined();
      // ...and that entry's answer must be the placed answer (no id/answer mismatch)
      expect(entry?.word.toUpperCase()).toBe(w.answer);
    }
  });

  test("R3: no duplicate ids appear in a single layout", () => {
    const payload = fullBankPayload();
    const ids = (payload.crossword?.words ?? []).map((w) => w.id);
    expect(ids.length).toBeGreaterThan(0);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("R4: every placed word fits inside the reported rows x cols bounds", () => {
    const payload = fullBankPayload();
    const crossword = payload.crossword;
    expect(crossword).not.toBeNull();
    if (!crossword) throw new Error("crossword layout was null");
    expect(crossword.words.length).toBeGreaterThan(0);
    for (const w of crossword.words) {
      for (const cell of cellsOf(w)) {
        expect(cell.x).toBeGreaterThanOrEqual(1);
        expect(cell.y).toBeGreaterThanOrEqual(1);
        expect(cell.x).toBeLessThanOrEqual(crossword.cols);
        expect(cell.y).toBeLessThanOrEqual(crossword.rows);
      }
    }
  });

  test("R5: where two words cross, both agree on the shared letter", () => {
    const payload = fullBankPayload();
    const words = payload.crossword?.words ?? [];
    expect(words.length).toBeGreaterThan(0);
    const occupied = new Map<string, string>();
    let crossings = 0;
    for (const w of words) {
      for (const cell of cellsOf(w)) {
        const key = `${cell.x},${cell.y}`;
        const existing = occupied.get(key);
        if (existing === undefined) {
          occupied.set(key, cell.letter);
        } else {
          // a shared cell is a crossing (or an overlap); the letters must match
          expect(cell.letter).toBe(existing);
          crossings++;
        }
      }
    }
    // a connected puzzle of this size must actually have crossings, else R5 is vacuous
    expect(crossings).toBeGreaterThan(0);
  });
});

/**
 * `pickAlternateCrosswordIds` is the *client-side* fallback used when the regenerate
 * API is unavailable: given a profile, a set of ids to avoid, and a target `count`, it
 * returns a fresh id set. Its only randomness is `shuffle` (Math.random), so these
 * characterization tests assert only properties that hold for *every* shuffle outcome.
 *
 * Behaviour pinned down here (see RALPH_NOTES.md "Known constraints"):
 *   - `excludeIds` is honoured while at least 4 non-excluded entries remain.
 *   - entries whose `filmId` is in `profile.selectedFilmIds` are preferred: they sort
 *     ahead of the rest, so they always land in the first `count` slots.
 *   - when exclusion leaves fewer than 4 entries the top-up loop fills back up to
 *     `count` from the *whole* bank, ignoring `excludeIds` — best-effort, not a guarantee.
 *   - the result never contains duplicate ids.
 */
describe("pickAlternateCrosswordIds", () => {
  const allBankIds = crosswordBank.map((e) => e.id);
  // baseProfile.selectedFilmIds is ["uncut-gems"]; these are its five bank entries.
  const uncutGemsIds = crosswordBank
    .filter((e) => e.filmId === "uncut-gems")
    .map((e) => e.id);

  test("excluded ids do not reappear while enough entries remain", () => {
    const excludeIds = ["cw-sandler", "cw-opal", "cw-howard"];
    const picked = pickAlternateCrosswordIds(baseProfile(), excludeIds);
    for (const id of excludeIds) {
      expect(picked).not.toContain(id);
    }
    // 14 - 3 = 11 available, so the default count of 8 fills without top-up
    expect(picked).toHaveLength(8);
  });

  test("returns no duplicate ids", () => {
    const picked = pickAlternateCrosswordIds(baseProfile(), []);
    expect(new Set(picked).size).toBe(picked.length);
  });

  test("prefers entries whose film is in selectedFilmIds", () => {
    // count 5 == number of uncut-gems entries, so the slice is exactly the preferred set
    const picked = pickAlternateCrosswordIds(baseProfile(), [], 5);
    expect(picked).toHaveLength(5);
    for (const id of picked) {
      expect(getCrosswordEntry(id)?.filmId).toBe("uncut-gems");
    }
  });

  test("preferred entries always land in the first count slots", () => {
    // default count 8 > 5 preferred, so all five uncut-gems ids must appear
    const picked = pickAlternateCrosswordIds(baseProfile(), []);
    for (const id of uncutGemsIds) {
      expect(picked).toContain(id);
    }
  });

  test("degrades sanely when the bank is nearly exhausted", () => {
    // exclude everything except two entries from films NOT in selectedFilmIds
    const keep = ["cw-chiron", "cw-maypole"];
    const excludeIds = allBankIds.filter((id) => !keep.includes(id));
    const picked = pickAlternateCrosswordIds(baseProfile(), excludeIds);
    // still returns a full playable set, top-up fills back to count
    expect(picked).toHaveLength(8);
    expect(new Set(picked).size).toBe(picked.length);
    // the two survivors are present...
    for (const id of keep) {
      expect(picked).toContain(id);
    }
    // ...and the top-up ignores excludeIds, so previously-excluded ids reappear
    const reused = picked.filter((id) => excludeIds.includes(id));
    expect(reused.length).toBeGreaterThan(0);
  });

  test("excluding the entire bank still returns count valid ids (exclude is best-effort)", () => {
    const picked = pickAlternateCrosswordIds(baseProfile(), allBankIds);
    expect(picked).toHaveLength(8);
    expect(new Set(picked).size).toBe(picked.length);
    for (const id of picked) {
      expect(getCrosswordEntry(id)).toBeDefined();
    }
  });
});

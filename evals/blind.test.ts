import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  blindClues,
  buildBlindRecord,
  computeBlindId,
  loadOrCreateSalt,
  loadRunRecords,
  planBlinding,
  renderAsciiGrid,
  type BlindKey,
  type BlindRecord,
} from "./blind";
import { runFileName, type RunRecord } from "./run";
import type { CrosswordLayout, PlacedWord } from "@/lib/types";

// A tiny 2-word crossing that shares the letter A at cell (col2,row1):
//   D A N I     -> DANI across at (col1,row1); its A is at (col2,row1)
//   . R . .
//   . N . .     -> ARNO down at (col2,row1);  its A is at (col2,row1)
//   . O . .
const DANI: PlacedWord = {
  id: "cw-dani",
  answer: "DANI",
  clue: "Grieving protagonist crowned May Queen",
  startx: 1,
  starty: 1,
  orientation: "across",
  position: 1,
};
const ARNO: PlacedWord = {
  id: "cw-arno",
  answer: "ARNO",
  clue: "Loan shark to whom the jeweller owes a mounting debt",
  startx: 2,
  starty: 1,
  orientation: "down",
  position: 2,
};

const LAYOUT: CrosswordLayout = {
  rows: 4,
  cols: 4,
  words: [DANI, ARNO],
  droppedIds: [],
};

function makeRun(overrides: Partial<RunRecord> = {}): RunRecord {
  return {
    persona: "director-ari-aster",
    axis: "multi-film one director",
    arm: "baseline",
    runIndex: 2,
    oracleModel: "moonshotai/kimi-k2.6",
    userModel: "moonshotai/kimi-k2.6",
    turnCap: 10,
    expectsFinalize: true,
    anchorFilms: ["hereditary", "midsommar"],
    offcatalogMentions: [],
    finalized: true,
    reachedCap: false,
    userTurns: 5,
    transcript: [
      { role: "user", text: "I love Ari Aster." },
      { role: "oracle", text: "Which one grabbed you?" },
    ],
    profile: {
      selectedFilmIds: ["midsommar"],
      moods: ["dread"],
      crosswordWordIds: ["cw-dani", "cw-arno"],
      locationIds: [],
    },
    crossword: LAYOUT,
    crosswordWords: [
      {
        id: "cw-dani",
        filmId: "midsommar",
        word: "DANI",
        clue: DANI.clue,
        difficulty: "easy",
      },
      {
        id: "cw-arno",
        filmId: "uncut-gems",
        word: "ARNO",
        clue: ARNO.clue,
        difficulty: "medium",
      },
    ],
    gates: {
      finalizeCalled: { pass: true, detail: "" },
      idsExistInBank: { pass: true, detail: "" },
      wordsPlaced: { pass: false, detail: "" },
      noDuplicateIds: { pass: true, detail: "" },
      selectedFilmShare: { pass: true, detail: "" },
      distinctDifficulty: { pass: true, detail: "" },
      gridFillDensity: 0.32,
      passed: false,
    },
    error: null,
    finishedAt: "2026-07-22T00:00:00.000Z",
    ...overrides,
  };
}

describe("computeBlindId", () => {
  test("is deterministic for the same salt and identity", () => {
    expect(computeBlindId("salt-a", "x__baseline__run1")).toBe(
      computeBlindId("salt-a", "x__baseline__run1"),
    );
  });

  test("changes with the salt (non-reversible without the key)", () => {
    const a = computeBlindId("salt-a", "x__baseline__run1");
    const b = computeBlindId("salt-b", "x__baseline__run1");
    expect(a).not.toBe(b);
  });

  test("distinguishes arm and run index of the same persona", () => {
    const salt = "s";
    const ids = new Set([
      computeBlindId(salt, "p__baseline__run1"),
      computeBlindId(salt, "p__baseline__run2"),
      computeBlindId(salt, "p__variant__run1"),
    ]);
    expect(ids.size).toBe(3);
  });

  test("does not embed the identity in cleartext", () => {
    const id = computeBlindId("s", "director-ari-aster__baseline__run2");
    expect(id).not.toContain("aster");
    expect(id).toMatch(/^[0-9a-f]{12}$/);
  });
});

describe("renderAsciiGrid", () => {
  test("places letters at their coordinates and dots elsewhere", () => {
    const grid = renderAsciiGrid(LAYOUT);
    const lines = grid.split("\n");
    expect(lines).toHaveLength(4);
    // DANI runs across row 1 from column 1; ARNO runs down column 2 from row 1.
    expect(lines[0]).toBe("D A N I");
    expect(lines[1]).toBe(". R . .");
    expect(lines[3]).toBe(". O . .");
  });

  test("crossing words share one consistent cell", () => {
    // DANI's second letter and ARNO's first letter both occupy (col2,row1) = 'A'.
    const grid = renderAsciiGrid(LAYOUT);
    expect(grid.split("\n")[0]).toBe("D A N I");
  });

  test("returns a placeholder when there is no puzzle", () => {
    expect(renderAsciiGrid(null)).toBe("(no puzzle was generated)");
    expect(
      renderAsciiGrid({ rows: 0, cols: 0, words: [], droppedIds: [] }),
    ).toBe("(no puzzle was generated)");
  });
});

describe("blindClues", () => {
  test("emits numbered clues with upper-cased answers, ordered", () => {
    const clues = blindClues(LAYOUT);
    expect(clues).toHaveLength(2);
    // sorted by grid number: DANI is 1-across, ARNO is 2-down.
    expect(clues[0].number).toBe(1);
    expect(clues[0].orientation).toBe("across");
    expect(clues[0].answer).toBe("DANI");
    expect(clues[1].number).toBe(2);
    expect(clues[1].orientation).toBe("down");
    expect(clues[1].answer).toBe("ARNO");
  });

  test("is empty for a null layout", () => {
    expect(blindClues(null)).toEqual([]);
  });
});

describe("buildBlindRecord", () => {
  test("carries only what the judge may see — no identity fields", () => {
    const record: BlindRecord = buildBlindRecord(makeRun(), "abc123");
    const keys = Object.keys(record).sort();
    expect(keys).toEqual(["blindId", "clues", "grid", "transcript", "words"]);
  });

  test("serialised blinded record leaks no identity string", () => {
    const record = buildBlindRecord(makeRun(), "abc123");
    const json = JSON.stringify(record);
    // persona name, axis, arm, and the run index must all be absent.
    expect(json).not.toContain("director-ari-aster");
    expect(json).not.toContain("baseline");
    expect(json).not.toContain("multi-film");
    // it must NOT expose per-word filmId or difficulty (c1/c3/c5 ground truth).
    expect(json).not.toContain("filmId");
    expect(json).not.toContain("difficulty");
    expect(json).not.toContain("uncut-gems");
  });

  test("keeps the transcript, the word set, and the grid", () => {
    const record = buildBlindRecord(makeRun(), "abc123");
    expect(record.transcript).toHaveLength(2);
    expect(record.words).toEqual(["DANI", "ARNO"]);
    expect(record.grid.split("\n")).toHaveLength(4);
  });

  test("a run that never finalized still yields a scoreable record", () => {
    const record = buildBlindRecord(
      makeRun({ finalized: false, crossword: null, crosswordWords: [] }),
      "def456",
    );
    expect(record.words).toEqual([]);
    expect(record.clues).toEqual([]);
    expect(record.grid).toBe("(no puzzle was generated)");
  });
});

describe("planBlinding", () => {
  test("produces one key entry per run with the real identity", () => {
    const plan = planBlinding([makeRun()], "s");
    expect(plan).toHaveLength(1);
    expect(plan[0].key).toMatchObject({
      runFile: runFileName("director-ari-aster", "baseline", 2),
      persona: "director-ari-aster",
      arm: "baseline",
      runIndex: 2,
      finalized: true,
      gatesPassed: false,
    });
  });

  test("the blindId ties the blinded record to its key entry", () => {
    const plan = planBlinding([makeRun()], "s");
    expect(plan[0].blind.blindId).toBe(plan[0].blindId);
  });

  test("throws on a blindId collision", () => {
    // Two records with the same identity hash to the same id.
    const a = makeRun();
    const b = makeRun();
    expect(() => planBlinding([a, b], "s")).toThrow(/collision/);
  });
});

describe("filesystem round-trip", () => {
  test("loadOrCreateSalt mints then reuses a stable salt", () => {
    const dir = mkdtempSync(join(tmpdir(), "blind-salt-"));
    const keyFile = join(dir, "key.json");
    const first = loadOrCreateSalt(keyFile);
    expect(first).toMatch(/^[0-9a-f]{32}$/);
    // Persist a key.json carrying that salt, then confirm it is reused verbatim.
    const key: BlindKey = { salt: first, generatedAt: "t", entries: {} };
    writeFileSync(keyFile, JSON.stringify(key));
    expect(loadOrCreateSalt(keyFile)).toBe(first);
  });

  test("loadRunRecords reads and parses every run file, sorted", () => {
    const dir = mkdtempSync(join(tmpdir(), "blind-runs-"));
    writeFileSync(
      join(dir, runFileName("p", "baseline", 1)),
      JSON.stringify(makeRun({ persona: "p", runIndex: 1 })),
    );
    writeFileSync(
      join(dir, runFileName("p", "baseline", 2)),
      JSON.stringify(makeRun({ persona: "p", runIndex: 2 })),
    );
    writeFileSync(join(dir, "notes.txt"), "ignored");
    const loaded = loadRunRecords(dir);
    expect(loaded).toHaveLength(2);
    expect(loaded[0].record.runIndex).toBe(1);
    expect(loaded[1].record.runIndex).toBe(2);
  });

  test("blinded files are named by hash, hiding identity order", () => {
    const dir = mkdtempSync(join(tmpdir(), "blind-out-"));
    const plan = planBlinding(
      [
        makeRun({ persona: "aaa-first", runIndex: 1 }),
        makeRun({ persona: "zzz-last", runIndex: 1 }),
      ],
      "salt",
    );
    for (const item of plan) {
      writeFileSync(
        join(dir, `${item.blindId}.json`),
        JSON.stringify(item.blind),
      );
    }
    const names = readdirSync(dir);
    expect(names).toHaveLength(2);
    // File names are 12-hex-char hashes, not "aaa-first"/"zzz-last".
    for (const name of names) {
      expect(name).toMatch(/^[0-9a-f]{12}\.json$/);
    }
    // The key would carry the real personas, but the blinded files do not.
    const bodies = names.map((n) =>
      readFileSync(join(dir, n), "utf8"),
    );
    for (const body of bodies) {
      expect(body).not.toContain("aaa-first");
      expect(body).not.toContain("zzz-last");
    }
  });
});

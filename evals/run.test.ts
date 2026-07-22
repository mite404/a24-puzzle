import { describe, expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  cellIsDone,
  describeGateFailures,
  driveConversation,
  evaluateGates,
  extractSection,
  gatedOutcomes,
  listPersonaFiles,
  loadAllPersonas,
  loadPersonaSheet,
  parsePersonaSheet,
  renderOracleTurn,
  runFileName,
  type GateInput,
  type OracleStepResult,
} from "./run";
import { crosswordBank } from "@/data/crosswordBank";
import { buildGamePayload } from "@/lib/game";
import type {
  CrosswordEntry,
  ExperienceProfile,
  PlacedWord,
} from "@/lib/types";

const PERSONAS_DIR = join(import.meta.dir, "personas");

const SAMPLE = `---
id: sample-persona
axis: single-film obsessive
anchor_films: [uncut-gems, good-time]
offcatalog_mentions: []
style: intense
turn_cap: 9
expects_finalize: true
---

## Axis

One line.

## Opening message

I need to talk about Uncut Gems.

## Playing this persona

Loop back to the film.
`;

describe("parsePersonaSheet", () => {
  test("parses frontmatter scalars, arrays, and the opening message", () => {
    const sheet = parsePersonaSheet(SAMPLE, "fallback");
    expect(sheet.id).toBe("sample-persona");
    expect(sheet.axis).toBe("single-film obsessive");
    expect(sheet.anchorFilms).toEqual(["uncut-gems", "good-time"]);
    expect(sheet.offcatalogMentions).toEqual([]);
    expect(sheet.style).toBe("intense");
    expect(sheet.turnCap).toBe(9);
    expect(sheet.expectsFinalize).toBe(true);
    expect(sheet.openingMessage).toBe("I need to talk about Uncut Gems.");
    // Body is preserved verbatim for the scripted-user system prompt.
    expect(sheet.body).toContain("## Playing this persona");
  });

  test("throws when the opening message section is missing", () => {
    const noOpening = SAMPLE.replace("## Opening message", "## Something else");
    expect(() => parsePersonaSheet(noOpening, "x")).toThrow(/Opening message/);
  });

  test("throws on a non-numeric turn_cap", () => {
    const bad = SAMPLE.replace("turn_cap: 9", "turn_cap: soon");
    expect(() => parsePersonaSheet(bad, "x")).toThrow(/turn_cap/);
  });
});

describe("extractSection", () => {
  test("returns the section body up to the next heading", () => {
    expect(extractSection(SAMPLE, "Opening message")).toBe(
      "I need to talk about Uncut Gems.",
    );
  });

  test("returns empty string for an absent section", () => {
    expect(extractSection(SAMPLE, "Nope")).toBe("");
  });
});

describe("persona sheets on disk", () => {
  test("listPersonaFiles finds sheets and excludes README", () => {
    const files = listPersonaFiles(PERSONAS_DIR);
    expect(files.length).toBeGreaterThanOrEqual(10);
    expect(files).not.toContain("README.md");
    expect(files.every((f) => f.endsWith(".md"))).toBe(true);
  });

  test("every real persona sheet parses and satisfies the sheet contract", () => {
    const personas = loadAllPersonas(PERSONAS_DIR);
    expect(personas.length).toBeGreaterThanOrEqual(10);
    for (const p of personas) {
      expect(p.id).toBeTruthy();
      expect(p.axis).toBeTruthy();
      expect(p.style).toBeTruthy();
      expect(p.turnCap).toBeGreaterThan(0);
      expect(p.openingMessage.length).toBeGreaterThan(0);
      expect(p.body).toContain("## Playing this persona");
    }
  });

  test("loadPersonaSheet reads the uncut-gems sheet correctly", () => {
    const sheet = loadPersonaSheet(
      join(PERSONAS_DIR, "single-film-uncut-gems.md"),
    );
    expect(sheet.id).toBe("single-film-uncut-gems");
    expect(sheet.anchorFilms).toEqual(["uncut-gems"]);
    expect(sheet.turnCap).toBe(12);
    expect(sheet.openingMessage).toContain("Uncut Gems");
  });
});

describe("renderOracleTurn", () => {
  test("combines text and a palette note", () => {
    const r: OracleStepResult = {
      text: "How does this feel?",
      palette: { filmId: "midsommar", promptText: "Does this match today?" },
    };
    const out = renderOracleTurn(r);
    expect(out).toContain("How does this feel?");
    expect(out).toContain("midsommar");
    expect(out).toContain("Does this match today?");
  });

  test("falls back when the oracle produced nothing", () => {
    expect(renderOracleTurn({ text: "   " })).toBe("[the oracle said nothing]");
  });
});

const PROFILE: ExperienceProfile = {
  selectedFilmIds: ["uncut-gems"],
  moods: ["anxious"],
  crosswordWordIds: ["cw-howard", "cw-kmh"],
  locationIds: ["loc-diamond-district"],
};

describe("driveConversation", () => {
  test("finalize path: ends when the oracle finalizes, captures the profile", async () => {
    let oracleCalls = 0;
    const result = await driveConversation({
      openingMessage: "opening",
      turnCap: 12,
      oracleStep: async () => {
        oracleCalls += 1;
        // First oracle turn just talks; second finalizes.
        return oracleCalls >= 2
          ? { text: "Building it now.", finalize: PROFILE }
          : { text: "Tell me more." };
      },
      userStep: async () => "still Uncut Gems",
    });

    expect(result.finalized).toBe(true);
    expect(result.reachedCap).toBe(false);
    expect(result.profile).toEqual(PROFILE);
    // user, oracle, user, oracle — strict alternation, oracle finalizes last.
    expect(result.transcript.map((t) => t.role)).toEqual([
      "user",
      "oracle",
      "user",
      "oracle",
    ]);
    expect(result.transcript[0]).toEqual({ role: "user", text: "opening" });
  });

  test("cap path: an oracle that never finalizes trips the turn cap as a failure", async () => {
    let userCalls = 0;
    const result = await driveConversation({
      openingMessage: "hi",
      turnCap: 2,
      oracleStep: async () => ({ text: "still probing" }),
      userStep: async () => {
        userCalls += 1;
        return `reply ${userCalls}`;
      },
    });

    expect(result.finalized).toBe(false);
    expect(result.reachedCap).toBe(true);
    expect(result.profile).toBeNull();
    expect(result.userTurns).toBe(2);
  });

  test("a palette shown by the oracle appears in the transcript", async () => {
    let oracleCalls = 0;
    const result = await driveConversation({
      openingMessage: "start",
      turnCap: 12,
      oracleStep: async () => {
        oracleCalls += 1;
        if (oracleCalls === 1) {
          return {
            text: "",
            palette: { filmId: "the-witch", promptText: "This mood?" },
          };
        }
        return { text: "done", finalize: PROFILE };
      },
      userStep: async () => "reacting to colors",
    });

    const oracleTurns = result.transcript.filter((t) => t.role === "oracle");
    expect(oracleTurns[0].text).toContain("the-witch");
  });
});

describe("resumability helpers", () => {
  test("runFileName encodes persona, arm, and run index", () => {
    expect(runFileName("terse-one-word", "baseline", 3)).toBe(
      "terse-one-word__baseline__run3.json",
    );
  });

  test("cellIsDone is false for a missing file", () => {
    expect(cellIsDone(import.meta.dir, "does-not-exist__baseline__run1.json")).toBe(
      false,
    );
  });

  test("cellIsDone is false for an errored run — a transient failure is retriable", () => {
    // run.ts writes a record even when runCell catches an exception (empty
    // transcript, error message). If cellIsDone treated that as done, a transient
    // API error like "Invalid JSON response" would be baked in permanently and
    // never retried, poisoning the sweep's per-block results.
    const dir = mkdtempSync(join(tmpdir(), "ralph-cell-"));
    const name = "sample__baseline__run1.json";
    writeFileSync(
      join(dir, name),
      JSON.stringify({
        persona: "sample",
        finalized: false,
        reachedCap: false,
        transcript: [],
        profile: null,
        error: "Invalid JSON response",
      }),
    );
    expect(cellIsDone(dir, name)).toBe(false);
  });

  test("cellIsDone is true for a clean run that tripped the turn cap (error null)", () => {
    // A cap-tripped run is a legitimate, completed data point (the oracle failed
    // to finalize) — NOT an exception. It must stay done so it is not re-run.
    const dir = mkdtempSync(join(tmpdir(), "ralph-cell-"));
    const name = "sample__baseline__run2.json";
    writeFileSync(
      join(dir, name),
      JSON.stringify({
        persona: "sample",
        finalized: false,
        reachedCap: true,
        transcript: [{ role: "user", text: "hi" }],
        profile: null,
        error: null,
      }),
    );
    expect(cellIsDone(dir, name)).toBe(true);
  });
});

// Real bank entries for uncut-gems — 10 of them, spanning easy/medium/hard, so a
// synthetic "all placed from selected film" grid passes every gate by construction.
const UNCUT_GEMS = crosswordBank.filter((e) => e.filmId === "uncut-gems");

/** Narrow away null without a forbidden `!` assertion (lint bans non-null assertions). */
function must<T>(value: T | null | undefined): T {
  if (value == null) throw new Error("expected a non-null value in the test fixture");
  return value;
}

/** Build a synthetic finished-run gate input from a list of resolved bank entries. */
function gateInputFrom(
  entries: CrosswordEntry[],
  selectedFilmIds: string[],
): GateInput {
  const words: PlacedWord[] = entries.map((e, i) => ({
    id: e.id,
    answer: e.word,
    clue: e.clue,
    startx: 1,
    starty: i + 1,
    orientation: "across",
    position: i + 1,
  }));
  return {
    finalized: true,
    profile: {
      selectedFilmIds,
      moods: [],
      crosswordWordIds: entries.map((e) => e.id),
      locationIds: [],
    },
    crossword: { rows: 20, cols: 20, words, droppedIds: [] },
    crosswordWords: entries,
  };
}

describe("evaluateGates", () => {
  test("a full, on-topic, mixed-difficulty grid passes every gate", () => {
    const report = evaluateGates(gateInputFrom(UNCUT_GEMS, ["uncut-gems"]));
    expect(report.passed).toBe(true);
    for (const { outcome } of gatedOutcomes(report)) {
      expect(outcome.pass).toBe(true);
    }
    // Density is recorded (occupied cells / rows*cols) and lies in (0, 1].
    const density = report.gridFillDensity;
    expect(typeof density).toBe("number");
    expect(density as number).toBeGreaterThan(0);
    expect(density as number).toBeLessThanOrEqual(1);
  });

  test("no finalize fails the finalize gate and the whole report", () => {
    const report = evaluateGates({
      finalized: false,
      profile: null,
      crossword: null,
      crosswordWords: [],
    });
    expect(report.finalizeCalled.pass).toBe(false);
    expect(report.passed).toBe(false);
    expect(report.gridFillDensity).toBeNull();
  });

  test("a returned id that is not in the bank fails the ids-exist gate", () => {
    const input = gateInputFrom(UNCUT_GEMS, ["uncut-gems"]);
    const profile = must(input.profile);
    profile.crosswordWordIds = [...profile.crosswordWordIds, "cw-not-a-real-id"];
    const report = evaluateGates(input);
    expect(report.idsExistInBank.pass).toBe(false);
    expect(report.idsExistInBank.detail).toContain("cw-not-a-real-id");
    expect(report.passed).toBe(false);
  });

  test("fewer than 8 placed words fails the words-placed gate", () => {
    const report = evaluateGates(
      gateInputFrom(UNCUT_GEMS.slice(0, 5), ["uncut-gems"]),
    );
    expect(report.wordsPlaced.pass).toBe(false);
    expect(report.passed).toBe(false);
  });

  test("a repeated id among placed words fails the duplicate gate", () => {
    const input = gateInputFrom(UNCUT_GEMS, ["uncut-gems"]);
    const words = must(input.crossword).words;
    words.push({ ...words[0], starty: 15 });
    const report = evaluateGates(input);
    expect(report.noDuplicateIds.pass).toBe(false);
    expect(report.passed).toBe(false);
  });

  test("under 60% of placed words from selected films fails the share gate", () => {
    // Placed words are all uncut-gems, but the user selected a different film.
    const report = evaluateGates(gateInputFrom(UNCUT_GEMS, ["good-time"]));
    expect(report.selectedFilmShare.pass).toBe(false);
    expect(report.passed).toBe(false);
  });

  test("a single difficulty level fails the difficulty-mix gate", () => {
    const flattened = UNCUT_GEMS.map((e) => ({ ...e, difficulty: "easy" as const }));
    const report = evaluateGates(gateInputFrom(flattened, ["uncut-gems"]));
    expect(report.distinctDifficulty.pass).toBe(false);
    expect(report.passed).toBe(false);
  });

  test("describeGateFailures lists only the failed gates by label", () => {
    const report = evaluateGates(gateInputFrom(UNCUT_GEMS, ["good-time"]));
    const summary = describeGateFailures(report);
    expect(summary).toContain("selected-share");
    expect(summary).not.toContain("finalize (");
    expect(summary).not.toContain("words-placed");
  });
});

describe("evaluateGates on a real generated grid", () => {
  test("a profile requesting 10 uncut-gems ids passes the structural gates", () => {
    const profile: ExperienceProfile = {
      selectedFilmIds: ["uncut-gems"],
      moods: ["anxious"],
      crosswordWordIds: UNCUT_GEMS.map((e) => e.id),
      locationIds: [],
    };
    const payload = buildGamePayload(profile);
    const report = evaluateGates({
      finalized: true,
      profile,
      crossword: payload.crossword,
      crosswordWords: payload.crosswordWords,
    });
    // >= 10 requested reliably lands >= 8 (RALPH_NOTES fuzz measurement).
    expect(report.wordsPlaced.pass).toBe(true);
    expect(report.noDuplicateIds.pass).toBe(true);
    expect(report.selectedFilmShare.pass).toBe(true);
    const density = report.gridFillDensity;
    expect(typeof density).toBe("number");
    expect(density as number).toBeGreaterThan(0);
    expect(density as number).toBeLessThanOrEqual(1);
  });
});

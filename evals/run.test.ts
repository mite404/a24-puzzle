import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import {
  cellIsDone,
  driveConversation,
  extractSection,
  listPersonaFiles,
  loadAllPersonas,
  loadPersonaSheet,
  parsePersonaSheet,
  renderOracleTurn,
  runFileName,
  type OracleStepResult,
} from "./run";
import type { ExperienceProfile } from "@/lib/types";

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
});

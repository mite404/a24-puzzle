import { describe, expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  buildJudgePrompt,
  describeClaudeFailure,
  extractJson,
  loadBlindRecords,
  parseJudgeResponse,
  scoreBlindRecord,
  scoreIsDone,
  CHECK_IDS,
  type JudgeResult,
} from "./judge";
import type { BlindRecord } from "./blind";

// A minimal blinded record — exactly the shape blind.ts writes into evals/blind/.
function makeBlind(overrides: Partial<BlindRecord> = {}): BlindRecord {
  return {
    blindId: "abc123def456",
    transcript: [
      { role: "user", text: "I love Ari Aster." },
      { role: "oracle", text: "Which one grabbed you?" },
      { role: "user", text: "Midsommar." },
    ],
    words: ["DANI", "PELLE"],
    clues: [
      {
        number: 1,
        orientation: "across",
        answer: "DANI",
        clue: "Grieving protagonist crowned May Queen",
      },
      {
        number: 2,
        orientation: "down",
        answer: "PELLE",
        clue: "Swedish student who invites the group to the commune",
      },
    ],
    grid: "D A N I\n. E . .\n. L . .\n. L . .\n. E . .",
    ...overrides,
  };
}

// A well-formed judge response, as `claude -p` is instructed to emit it.
function judgeJson(overrides: Partial<Record<string, unknown>> = {}): string {
  return JSON.stringify({
    blindId: "whatever-the-model-echoes",
    c1: { pass: true, why: "words are Midsommar, the film discussed" },
    c2: { pass: true, why: "clues fair to a fan of the film" },
    c3: { pass: true, why: "spans lead DANI to supporting PELLE" },
    c4: { pass: true, why: "no repeated answers or clues" },
    c5: { pass: false, why: "PELLE clue calls him a student; verify" },
    ...overrides,
  });
}

describe("describeClaudeFailure", () => {
  // The smoke sweep surfaced this: `claude -p` prints "Not logged in · Please run
  // /login" to STDOUT and exits 1, so an stderr-only error message reported
  // "(no stderr)" and hid the real cause. The message must fall back to stdout.
  test("includes stdout when stderr is empty", () => {
    const msg = describeClaudeFailure(
      1,
      "Not logged in · Please run /login",
      "",
    );
    expect(msg).toContain("exited 1");
    expect(msg).toContain("Not logged in");
  });

  test("prefers stderr when present", () => {
    const msg = describeClaudeFailure(2, "some stdout", "boom on stderr");
    expect(msg).toContain("exited 2");
    expect(msg).toContain("boom on stderr");
  });

  test("falls back to a marker when both streams are empty", () => {
    const msg = describeClaudeFailure(1, "", "");
    expect(msg).toContain("exited 1");
    expect(msg).toContain("(no output)");
  });
});

describe("buildJudgePrompt", () => {
  test("inlines the rubric, transcript, clues, and grid", () => {
    const rubric = "### c5 — Factually correct — NEVER DROP THIS ONE";
    const prompt = buildJudgePrompt(makeBlind(), rubric);
    expect(prompt).toContain(rubric);
    expect(prompt).toContain("USER: I love Ari Aster.");
    expect(prompt).toContain("ORACLE: Which one grabbed you?");
    expect(prompt).toContain("DANI");
    expect(prompt).toContain("Grieving protagonist crowned May Queen");
    // the ASCII grid is carried through verbatim
    expect(prompt).toContain("D A N I");
  });

  test("pins the output to a single JSON object with the real blindId", () => {
    const prompt = buildJudgePrompt(makeBlind(), "rubric");
    expect(prompt).toContain('"blindId": "abc123def456"');
    expect(prompt).toContain("Return ONLY a single JSON object");
    // it names all five checks in the required shape
    for (const c of CHECK_IDS) expect(prompt).toContain(`"${c}"`);
  });

  test("survives an empty puzzle (failed upstream gate)", () => {
    const prompt = buildJudgePrompt(
      makeBlind({ words: [], clues: [], grid: "(no puzzle was generated)" }),
      "rubric",
    );
    expect(prompt).toContain("(no puzzle was generated)");
    expect(prompt).toContain("(no clues — the run produced no puzzle)");
    // still instructs the judge to mark unevaluable checks false, not skip them
    expect(prompt).toContain("absence of evidence is not a pass");
  });
});

describe("extractJson", () => {
  test("returns a bare JSON object unchanged", () => {
    expect(extractJson('{"a":1}')).toBe('{"a":1}');
  });

  test("strips a ```json code fence", () => {
    const raw = "Here is my verdict:\n```json\n{\"a\":1}\n```\nDone.";
    expect(JSON.parse(extractJson(raw))).toEqual({ a: 1 });
  });

  test("recovers the object from surrounding prose", () => {
    const raw = 'Sure. {"a":1, "b":2} — hope that helps!';
    expect(JSON.parse(extractJson(raw))).toEqual({ a: 1, b: 2 });
  });

  test("throws when there is no object at all", () => {
    expect(() => extractJson("I refuse to answer.")).toThrow(/no JSON object/);
  });
});

describe("parseJudgeResponse", () => {
  test("parses all five checks into verdicts", () => {
    const result = parseJudgeResponse(judgeJson(), "abc123def456");
    expect(result.c1.pass).toBe(true);
    expect(result.c5.pass).toBe(false);
    expect(result.c5.why).toContain("PELLE");
    for (const c of CHECK_IDS) {
      expect(typeof result[c].pass).toBe("boolean");
      expect(typeof result[c].why).toBe("string");
    }
  });

  test("takes the blindId from the caller, not the model's echo", () => {
    // the JSON echoes "whatever-the-model-echoes"; we must trust our own id.
    const result = parseJudgeResponse(judgeJson(), "the-real-id");
    expect(result.blindId).toBe("the-real-id");
  });

  test("throws when a check is missing entirely", () => {
    const raw = JSON.stringify({
      c1: { pass: true, why: "x" },
      c2: { pass: true, why: "x" },
      c3: { pass: true, why: "x" },
      c4: { pass: true, why: "x" },
      // c5 omitted — the never-drop check must not silently vanish
    });
    expect(() => parseJudgeResponse(raw, "id")).toThrow(/c5/);
  });

  test("throws when pass is not a boolean", () => {
    const raw = judgeJson({ c3: { pass: "yes", why: "x" } });
    expect(() => parseJudgeResponse(raw, "id")).toThrow(/c3.*boolean/);
  });

  test("defaults a missing rationale rather than dropping the verdict", () => {
    const raw = judgeJson({ c2: { pass: true } });
    const result = parseJudgeResponse(raw, "id");
    expect(result.c2.pass).toBe(true);
    expect(result.c2.why).toBe("(no rationale given)");
  });

  test("parses a fenced response end to end", () => {
    const raw = "```json\n" + judgeJson() + "\n```";
    const result = parseJudgeResponse(raw, "id");
    expect(result.c1.pass).toBe(true);
  });
});

describe("scoreBlindRecord", () => {
  test("feeds the built prompt to the judge and returns a labelled result", async () => {
    let sawPrompt = "";
    const fakeJudge = async (prompt: string) => {
      sawPrompt = prompt;
      return judgeJson();
    };
    const result: JudgeResult = await scoreBlindRecord(
      makeBlind(),
      "the rubric text",
      fakeJudge,
    );
    // the injected judge saw the real prompt (rubric + puzzle)
    expect(sawPrompt).toContain("the rubric text");
    expect(sawPrompt).toContain("DANI");
    // the result is labelled with the record's own blindId
    expect(result.blindId).toBe("abc123def456");
    expect(result.c5.pass).toBe(false);
  });

  test("propagates a judge-backend failure instead of scoring all-false", async () => {
    const failing = async () => {
      throw new Error("claude -p exited 1");
    };
    await expect(
      scoreBlindRecord(makeBlind(), "rubric", failing),
    ).rejects.toThrow(/claude -p/);
  });
});

describe("filesystem helpers", () => {
  test("loadBlindRecords reads every record but never key.json", () => {
    const dir = mkdtempSync(join(tmpdir(), "judge-blind-"));
    writeFileSync(
      join(dir, "aaa111.json"),
      JSON.stringify(makeBlind({ blindId: "aaa111" })),
    );
    writeFileSync(
      join(dir, "bbb222.json"),
      JSON.stringify(makeBlind({ blindId: "bbb222" })),
    );
    // key.json is the unblinding key — the judge must never load it.
    writeFileSync(
      join(dir, "key.json"),
      JSON.stringify({ salt: "s", generatedAt: "t", entries: {} }),
    );
    const loaded = loadBlindRecords(dir);
    expect(loaded).toHaveLength(2);
    expect(loaded.map((b) => b.record.blindId).sort()).toEqual([
      "aaa111",
      "bbb222",
    ]);
    expect(loaded.some((b) => b.fileName === "key.json")).toBe(false);
  });

  test("loadBlindRecords is empty for a missing directory", () => {
    expect(loadBlindRecords(join(tmpdir(), "does-not-exist-xyz"))).toEqual([]);
  });

  test("scoreIsDone tracks resumability", () => {
    const dir = mkdtempSync(join(tmpdir(), "judge-scores-"));
    expect(scoreIsDone(dir, "abc123")).toBe(false);
    writeFileSync(
      join(dir, "abc123.json"),
      JSON.stringify({ blindId: "abc123" }),
    );
    expect(scoreIsDone(dir, "abc123")).toBe(true);
  });

  test("scoreIsDone rejects an unparseable score file (will be re-judged)", () => {
    const dir = mkdtempSync(join(tmpdir(), "judge-scores-bad-"));
    writeFileSync(join(dir, "abc123.json"), "{ this is not json");
    expect(scoreIsDone(dir, "abc123")).toBe(false);
  });
});

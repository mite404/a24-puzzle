import { describe, expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { BlindKey, KeyEntry } from "./blind";
import type { JudgeResult } from "./judge";
import {
  aggregateChecks,
  armsOf,
  c5Failures,
  formatReport,
  joinScores,
  loadScores,
  type ScoredCell,
} from "./score";

// A judge verdict with every check passing, overridable per-check.
function makeVerdict(
  blindId: string,
  overrides: Partial<Record<"c1" | "c2" | "c3" | "c4" | "c5", boolean>> = {},
): JudgeResult {
  const v = (pass: boolean, why: string) => ({ pass, why });
  return {
    blindId,
    c1: v(overrides.c1 ?? true, "on topic"),
    c2: v(overrides.c2 ?? true, "solvable"),
    c3: v(overrides.c3 ?? true, "mixed"),
    c4: v(overrides.c4 ?? true, "distinct"),
    c5: v(overrides.c5 ?? true, "all facts check out"),
  };
}

// A key entry for one blindId — the identity blind.ts stripped, restored here.
function makeKeyEntry(
  blindId: string,
  overrides: Partial<KeyEntry> = {},
): KeyEntry {
  return {
    runFile: `${blindId}.json`,
    persona: `persona-${blindId}`,
    axis: "single-film",
    arm: "baseline",
    runIndex: 1,
    finalized: true,
    gatesPassed: true,
    ...overrides,
  };
}

function makeKey(entries: Record<string, KeyEntry>): BlindKey {
  return { salt: "deadbeef", generatedAt: "2026-01-01T00:00:00.000Z", entries };
}

// Lint bans non-null assertions (`!`), so narrow through this instead of `find(...)!`.
function must<T>(value: T | undefined): T {
  if (value === undefined) throw new Error("expected a value, got undefined");
  return value;
}

// A ready-made ScoredCell for the aggregation / formatting tests.
function cell(
  arm: string,
  blindId: string,
  checks: Partial<Record<"c1" | "c2" | "c3" | "c4" | "c5", boolean>> = {},
  extra: Partial<ScoredCell> = {},
): ScoredCell {
  return {
    blindId,
    arm,
    persona: `persona-${blindId}`,
    axis: "single-film",
    runIndex: 1,
    gatesPassed: true,
    finalized: true,
    verdict: makeVerdict(blindId, checks),
    ...extra,
  };
}

describe("joinScores (unblinding)", () => {
  test("restores identity by matching blindId to the key", () => {
    const scores = [makeVerdict("aaa"), makeVerdict("bbb")];
    const key = makeKey({
      aaa: makeKeyEntry("aaa", { persona: "the-witch-fan", arm: "baseline" }),
      bbb: makeKeyEntry("bbb", { persona: "safdie-fan", arm: "tweaked" }),
    });
    const { cells } = joinScores(scores, key);
    expect(cells).toHaveLength(2);
    const byId = Object.fromEntries(cells.map((c) => [c.blindId, c]));
    expect(byId.aaa.persona).toBe("the-witch-fan");
    expect(byId.aaa.arm).toBe("baseline");
    expect(byId.bbb.arm).toBe("tweaked");
  });

  test("a score with no key entry lands in unmatchedScores, not silently dropped", () => {
    const scores = [makeVerdict("aaa"), makeVerdict("ghost")];
    const key = makeKey({ aaa: makeKeyEntry("aaa") });
    const { cells, unmatchedScores } = joinScores(scores, key);
    expect(cells.map((c) => c.blindId)).toEqual(["aaa"]);
    expect(unmatchedScores).toEqual(["ghost"]);
  });

  test("a key entry with no score is reported as un-judged", () => {
    const scores = [makeVerdict("aaa")];
    const key = makeKey({
      aaa: makeKeyEntry("aaa"),
      bbb: makeKeyEntry("bbb"),
    });
    const { unjudged } = joinScores(scores, key);
    expect(unjudged).toEqual(["bbb"]);
  });
});

describe("aggregateChecks (per-block)", () => {
  test("counts pass/total/rate per arm for each check", () => {
    const cells = [
      cell("baseline", "a", { c5: true }),
      cell("baseline", "b", { c5: false }),
    ];
    const reports = aggregateChecks(cells);
    const c5 = must(reports.find((r) => r.check === "c5"));
    const baseline = must(c5.perArm.find((a) => a.arm === "baseline"));
    expect(baseline.passed).toBe(1);
    expect(baseline.total).toBe(2);
    expect(baseline.rate).toBe(0.5);
  });

  test("returns one report per rubric check, in order", () => {
    const reports = aggregateChecks([cell("baseline", "a")]);
    expect(reports.map((r) => r.check)).toEqual(["c1", "c2", "c3", "c4", "c5"]);
  });

  test("ceiling is true when every arm passes the check on every run", () => {
    const cells = [
      cell("baseline", "a"),
      cell("baseline", "b"),
      cell("tweaked", "c"),
    ];
    const c1 = must(aggregateChecks(cells).find((r) => r.check === "c1"));
    expect(c1.ceiling).toBe(true);
  });

  test("ceiling is false when any run fails the check", () => {
    const cells = [
      cell("baseline", "a"),
      cell("tweaked", "c", { c1: false }),
    ];
    const c1 = must(aggregateChecks(cells).find((r) => r.check === "c1"));
    expect(c1.ceiling).toBe(false);
  });

  test("ceiling is false with no cells (nothing to saturate)", () => {
    const c1 = must(aggregateChecks([]).find((r) => r.check === "c1"));
    expect(c1.ceiling).toBe(false);
    expect(c1.perArm).toEqual([]);
  });

  test("a single arm at 100% is still a ceiling (non-discriminating)", () => {
    const c1 = must(
      aggregateChecks([cell("baseline", "a")]).find((r) => r.check === "c1"),
    );
    expect(c1.ceiling).toBe(true);
  });
});

describe("armsOf", () => {
  test("returns distinct arms, sorted", () => {
    const cells = [
      cell("tweaked", "a"),
      cell("baseline", "b"),
      cell("baseline", "c"),
    ];
    expect(armsOf(cells)).toEqual(["baseline", "tweaked"]);
  });
});

describe("c5Failures (never-drop audit)", () => {
  test("surfaces exactly the cells whose c5 failed", () => {
    const cells = [
      cell("baseline", "good", { c5: true }),
      cell("baseline", "bad", { c5: false }),
    ];
    const fails = c5Failures(cells);
    expect(fails.map((c) => c.blindId)).toEqual(["bad"]);
  });
});

describe("formatReport", () => {
  test("prints per-arm rates and a CEILING line for a saturated block", () => {
    const cells = [cell("baseline", "a"), cell("tweaked", "b")];
    const text = formatReport(
      { cells, unmatchedScores: [], unjudged: [] },
      aggregateChecks(cells),
    );
    // per-block, per-arm rates are present
    expect(text).toContain("baseline: 1/1 (100%)");
    expect(text).toContain("tweaked: 1/1 (100%)");
    // every check is saturated here, so each carries the mandated CEILING warning
    expect(text).toContain("CEILING");
    expect(text).toContain("c5 — factually correct (NEVER DROP)");
  });

  test("no CEILING line when a block still discriminates", () => {
    const cells = [
      cell("baseline", "a", { c1: true }),
      cell("baseline", "b", { c1: false }),
    ];
    const reports = aggregateChecks(cells);
    const c1 = must(reports.find((r) => r.check === "c1"));
    // isolate the c1 block text: it must not carry a CEILING line
    const text = formatReport({ cells, unmatchedScores: [], unjudged: [] }, [
      c1,
    ]);
    expect(text).toContain("baseline: 1/2 (50%)");
    expect(text).not.toContain("CEILING");
  });

  test("lists c5 failures unblinded so a human can audit them", () => {
    const cells = [
      cell(
        "baseline",
        "bad",
        { c5: false },
        {
          persona: "midsommar-superfan",
          axis: "single-film",
          verdict: {
            ...makeVerdict("bad", { c5: false }),
            c5: { pass: false, why: "PELLE is Christian's friend, not Dani's brother" },
          },
        },
      ),
    ];
    const text = formatReport(
      { cells, unmatchedScores: [], unjudged: [] },
      aggregateChecks(cells),
    );
    expect(text).toContain("c5 audit — factually-correct failures: 1");
    expect(text).toContain("midsommar-superfan");
    expect(text).toContain("PELLE is Christian's friend");
  });

  test("reports un-judged and unmatched counts honestly", () => {
    const cells = [cell("baseline", "a")];
    const text = formatReport(
      { cells, unmatchedScores: ["ghost"], unjudged: ["pending"] },
      aggregateChecks(cells),
    );
    expect(text).toContain("Un-judged (in key, no score yet): 1");
    expect(text).toContain("WARNING: 1 score(s) had no key entry: ghost");
  });

  test("handles zero scored cells without crashing", () => {
    const text = formatReport(
      { cells: [], unmatchedScores: [], unjudged: ["a", "b"] },
      aggregateChecks([]),
    );
    expect(text).toContain("Scored 0 cell(s)");
    expect(text).toContain("No scored cells to aggregate");
  });
});

describe("loadScores (filesystem)", () => {
  test("reads every verdict file, sorted, and skips nothing else", () => {
    const dir = mkdtempSync(join(tmpdir(), "score-load-"));
    writeFileSync(join(dir, "aaa.json"), JSON.stringify(makeVerdict("aaa")));
    writeFileSync(join(dir, "bbb.json"), JSON.stringify(makeVerdict("bbb")));
    writeFileSync(join(dir, "notes.txt"), "ignore me");
    const scores = loadScores(dir);
    expect(scores.map((s) => s.blindId)).toEqual(["aaa", "bbb"]);
  });

  test("is empty for a missing directory", () => {
    expect(loadScores(join(tmpdir(), "score-nope-xyz"))).toEqual([]);
  });
});

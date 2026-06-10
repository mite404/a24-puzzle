import { describe, expect, test } from "bun:test";
import { CROSSWORD_ORACLE_QUIPS } from "@/lib/crossword-oracle-quips";
import {
  fetchOracleQuipLine,
  resolveIdle45Line,
} from "@/lib/crossword-oracle-quip-fetch";

describe("resolveIdle45Line", () => {
  const bank = CROSSWORD_ORACLE_QUIPS.witch.idle45;

  test("uses LLM line when present", () => {
    expect(resolveIdle45Line("Custom zinger.", bank)).toBe("Custom zinger.");
  });

  test("falls back to bank when LLM returns null", () => {
    const line = resolveIdle45Line(null, bank);
    expect(bank).toContain(line);
  });

  test("falls back to bank when LLM returns empty string", () => {
    const line = resolveIdle45Line("   ", bank);
    expect(bank).toContain(line);
  });
});

describe("fetchOracleQuipLine fail-open", () => {
  test("returns null on non-OK response", async () => {
    const result = await fetchOracleQuipLine(
      "witch",
      { clue: "Test", position: 1, orientation: "across" },
      async () => new Response(JSON.stringify({ error: "nope" }), { status: 502 }),
    );
    expect(result).toBeNull();
  });

  test("returns null when fetch throws", async () => {
    const result = await fetchOracleQuipLine(
      "witch",
      { clue: "Test", position: 1, orientation: "across" },
      async () => {
        throw new Error("network down");
      },
    );
    expect(result).toBeNull();
  });

  test("returns trimmed line on success", async () => {
    const result = await fetchOracleQuipLine(
      "witch",
      { clue: "Test", position: 1, orientation: "across" },
      async () =>
        new Response(JSON.stringify({ line: "  Speak a letter.  " }), {
          status: 200,
        }),
    );
    expect(result).toBe("Speak a letter.");
  });
});

import { describe, expect, test } from "bun:test";
import { CROSSWORD_ORACLE_QUIPS } from "@/lib/crossword-oracle-quips";
import { fetchOracleQuipLine, resolveIdle45Line } from "@/lib/crossword-oracle-quip-fetch";
import { URL } from "node:url";
import { error } from "node:console";

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

describe("fetchOracleQuipLine cancellation", () => {
  const signalAwareMock =
    (response: Response) =>
    async (_url: RequestInfo | URL, opts?: RequestInit): Promise<Response> => {
      if (opts?.signal?.aborted) throw new DOMException("Aborted", "AbortError");
      return response;
    };

  test("signal already aborted", async () => {
    // if user has pressed cancel btn before fetchOracleQuipLine is running,
    // fn returns null instead of crashes
    const controller = new AbortController();
    controller.abort();

    const response = new Response();

    const result = await fetchOracleQuipLine(
      "witch",
      { clue: "Test", position: 1, orientation: "across" },
      signalAwareMock(response),
      controller.signal,
    );

    expect(result).toBe(null);
  });

  test("signal cancelled during API call", async () => {
    // create controller
    const controller = new AbortController();
    const response = new Response();

    async function fetchImplMock(_url: RequestInfo | URL, opts?: RequestInit): Promise<Response> {
      controller.abort();
      if (opts?.signal?.aborted) throw new DOMException("Aborted", "AbortError");
      return response;
    }

    // pass controller's signal as externalSignal
    const result = await fetchOracleQuipLine(
      "witch",
      { clue: "Test", position: 1, orientation: "across" },
      fetchImplMock,
      controller.signal,
    );

    expect(result).toBe(null);
  });
});

import { describe, expect, test } from "bun:test";
import { pickQuip } from "@/lib/crossword-oracle-quips";

describe("pickQuip", () => {
  test("returns a line from the pool", () => {
    const pool = ["A", "B", "C"];
    expect(pool).toContain(pickQuip(pool));
  });

  test("never returns the same line twice in a row", () => {
    const pool = ["A", "B", "C"];
    for (let i = 0; i < 50; i++) {
      const first = pickQuip(pool);
      const second = pickQuip(pool, first);
      expect(second).not.toBe(first);
    }
  });

  test("handles single-item pool", () => {
    expect(pickQuip(["Only"])).toBe("Only");
    expect(pickQuip(["Only"], "Only")).toBe("Only");
  });

  test(`When random resolves to 0.9 and the pool is ["A", "B", "C"], pickQuip should return "C"`, () => {
    const pool = ["A", "B", "C"];
    const mockRandom: () => number = () => 0.9;
    // index = floor(0.9 * 3) = 2 → the last entry.
    expect(pickQuip(pool, undefined, mockRandom)).toBe("C");
  });
});

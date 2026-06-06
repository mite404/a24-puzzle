import { describe, expect, test } from "bun:test";
import type { Scores } from "@/lib/types";
import { scoreQuipTier } from "@/lib/scoring";

function scores(correct: number, total: number): Scores {
  const half = Math.floor(total / 2);
  return {
    location: Math.floor(correct / 2),
    locationTotal: half,
    crossword: correct - Math.floor(correct / 2),
    crosswordTotal: total - half,
  };
}

describe("scoreQuipTier", () => {
  test("good at 65% or above", () => {
    expect(scoreQuipTier(scores(13, 20))).toBe("good");
    expect(scoreQuipTier(scores(18, 20))).toBe("good");
  });

  test("average between 40% and 64%", () => {
    expect(scoreQuipTier(scores(10, 20))).toBe("average");
    expect(scoreQuipTier(scores(8, 20))).toBe("average");
  });

  test("bad below 40%", () => {
    expect(scoreQuipTier(scores(7, 20))).toBe("bad");
    expect(scoreQuipTier(scores(0, 20))).toBe("bad");
  });
});
